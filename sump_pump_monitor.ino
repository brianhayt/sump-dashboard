/*
 * Sump Pump Monitoring System
 * Sparkfun ESP32-S2 Thing Plus Firmware
 * 
 * Hardware:
 * - Sparkfun ESP32-S2 Thing Plus
 * - ADS1115 16-bit ADC (I2C)
 * - eTape resistive water level sensor
 * - PS-C22 backup alarm via optocoupler (PC817)
 * - USB wall wart for AC power detection
 * - 12V marine battery with voltage divider
 * 
 * ADS1115 Channels:
 * - Channel 0: eTape water level sensor
 * - Channel 1: Battery voltage (via divider)
 * 
 * Features:
 * - Supabase cloud data logging
 * - Local buffering when WiFi unavailable
 * - Pump cycle detection and daily statistics
 * - Event detection and logging
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <time.h>

// ============================================================================
// CONFIGURATION - EASY TO UPDATE SECTION
// ============================================================================

// -------------------------
// WiFi Credentials
// -------------------------
const char* WIFI_SSID = "Walternet";
const char* WIFI_PASSWORD = "Inara129110!";

// -------------------------
// Supabase Configuration
// -------------------------
const char* SUPABASE_URL = "https://zhiswuxuifpjcsmtmwfa.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoaXN3dXh1aWZwamNzbXRtd2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjA3NzEsImV4cCI6MjA4NDIzNjc3MX0.DKtQRpBKtCO1kbsEqLvXctxRZO-UWpPPYprlNCbNj34";

// -------------------------
// Pin Assignments (Sparkfun ESP32-S2 Thing Plus)
// -------------------------
#define I2C_SDA 8
#define I2C_SCL 10
#define AC_POWER_PIN 4
#define OPTO_ALARM_PIN 6

// -------------------------
// eTape Calibration (UPDATED FROM YOUR READINGS)
// -------------------------
// Used 0" (1715) and 4" (1415) to calculate the slope.
// Slope = (1715 - 1415) / 4.0 = 75 ohms per inch.
// At 12.4" (Full), Resistance = 1715 - (75 * 12.4) = 785 Ohms.

#define SERIES_RESISTOR 990.0           
#define ETAPE_EMPTY_RESISTANCE 1715.0   // User measured at 0"
#define ETAPE_FULL_RESISTANCE 785.0     // Calculated based on 4" reading
#define ETAPE_LENGTH_INCHES 12.4        

// -------------------------
// Pit Geometry
// -------------------------
#define PIT_AREA_SQ_INCHES 352.0        
#define GALLONS_PER_INCH 1.52           

// -------------------------
// Battery Divider
// -------------------------
#define BATTERY_DIVIDER_RATIO 0.32      

// -------------------------
// Alert Thresholds
// -------------------------
// Pump kicks in at ~4.5", so High Water Alert should be higher (e.g., 6.0")
#define HIGH_WATER_THRESHOLD 6.0        
#define LOW_BATTERY_THRESHOLD 11.5      
#define AC_POWER_THRESHOLD 1000         
#define PUMP_DETECT_DROP_RATE 0.2       // Reduced slightly to be more sensitive
#define PUMP_STOP_DROP_RATE 0.05        
#define MAX_PUMP_RUNTIME_SEC 300


// -------------------------
// Timing Configuration
// -------------------------
#define READ_INTERVAL_MS 1000           // Read sensors every 1 second
#define UPLOAD_INTERVAL_MS 60000        // Upload to Supabase every 60 seconds
#define UPLOAD_ON_CHANGE_DELAY_MS 5000  // Wait after state change before upload
#define PRINT_INTERVAL_MS 5000          // Print to Serial every 5 seconds
#define WIFI_RETRY_INTERVAL_MS 30000    // Retry WiFi every 30 seconds
#define NTP_SYNC_INTERVAL_MS 3600000    // Sync NTP every hour

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

Adafruit_ADS1115 ads;
Preferences preferences;
WiFiClientSecure client;

// Current sensor readings
struct SensorData {
  float waterLevelInches;
  float eTapeResistance;      // For debugging/calibration
  float batteryVoltage;
  bool acPowerOn;
  bool backupAlarmActive;
} currentData;

// Pump cycle tracking
struct PumpState {
  bool running;
  unsigned long startTime;
  float startWaterLevel;
  float lastWaterLevel;
} pumpState;

// Daily statistics
struct DailyStats {
  int totalCycles;
  float totalGallonsPumped;
  float maxWaterLevel;
  float minWaterLevel;
  unsigned long totalRuntimeMs;
  int dayOfYear;
} dailyStats;

// Previous states for change detection
bool prevBackupAlarm = false;
bool prevAcPower = true;
bool prevPumpRunning = false;

// Timing
unsigned long lastReadTime = 0;
unsigned long lastUploadTime = 0;
unsigned long lastPrintTime = 0;
unsigned long lastWiFiRetry = 0;
unsigned long lastNtpSync = 0;
unsigned long stateChangeTime = 0;
bool pendingUpload = false;

// WiFi and time state
bool wifiConnected = false;
bool timeInitialized = false;

// Local buffer for offline storage
const int MAX_BUFFERED_READINGS = 100;
int bufferedReadingCount = 0;

// Event types
enum EventType {
  EVENT_PUMP_CYCLE_START,
  EVENT_PUMP_CYCLE_END,
  EVENT_BACKUP_ALARM_ON,
  EVENT_BACKUP_ALARM_OFF,
  EVENT_POWER_OUTAGE,
  EVENT_POWER_RESTORED,
  EVENT_HIGH_WATER,
  EVENT_LOW_BATTERY,
  EVENT_LONG_PUMP_RUN
};

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("**********************************************");
  Serial.println("*     SUMP PUMP MONITOR - SUPABASE v1.0      *");
  Serial.println("*     Sparkfun ESP32-S2 Thing Plus           *");
  Serial.println("**********************************************");
  Serial.println();

  // Initialize pins
  pinMode(AC_POWER_PIN, INPUT);
  pinMode(OPTO_ALARM_PIN, INPUT);

  // Initialize I2C and ADS1115
  Wire.begin(I2C_SDA, I2C_SCL);
  
  if (!ads.begin()) {
    Serial.println("[ERROR] ADS1115 not found! Check wiring.");
    Serial.println("        SDA -> GPIO 8");
    Serial.println("        SCL -> GPIO 10");
    Serial.println("        VDD -> 3.3V");
    Serial.println("        GND -> GND");
    Serial.println("        ADDR -> GND (for 0x48 address)");
    while (1) {
      delay(1000);
    }
  }
  ads.setGain(GAIN_ONE);  // +/- 4.096V range
  Serial.println("[OK] ADS1115 initialized");

  // Initialize preferences for local storage
  preferences.begin("sump", false);
  bufferedReadingCount = preferences.getInt("buffered", 0);
  if (bufferedReadingCount > 0) {
    Serial.printf("[INFO] %d buffered readings from previous session\n", bufferedReadingCount);
  }

  // Initialize state
  pumpState.running = false;
  pumpState.startTime = 0;
  pumpState.startWaterLevel = 0;
  pumpState.lastWaterLevel = 0;

  dailyStats.totalCycles = 0;
  dailyStats.totalGallonsPumped = 0;
  dailyStats.maxWaterLevel = 0;
  dailyStats.minWaterLevel = 99;
  dailyStats.totalRuntimeMs = 0;
  dailyStats.dayOfYear = -1;

  // Connect to WiFi
  connectWiFi();

  // Initialize time via NTP
  if (wifiConnected) {
    initializeTime();
  }

  // SSL - use insecure for now (add CA cert for production)
  client.setInsecure();

  // Load daily stats if same day
  if (timeInitialized) {
    loadDailyStats();
  }

  Serial.println();
  Serial.println("==============================================");
  Serial.println("CONFIGURATION:");
  Serial.printf("  eTape: %.0fΩ empty, %.0fΩ full, %.1f\" length\n", 
    ETAPE_EMPTY_RESISTANCE, ETAPE_FULL_RESISTANCE, ETAPE_LENGTH_INCHES);
  Serial.printf("  Pit area: %.0f sq in (%.2f gal/inch)\n", 
    PIT_AREA_SQ_INCHES, GALLONS_PER_INCH);
  Serial.printf("  Alerts: High water >%.1f\", Low battery <%.1fV\n",
    HIGH_WATER_THRESHOLD, LOW_BATTERY_THRESHOLD);
  Serial.println("==============================================");
  Serial.println("SYSTEM READY - Starting monitoring...");
  Serial.println("==============================================");
  Serial.println();
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  unsigned long now = millis();

  // Read sensors at regular interval
  if (now - lastReadTime >= READ_INTERVAL_MS) {
    lastReadTime = now;
    readSensors();
    detectPumpCycle();
    checkAlerts();
  }

  // Print status to Serial
  if (now - lastPrintTime >= PRINT_INTERVAL_MS) {
    lastPrintTime = now;
    printStatus();
  }

  // Check WiFi connection
  if (!wifiConnected && (now - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS)) {
    lastWiFiRetry = now;
    connectWiFi();
    if (wifiConnected && !timeInitialized) {
      initializeTime();
    }
  }

  // Sync NTP periodically
  if (wifiConnected && timeInitialized && (now - lastNtpSync >= NTP_SYNC_INTERVAL_MS)) {
    lastNtpSync = now;
    initializeTime();
  }

  // Upload data
  bool shouldUpload = false;
  
  if (now - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    shouldUpload = true;
  }
  
  if (pendingUpload && (now - stateChangeTime >= UPLOAD_ON_CHANGE_DELAY_MS)) {
    shouldUpload = true;
    pendingUpload = false;
  }

  if (shouldUpload) {
    if (wifiConnected) {
      uploadReading();
      uploadBufferedReadings();
      lastUploadTime = now;
    } else {
      bufferReading();
    }
  }

  // Check for daily reset (simplified - checks every loop when time is available)
  if (timeInitialized) {
    checkDailyReset();
  }

  delay(10);
}

// ============================================================================
// SENSOR READING
// ============================================================================

void readSensors() {
  // Read eTape water level (ADS1115 Channel 0)
  int16_t adcValue = ads.readADC_SingleEnded(0);
  float voltage = ads.computeVolts(adcValue);
  
  // Calculate eTape resistance from voltage divider
  // Circuit: 3.3V -> Series Resistor -> ADC -> eTape -> GND
  // Vout = Vin * Retape / (Rseries + Retape)
  // Solving: Retape = Rseries * Vout / (Vin - Vout)
  float vin = 3.3;
  float resistance;
  
  if (voltage >= vin - 0.01) {
    resistance = 99999;  // Open circuit
  } else if (voltage <= 0.01) {
    resistance = 0;      // Short circuit
  } else {
    resistance = SERIES_RESISTOR * voltage / (vin - voltage);
  }
  currentData.eTapeResistance = resistance;  // Store for calibration display
  
  // Convert resistance to water level
  // Lower resistance = more water
  float level;
  if (resistance >= ETAPE_EMPTY_RESISTANCE) {
    level = 0;
  } else if (resistance <= ETAPE_FULL_RESISTANCE) {
    level = ETAPE_LENGTH_INCHES;
  } else {
    level = ETAPE_LENGTH_INCHES * 
      (ETAPE_EMPTY_RESISTANCE - resistance) / 
      (ETAPE_EMPTY_RESISTANCE - ETAPE_FULL_RESISTANCE);
  }
  currentData.waterLevelInches = level;

  // Read battery voltage (ADS1115 Channel 1)
  int16_t batteryAdc = ads.readADC_SingleEnded(1);
  float batteryAdcVoltage = ads.computeVolts(batteryAdc);
  currentData.batteryVoltage = batteryAdcVoltage / BATTERY_DIVIDER_RATIO;

  // Read AC power (ESP32 built-in ADC)
  int acAdcValue = analogRead(AC_POWER_PIN);
  currentData.acPowerOn = (acAdcValue > AC_POWER_THRESHOLD);

  // Read backup alarm (optocoupler pulls LOW when alarm active)
  currentData.backupAlarmActive = (digitalRead(OPTO_ALARM_PIN) == LOW);

  // Update daily min/max
  if (currentData.waterLevelInches > dailyStats.maxWaterLevel) {
    dailyStats.maxWaterLevel = currentData.waterLevelInches;
  }
  if (currentData.waterLevelInches < dailyStats.minWaterLevel) {
    dailyStats.minWaterLevel = currentData.waterLevelInches;
  }
}

// ============================================================================
// PUMP CYCLE DETECTION
// ============================================================================

void detectPumpCycle() {
  float levelDelta = pumpState.lastWaterLevel - currentData.waterLevelInches;

  // Detect pump starting (water level dropping rapidly)
  if (!pumpState.running && levelDelta > PUMP_DETECT_DROP_RATE) {
    pumpState.running = true;
    pumpState.startTime = millis();
    pumpState.startWaterLevel = pumpState.lastWaterLevel;
    
    logEvent(EVENT_PUMP_CYCLE_START, currentData.waterLevelInches);
    triggerStateChange();
    Serial.println(">>> PUMP STARTED - Water level dropping");
  }

  // Detect pump stopping (water level stabilized or rising)
  if (pumpState.running && levelDelta < PUMP_STOP_DROP_RATE) {
    pumpState.running = false;
    
    unsigned long runtimeMs = millis() - pumpState.startTime;
    float levelDrop = pumpState.startWaterLevel - currentData.waterLevelInches;
    if (levelDrop < 0) levelDrop = 0;
    
    float gallonsPumped = levelDrop * GALLONS_PER_INCH;
    
    // Update daily stats
    dailyStats.totalCycles++;
    dailyStats.totalGallonsPumped += gallonsPumped;
    dailyStats.totalRuntimeMs += runtimeMs;
    
    // Save stats periodically
    saveDailyStats();
    
    logEvent(EVENT_PUMP_CYCLE_END, gallonsPumped);
    triggerStateChange();
    
    Serial.printf(">>> PUMP STOPPED - Runtime: %.1fs, Pumped: ~%.1f gal\n", 
      runtimeMs / 1000.0, gallonsPumped);
  }

  pumpState.lastWaterLevel = currentData.waterLevelInches;
  prevPumpRunning = pumpState.running;
}

// ============================================================================
// ALERT CHECKING
// ============================================================================

void checkAlerts() {
  // Backup alarm state change
  if (currentData.backupAlarmActive != prevBackupAlarm) {
    if (currentData.backupAlarmActive) {
      logEvent(EVENT_BACKUP_ALARM_ON, currentData.waterLevelInches);
      Serial.println("!!! BACKUP ALARM ACTIVATED !!!");
    } else {
      logEvent(EVENT_BACKUP_ALARM_OFF, 0);
      Serial.println("Backup alarm cleared");
    }
    prevBackupAlarm = currentData.backupAlarmActive;
    triggerStateChange();
  }

  // AC power state change
  if (currentData.acPowerOn != prevAcPower) {
    if (!currentData.acPowerOn) {
      logEvent(EVENT_POWER_OUTAGE, currentData.batteryVoltage);
      Serial.println("!!! POWER OUTAGE DETECTED !!!");
    } else {
      logEvent(EVENT_POWER_RESTORED, 0);
      Serial.println("Power restored");
    }
    prevAcPower = currentData.acPowerOn;
    triggerStateChange();
  }

  // High water alert (with hysteresis)
  static bool highWaterAlerted = false;
  if (currentData.waterLevelInches > HIGH_WATER_THRESHOLD && !highWaterAlerted) {
    logEvent(EVENT_HIGH_WATER, currentData.waterLevelInches);
    Serial.println("!!! HIGH WATER ALERT !!!");
    highWaterAlerted = true;
    triggerStateChange();
  } else if (currentData.waterLevelInches < HIGH_WATER_THRESHOLD - 1.0) {
    highWaterAlerted = false;
  }

  // Low battery alert (with hysteresis)
  static bool lowBatteryAlerted = false;
  if (currentData.batteryVoltage < LOW_BATTERY_THRESHOLD && 
      currentData.batteryVoltage > 5.0 &&  // Sanity check - ignore bad readings
      !lowBatteryAlerted) {
    logEvent(EVENT_LOW_BATTERY, currentData.batteryVoltage);
    Serial.println("!!! LOW BATTERY ALERT !!!");
    lowBatteryAlerted = true;
    triggerStateChange();
  } else if (currentData.batteryVoltage >= LOW_BATTERY_THRESHOLD + 0.5) {
    lowBatteryAlerted = false;
  }

  // Long pump run alert
  static bool longRunAlerted = false;
  if (pumpState.running) {
    unsigned long runtimeSec = (millis() - pumpState.startTime) / 1000;
    if (runtimeSec > MAX_PUMP_RUNTIME_SEC && !longRunAlerted) {
      logEvent(EVENT_LONG_PUMP_RUN, runtimeSec);
      Serial.println("!!! LONG PUMP RUN ALERT !!!");
      longRunAlerted = true;
      triggerStateChange();
    }
  } else {
    longRunAlerted = false;
  }
}

void triggerStateChange() {
  stateChangeTime = millis();
  pendingUpload = true;
}

// ============================================================================
// STATUS OUTPUT
// ============================================================================

String getSystemStatus() {
  if (!currentData.acPowerOn && currentData.backupAlarmActive) {
    return "POWER OUT - BACKUP PUMP RUNNING";
  }
  if (currentData.acPowerOn && currentData.backupAlarmActive) {
    return "WARNING: PRIMARY PUMP FAILED - BACKUP ACTIVE";
  }
  if (!currentData.acPowerOn && !currentData.backupAlarmActive) {
    return "POWER OUT - Monitoring on battery";
  }
  if (currentData.waterLevelInches > HIGH_WATER_THRESHOLD) {
    return "WARNING: HIGH WATER LEVEL";
  }
  if (currentData.batteryVoltage < LOW_BATTERY_THRESHOLD && currentData.batteryVoltage > 5.0) {
    return "WARNING: LOW BACKUP BATTERY";
  }
  if (pumpState.running) {
    return "NORMAL - Primary pump running";
  }
  return "NORMAL - All systems OK";
}

void printStatus() {
  Serial.println("----------------------------------------------");
  Serial.print("STATUS: ");
  Serial.println(getSystemStatus());
  Serial.println();
  
  Serial.print("  Water Level:    ");
  Serial.print(currentData.waterLevelInches, 2);
  Serial.print("\" (");
  Serial.print(currentData.eTapeResistance, 0);
  Serial.println(" ohms)");
  
  Serial.print("  Battery:        ");
  Serial.print(currentData.batteryVoltage, 1);
  Serial.print(" V");
  if (currentData.batteryVoltage < LOW_BATTERY_THRESHOLD && currentData.batteryVoltage > 5.0) {
    Serial.print(" [LOW!]");
  }
  Serial.println();
  
  Serial.print("  AC Power:       ");
  Serial.println(currentData.acPowerOn ? "ON" : "OFF");
  
  Serial.print("  Backup Alarm:   ");
  Serial.println(currentData.backupAlarmActive ? "ACTIVE" : "Normal");
  
  Serial.print("  Pump Running:   ");
  Serial.println(pumpState.running ? "YES" : "No");
  
  Serial.println();
  Serial.print("  Daily Cycles:   ");
  Serial.println(dailyStats.totalCycles);
  
  Serial.print("  Daily Gallons:  ");
  Serial.print(dailyStats.totalGallonsPumped, 1);
  Serial.println(" gal");
  
  Serial.print("  Daily Runtime:  ");
  Serial.print(dailyStats.totalRuntimeMs / 60000.0, 1);
  Serial.println(" min");
  
  Serial.print("  WiFi:           ");
  Serial.println(wifiConnected ? "Connected" : "Disconnected");
  
  Serial.print("  Supabase:       ");
  Serial.println(timeInitialized ? "Ready" : "Waiting for time sync");
  
  if (bufferedReadingCount > 0) {
    Serial.print("  Buffered:       ");
    Serial.print(bufferedReadingCount);
    Serial.println(" readings");
  }
  
  Serial.println();
}

// ============================================================================
// SUPABASE COMMUNICATION
// ============================================================================

void uploadReading() {
  if (!wifiConnected || !timeInitialized) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/readings";
  
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  // Build JSON payload
  StaticJsonDocument<512> doc;
  
  // -- MATCHING SQL COLUMNS --
  doc["water_level_inches"] = round(currentData.waterLevelInches * 100) / 100.0;
  doc["battery_voltage"] = round(currentData.batteryVoltage * 100) / 100.0;
  doc["backup_alarm_active"] = currentData.backupAlarmActive;
  doc["ac_power_on"] = currentData.acPowerOn;        // Renamed from ac_power_present
  doc["pump_running"] = pumpState.running;
  doc["wifi_rssi"] = WiFi.RSSI();                    // Added: SQL table has this column

  // REMOVED: daily_runtime_minutes, daily_cycles, daily_gallons 
  // (These columns do not exist in the 'readings' table)

  // REMOVED: recorded_at
  // (Supabase will automatically apply 'created_at' = NOW())

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  
  if (httpCode == 201 || httpCode == 200) {
    Serial.println("[OK] Reading uploaded to Supabase");
  } else {
    Serial.printf("[ERROR] Upload failed: %d\n", httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
    bufferReading();
  }
  
  http.end();
}

void logEvent(EventType type, float value) {
  if (!wifiConnected || !timeInitialized) return;

  const char* eventNames[] = {
    "pump_cycle_start",
    "pump_cycle_end", 
    "backup_alarm_on",
    "backup_alarm_off",
    "power_outage",
    "power_restored",
    "high_water",
    "low_battery",
    "long_pump_run"
  };

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/events";
  
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<256> doc;
  doc["event_type"] = eventNames[type];
  
  // Map the numeric 'value' to the 'message' column since 'value' column doesn't exist
  doc["message"] = String(value); 
  
  doc["water_level_inches"] = currentData.waterLevelInches;
  doc["battery_voltage"] = currentData.batteryVoltage;
  doc["ac_power_on"] = currentData.acPowerOn; // Renamed from ac_power_present
  
  // Supabase will handle created_at automatically, or we can send it explicitly
  // Sending it explicitly ensures the event time is accurate even if upload lags slightly
  time_t now;
  time(&now);
  char timestamp[30];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  doc["created_at"] = timestamp; // Renamed from occurred_at

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 201 || httpCode == 200) {
    Serial.printf("[OK] Event logged: %s\n", eventNames[type]);
  } else {
    Serial.printf("[ERROR] Event logging failed: %d\n", httpCode);
  }
  
  http.end();
}



// ============================================================================
// LOCAL BUFFERING
// ============================================================================

void bufferReading() {
  if (bufferedReadingCount >= MAX_BUFFERED_READINGS) {
    Serial.println("[WARN] Buffer full, dropping oldest reading");
    bufferedReadingCount = MAX_BUFFERED_READINGS - 1;
  }

  String key = "buf_" + String(bufferedReadingCount);
  
  StaticJsonDocument<256> doc;
  doc["wl"] = currentData.waterLevelInches;
  doc["bv"] = currentData.batteryVoltage;
  doc["ba"] = currentData.backupAlarmActive;
  doc["ac"] = currentData.acPowerOn;
  doc["pr"] = pumpState.running;
  doc["ts"] = millis();
  
  String json;
  serializeJson(doc, json);
  preferences.putString(key.c_str(), json);
  
  bufferedReadingCount++;
  preferences.putInt("buffered", bufferedReadingCount);
  
  Serial.printf("[INFO] Buffered reading #%d\n", bufferedReadingCount);
}

void uploadBufferedReadings() {
  if (bufferedReadingCount == 0) return;

  Serial.printf("[INFO] Uploading %d buffered readings...\n", bufferedReadingCount);
  
  int uploaded = 0;
  for (int i = 0; i < bufferedReadingCount; i++) {
    String key = "buf_" + String(i);
    String json = preferences.getString(key.c_str(), "");
    
    if (json.length() > 0) {
      StaticJsonDocument<256> doc;
      deserializeJson(doc, json);

      HTTPClient http;
      String url = String(SUPABASE_URL) + "/rest/v1/readings";
      
      http.begin(client, url);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("apikey", SUPABASE_ANON_KEY);
      http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
      http.addHeader("Prefer", "return=minimal");

      StaticJsonDocument<512> payload;
      payload["water_level_inches"] = doc["wl"];
      payload["battery_voltage"] = doc["bv"];
      payload["backup_alarm_active"] = doc["ba"];
      payload["ac_power_on"] = doc["ac"];     // Renamed from ac_power_present
      payload["pump_running"] = doc["pr"];
      // REMOVED: payload["is_buffered"] = true; (Column does not exist in SQL)
      
      String payloadStr;
      serializeJson(payload, payloadStr);
      
      int httpCode = http.POST(payloadStr);
      http.end();

      if (httpCode == 201 || httpCode == 200) {
        uploaded++;
        preferences.remove(key.c_str());
      } else {
        break;
      }
      
      delay(100);
    }
  }
  
  if (uploaded > 0) {
    bufferedReadingCount -= uploaded;
    preferences.putInt("buffered", bufferedReadingCount);
    Serial.printf("[OK] Uploaded %d buffered, %d remaining\n", uploaded, bufferedReadingCount);
  }
}

// ============================================================================
// DAILY STATISTICS
// ============================================================================

void loadDailyStats() {
  time_t now;
  time(&now);
  struct tm* timeinfo = localtime(&now);
  int today = timeinfo->tm_yday;
  
  int savedDay = preferences.getInt("statsDay", -1);
  
  if (savedDay == today) {
    dailyStats.totalCycles = preferences.getInt("statsCycles", 0);
    dailyStats.totalGallonsPumped = preferences.getFloat("statsGallons", 0);
    dailyStats.totalRuntimeMs = preferences.getULong("statsRuntime", 0);
    dailyStats.maxWaterLevel = preferences.getFloat("statsMaxWL", 0);
    dailyStats.minWaterLevel = preferences.getFloat("statsMinWL", 99);
    dailyStats.dayOfYear = today;
    Serial.printf("[INFO] Loaded daily stats: %d cycles, %.1f gal\n", 
      dailyStats.totalCycles, dailyStats.totalGallonsPumped);
  } else {
    if (savedDay >= 0) {
      uploadDailySummary();
    }
    resetDailyStats(today);
  }
}

void saveDailyStats() {
  preferences.putInt("statsDay", dailyStats.dayOfYear);
  preferences.putInt("statsCycles", dailyStats.totalCycles);
  preferences.putFloat("statsGallons", dailyStats.totalGallonsPumped);
  preferences.putULong("statsRuntime", dailyStats.totalRuntimeMs);
  preferences.putFloat("statsMaxWL", dailyStats.maxWaterLevel);
  preferences.putFloat("statsMinWL", dailyStats.minWaterLevel);
}

void resetDailyStats(int newDay) {
  dailyStats.totalCycles = 0;
  dailyStats.totalGallonsPumped = 0;
  dailyStats.totalRuntimeMs = 0;
  dailyStats.maxWaterLevel = 0;
  dailyStats.minWaterLevel = 99;
  dailyStats.dayOfYear = newDay;
  saveDailyStats();
  Serial.println("[INFO] Daily stats reset for new day");
}

void checkDailyReset() {
  time_t now;
  time(&now);
  struct tm* timeinfo = localtime(&now);
  int today = timeinfo->tm_yday;
  
  if (today != dailyStats.dayOfYear && dailyStats.dayOfYear >= 0) {
    uploadDailySummary();
    resetDailyStats(today);
  }
}

void uploadDailySummary() {
  if (!wifiConnected || !timeInitialized) return;
  
  Serial.println("[INFO] Uploading daily summary...");

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/daily_summaries";
  
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  // Get yesterday's date
  time_t now;
  time(&now);
  now -= 86400;
  char dateStr[12];
  strftime(dateStr, sizeof(dateStr), "%Y-%m-%d", localtime(&now));

  StaticJsonDocument<256> doc;
  doc["date"] = dateStr;             // Renamed from summary_date
  doc["total_cycles"] = dailyStats.totalCycles;
  doc["total_gallons"] = dailyStats.totalGallonsPumped;
  doc["max_water_level"] = dailyStats.maxWaterLevel;
  
  // REMOVED: total_runtime_minutes (No column in daily_summaries)
  // REMOVED: min_water_level (Table has min_battery_voltage instead)

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  
  if (httpCode == 201 || httpCode == 200) {
    Serial.println("[OK] Daily summary uploaded");
  } else {
    Serial.printf("[ERROR] Daily summary upload failed: %d\n", httpCode);
  }
  
  http.end();
}



// ============================================================================
// WIFI AND TIME
// ============================================================================

void connectWiFi() {
  Serial.printf("[..] Connecting to WiFi: %s", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.printf("[OK] WiFi connected - IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    wifiConnected = false;
    Serial.println();
    Serial.println("[WARN] WiFi connection failed - will retry");
  }
}

void initializeTime() {
  Serial.println("[..] Syncing time via NTP...");
  
  // Offset for EST (Virginia) is -18000 seconds (-5 hours)
  // DST offset is 3600 seconds
  configTime(-18000, 3600, "pool.ntp.org", "time.nist.gov");
  
  time_t now = 0;
  int attempts = 0;
  while (now < 1000000000 && attempts < 20) {
    delay(500);
    time(&now);
    attempts++;
  }
  
  if (now > 1000000000) {
    timeInitialized = true;
    struct tm* timeinfo = localtime(&now);
    Serial.printf("[OK] Time: %04d-%02d-%02d %02d:%02d:%02d\n",
      timeinfo->tm_year + 1900, timeinfo->tm_mon + 1, timeinfo->tm_mday,
      timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec);
    lastNtpSync = millis();
  } else {
    Serial.println("[WARN] NTP sync failed - will retry");
  }
}
