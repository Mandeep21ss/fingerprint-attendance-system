# ESP32 Offline Troubleshooting Guide

## Why Device Shows "Offline"

The backend backend works correctly. The issue is the **ESP32 is not polling** the backend every 3 seconds as expected.

Device status depends on:
- ✅ Backend `/api/device/mode` endpoint: **WORKING** (verified)
- ✅ Device timeout logic: **WORKING** (shows online when polls arrive)
- ❌ ESP32 polling the backend: **NOT HAPPENING** (likely cause)

---

## Checklist: Why ESP32 Isn't Polling

### 1. **Is the ESP32 Powered On?**
- Check if the board has power indicator LED
- If not powered, immediately resolve this first
- The board needs USB power or external 5V supply

### 2. **WiFi Connection Issues**
```
Firmware credentials:
- SSID:     "BrightKids_2.4G"  
- Password: "Gurukul_Edutech"
```

**Check:**
- [ ] ESP32 can detect "BrightKids_2.4G" network
- [ ] WiFi password is exactly correct
- [ ] Router is broadcasting at 2.4GHz (not 5GHz only)
- [ ] ESP32 is within range

**How to verify WiFi:**
- Connect USB cable to ESP32
- Open Arduino Serial Monitor (115200 baud)
- Look for `✅ WiFi connected! IP: 192.168.x.x` message
- If you see `❌ WiFi connection failed!` → WiFi credentials are wrong

### 3. **WiFi Credentials Are Wrong**
If WiFi fails, you need to update the firmware:

In `esp32/fingerprint_attendance/fingerprint_attendance.ino`, change:
```cpp
const char* WIFI_SSID     = "YOUR_NETWORK_NAME";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
```

Then re-upload to ESP32 via Arduino IDE.

### 4. **HTTPS Certificate Issues**
ESP32 needs accurate time for HTTPS to work:
- Opens `https://fingerprint-attendance-system-6b1s.onrender.com`
- Syncs time from NTP servers
- If NTP fails, HTTPS certificate validation fails

**Check Serial output:**
- Look for `⏳ NTP time sync — OK` message
- If stuck on dots (........), NTP is timing out

**Solution:** Check if ESP32 has internet access (can reach NTP servers)

### 5. **Backend URL Mismatch**
Currently configured to: `https://fingerprint-attendance-system-6b1s.onrender.com`

**Check if correct:**
- ✅ Backend is deployed at this URL
- ✅ Backend is running (`/api/health` returns success)
- ✅ No typos in the URL

### 6. **Serial Monitor Inspection**
The BEST way to debug - watch what ESP32 is actually doing:

1. Connect ESP32 to laptop via USB
2. Open Arduino IDE → Tools → Serial Monitor
3. Set baud rate to **115200**
4. Look for these messages:

**Good output:**
```
✅ R305 Fingerprint sensor detected!
📡 Connecting to WiFi: BrightKids_2.4G
✅ WiFi connected! IP: 192.168.1.X
⏳ NTP time sync — OK
🔍 Waiting for fingerprint...
```

**Bad output (examples):**
```
❌ WiFi connection failed! Running in offline mode.
  → WiFi credentials wrong
  
❌ R305 Fingerprint sensor NOT found.
  → Sensor wiring issue (not related to offline status)
```

---

## How to Verify Everything Works

### Method 1: With Physical ESP32 (BEST)
1. Power on ESP32
2. Wait 30 seconds for WiFi + NTP sync
3. Refresh frontend in browser
4. Device should show **Online** (within 5 seconds)

### Method 2: Simulate ESP32 (For Testing)
Run the simulator script:
```bash
node test-esp32-polling.js
```

Then immediately refresh frontend. Device should show online for ~5-10 seconds.

### Method 3: Manual Backend Check
```bash
node check-device-status.js
```

Shows `isOnline: true/false` based on last poll timestamp.

---

## Quick Fix Checklist

- [ ] ESP32 is powered on
- [ ] ESP32 shows `✅ WiFi connected!` in Serial Monitor
- [ ] WiFi is 2.4GHz (not 5GHz only)
- [ ] Backend is running (`https://fingerprint-attendance-system-6b1s.onrender.com/api/health`)
- [ ] Frontend URL is correct in Render `CLIENT_URL` env var
- [ ] No firewall blocking port 443 (HTTPS)

---

## Still Offline? Debug Steps

1. **Check Serial Monitor output**
   - Does it say WiFi connected?
   - Does it say NTP sync OK?

2. **If WiFi fails:**
   - Update WiFi credentials in firmware
   - Re-upload to ESP32
   - Restart ESP32

3. **If WiFi works but backend unreachable:**
   - Test backend manually: `node test-esp32-polling.js`
   - Check Render backend logs for errors
   - Verify `CLIENT_URL` is set on Render

4. **If still stuck:**
   - Check ESP32 has internet (can reach google.com)
   - Check firewall settings
   - Try HTTP instead of HTTPS (change firmware URL)
