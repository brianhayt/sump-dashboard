# Sump Pump Monitoring System

ESP32-S2 firmware for monitoring sump pump systems with Supabase cloud logging.

## Hardware

- **Sparkfun ESP32-S2 Thing Plus**
- **ADS1115** 16-bit ADC (I2C)
- **eTape** resistive water level sensor
- **PS-C22** backup pump controller (dry contact via optocoupler)
- **USB wall wart** for AC power detection
- **12V marine battery** with voltage divider

## Wiring

### Pin Assignments

| Function | Pin | Notes |
|----------|-----|-------|
| I2C SDA | GPIO 8 | To ADS1115 SDA |
| I2C SCL | GPIO 10 | To ADS1115 SCL |
| AC Power | GPIO 4 | From USB wall wart voltage divider |
| Backup Alarm | GPIO 6 | From PS-C22 optocoupler output |

### ADS1115 Connections

| ADS1115 Pin | Connection |
|-------------|------------|
| VDD | 3.3V |
| GND | GND |
| SDA | GPIO 8 |
| SCL | GPIO 10 |
| ADDR | GND (sets address to 0x48) |
| A0 | eTape voltage divider output |
| A1 | Battery voltage divider output |

### eTape Circuit

```
3.3V ──[990Ω Series Resistor]──┬──[eTape]── GND
                               │
                               └── ADS1115 A0
```

### Battery Voltage Divider

```
12V Battery+ ──[4.7kΩ]──┬──[10kΩ]── GND
                        │
                        └── ADS1115 A1
```

### AC Power Detection

```
USB Wall Wart 5V ──[10kΩ]──┬──[10kΩ]── GND
                           │
                           └── GPIO 4
```

### PS-C22 Optocoupler Circuit

```
PS-C22 Remote Terminal (+) ──[470Ω]── PC817 Pin 1
PS-C22 Remote Terminal (-) ────────── PC817 Pin 2

3.3V ───────────────────────────────── PC817 Pin 4
GPIO 6 ──┬─────────────────────────── PC817 Pin 3
         │
      [10kΩ]
         │
        GND
```

## Calibration

### eTape Calibration

The eTape sensor resistance changes with water level. You need to calibrate for your specific sensor.

1. **Measure empty resistance**: With eTape completely dry, watch the Serial monitor for the resistance reading (shown in parentheses after water level). Update `ETAPE_EMPTY_RESISTANCE`.

2. **Measure full resistance**: Submerge eTape to its maximum line and note the resistance. Update `ETAPE_FULL_RESISTANCE`.

3. **Measure sensor length**: Measure the active sensing area of your eTape in inches. Update `ETAPE_LENGTH_INCHES`.

4. **Measure series resistor**: Use a multimeter to measure your actual series resistor. Update `SERIES_RESISTOR`.

```cpp
// eTape Calibration - UPDATE THESE VALUES
#define SERIES_RESISTOR 990.0           // Measure your actual resistor
#define ETAPE_EMPTY_RESISTANCE 1800.0   // Resistance when dry
#define ETAPE_FULL_RESISTANCE 473.0     // Resistance when fully submerged  
#define ETAPE_LENGTH_INCHES 12.4        // Active sensing length
```

### Pit Geometry Calibration

For accurate gallons-pumped calculations:

1. Measure your pit's interior length and width in inches
2. Multiply: `length × width × 0.85` (0.85 accounts for pumps/pipes)
3. Calculate gallons per inch: `pit_area / 231`

```cpp
// Pit Geometry - UPDATE THESE VALUES
#define PIT_AREA_SQ_INCHES 352.0        // Your pit area calculation
#define GALLONS_PER_INCH 1.52           // PIT_AREA_SQ_INCHES / 231
```

### Battery Divider Calibration

If your battery voltage readings are inaccurate:

1. Measure actual battery voltage with a multimeter
2. Note the voltage shown at ADS1115 A1 (or calculate from ADC reading)
3. Calculate ratio: `measured_adc_voltage / actual_battery_voltage`
4. Update `BATTERY_DIVIDER_RATIO`

```cpp
#define BATTERY_DIVIDER_RATIO 0.32      // Vout / Vbattery
```

## Configuration

### WiFi

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### Alert Thresholds

```cpp
#define HIGH_WATER_THRESHOLD 10.0       // Inches - high water alert
#define LOW_BATTERY_THRESHOLD 11.5      // Volts - low battery alert
#define AC_POWER_THRESHOLD 1000         // ADC counts for AC detection
#define MAX_PUMP_RUNTIME_SEC 300        // Long pump run alert (seconds)
```

### Pump Detection Tuning

If pump detection is too sensitive or not sensitive enough:

```cpp
#define PUMP_DETECT_DROP_RATE 0.5       // Water drop rate to detect pump start
#define PUMP_STOP_DROP_RATE 0.1         // Water drop rate to detect pump stop
```

## Supabase Setup

Your Supabase project needs these tables:

### readings
```sql
create table readings (
  id uuid default gen_random_uuid() primary key,
  recorded_at timestamptz default now(),
  water_level_inches float,
  battery_voltage float,
  backup_alarm_active boolean,
  ac_power_present boolean,
  pump_running boolean,
  daily_runtime_minutes float,
  daily_cycles integer,
  daily_gallons float,
  is_buffered boolean default false
);
```

### events
```sql
create table events (
  id uuid default gen_random_uuid() primary key,
  occurred_at timestamptz default now(),
  event_type text,
  value float,
  water_level_inches float,
  battery_voltage float,
  ac_power_present boolean
);
```

### daily_summaries
```sql
create table daily_summaries (
  id uuid default gen_random_uuid() primary key,
  summary_date date unique,
  total_cycles integer,
  total_runtime_minutes float,
  total_gallons float,
  max_water_level float,
  min_water_level float
);
```

## Serial Monitor Output

The system prints status every 5 seconds:

```
----------------------------------------------
STATUS: NORMAL - All systems OK

  Water Level:    3.45" (892 ohms)
  Battery:        12.8 V
  AC Power:       ON
  Backup Alarm:   Normal
  Pump Running:   No

  Daily Cycles:   12
  Daily Gallons:  45.2 gal
  Daily Runtime:  8.3 min
  WiFi:           Connected
  Supabase:       Ready
```

The resistance reading in parentheses is useful for calibration.

## Event Types

| Event | Trigger |
|-------|---------|
| `pump_cycle_start` | Water level dropping rapidly |
| `pump_cycle_end` | Water level stabilized |
| `backup_alarm_on` | PS-C22 alarm activated |
| `backup_alarm_off` | PS-C22 alarm cleared |
| `power_outage` | AC power lost |
| `power_restored` | AC power returned |
| `high_water` | Water > HIGH_WATER_THRESHOLD |
| `low_battery` | Battery < LOW_BATTERY_THRESHOLD |
| `long_pump_run` | Pump running > MAX_PUMP_RUNTIME_SEC |

## Offline Operation

When WiFi is unavailable:
- Readings are buffered locally (up to 100)
- WiFi reconnection attempted every 30 seconds  
- Buffered readings uploaded when connection restored

## Arduino IDE Setup

1. Install ESP32 board support (add URL to preferences):
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

2. Select board: **ESP32S2 Dev Module**

3. Install libraries via Library Manager:
   - **Adafruit ADS1X15** (by Adafruit)
   - **ArduinoJson** (by Benoit Blanchon)

4. Update WiFi credentials and calibration values

5. Upload to ESP32-S2
