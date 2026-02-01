# Sump Pump Monitoring System

A complete IoT solution for monitoring residential sump pumps with real-time web dashboard.

## Features

- Real-time water level monitoring via eTape resistive sensor
- 12V backup battery voltage monitoring
- AC power outage detection
- Backup pump alarm integration (PS-C22 controller)
- Cloud data logging to Supabase
- Web dashboard with historical charts
- Daily statistics tracking (pump cycles, gallons pumped)
- Self-calibrating sensor (learns from pump cycles)
- Mobile-responsive design

## Components

- **ESP32-S2 Firmware** (`/arduino`) - Sensor reading and data upload
- **Next.js Dashboard** (`/app`) - Real-time monitoring UI

---

## Web Dashboard

### Dashboard Features

- Live water level display with trend chart
- Time range selector (1h, 6h, 12h, 24h)
- Full-screen chart mode for wall-mounted displays
- Battery voltage and AC power status indicators
- Daily pump cycles and gallons counter
- Recent events log
- Mobile-responsive design

### Statistics Page (`/stats`)

- Weekly view with daily cycles/gallons bar chart
- Monthly heatmap showing pump activity
- All-time records (busiest day, total gallons)
- Recent system events

### Deployment (Vercel)

1. Fork this repository
2. Create a [Vercel](https://vercel.com) account and import the repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
4. Deploy

### Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

---

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

---

## Calibration

### Self-Calibrating Mode (Recommended)

The sensor automatically learns calibration values from pump cycles:

- Records resistance when pump starts (high water point, ~4.5")
- Records resistance when pump stops (low water point, ~0")
- Uses rolling average of last 10 cycles for stability
- Values persist in flash memory across reboots

Initial default values are used until the system learns from actual pump cycles. No manual calibration required for most installations.

### Manual Calibration (Optional)

If you need manual calibration or want to set initial values:

1. **Measure empty resistance**: With eTape completely dry, watch the Serial monitor for the resistance reading. Update `DEFAULT_EMPTY_RESISTANCE`.

2. **Measure trigger resistance**: Submerge eTape to your pump trigger level (~4.5") and note the resistance. Update `DEFAULT_TRIGGER_RESISTANCE`.

```cpp
// Default calibration values (overwritten by self-learning)
#define DEFAULT_EMPTY_RESISTANCE 1828.0   // Resistance at 0"
#define DEFAULT_TRIGGER_RESISTANCE 1237.0 // Resistance at pump trigger level
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

---

## Configuration

### WiFi

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### Supabase

```cpp
const char* SUPABASE_URL = "YOUR_SUPABASE_URL";
const char* SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

### Alert Thresholds

```cpp
#define HIGH_WATER_THRESHOLD 6.0        // Inches - high water alert
#define LOW_BATTERY_THRESHOLD 11.5      // Volts - low battery alert
#define AC_POWER_THRESHOLD 1000         // ADC counts for AC detection
#define MAX_PUMP_RUNTIME_SEC 300        // Long pump run alert (seconds)
```

### Pump Detection Tuning

If pump detection is too sensitive or not sensitive enough:

```cpp
#define PUMP_DETECT_DROP_RATE 0.2       // Water drop rate to detect pump start
#define PUMP_STOP_DROP_RATE 0.05        // Water drop rate to detect pump stop
```

---

## Supabase Setup

Create a new Supabase project and add these tables:

### readings

```sql
create table readings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  water_level_inches float,
  battery_voltage float,
  backup_alarm_active boolean,
  ac_power_on boolean,
  pump_running boolean,
  wifi_rssi integer
);
```

### events

```sql
create table events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  event_type text,
  message text,
  water_level_inches float,
  battery_voltage float,
  ac_power_on boolean
);
```

### daily_summaries

```sql
create table daily_summaries (
  id uuid default gen_random_uuid() primary key,
  date date unique,
  total_cycles integer,
  total_gallons float,
  max_water_level float
);
```

---

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

  [CAL] Empty: 1825 ohms (10 samples) | Trigger: 1241 ohms (8 samples)
```

The `[CAL]` line shows learned calibration values and sample counts.

---

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
| `sensor_error` | ADC reading out of range |
| `sensor_restored` | ADC reading returned to normal |

---

## Offline Operation

When WiFi is unavailable:
- Readings are buffered locally (up to 100)
- WiFi reconnection attempted every 30 seconds
- Buffered readings uploaded when connection restored
- Calibration values persist in flash memory

---

## Arduino IDE Setup

1. Install ESP32 board support (add URL to preferences):
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

2. Select board: **ESP32S2 Dev Module**

3. Install libraries via Library Manager:
   - **Adafruit ADS1X15** (by Adafruit)
   - **ArduinoJson** (by Benoit Blanchon)

4. Update WiFi credentials, Supabase credentials, and pit geometry values

5. Upload to ESP32-S2

---

## License

MIT License - feel free to use and modify for your own sump pump monitoring needs.
