/*
 * ============================================================
 *  ESP32 + R305 Fingerprint Attendance System
 *  With Remote Mode Control from Web Dashboard
 * ============================================================
 *  Hardware Connections:
 *    R305 TX  → ESP32 GPIO16 (RX2)
 *    R305 RX  → ESP32 GPIO17 (TX2)
 *    R305 VCC → 3.3V
 *    R305 GND → GND
 *
 *  Required Libraries (install via Arduino Library Manager):
 *    1. Adafruit Fingerprint Sensor Library
 *    2. ArduinoJson (v6+)
 *    3. HTTPClient (built-in with ESP32 core)
 *
 *  Board: ESP32 Dev Module
 * ============================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <time.h>
#include <string.h>

// ──────────────────── CONFIGURATION ────────────────────
// WiFi — set your network credentials (do not commit real secrets to a public repo)
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend base URL — no trailing slash.
// LAN (same WiFi as ESP32): "http://192.168.1.50:5000"
// Hosted API (HTTPS):      "https://your-service.onrender.com"
// const char* SERVER_BASE = "https://fingerprint-attendance-system-6b1s.onrender.com";
const char* SERVER_BASE = "http://192.168.1.100:5000";

// Name sent in JSON field "device" on each attendance POST (shown in dashboard / logs)
const char* DEVICE_ATTENDANCE_LABEL = "ESP32-01";

// If HTTPS fails with certificate errors after NTP, set to 1 (disables TLS verification — use only if needed)
#ifndef ESP32_HTTPS_INSECURE
#define ESP32_HTTPS_INSECURE 0
#endif

WiFiClientSecure gWifiClientSecure;

static bool serverUsesHttps() {
  return strncmp(SERVER_BASE, "https://", 8) == 0;
}

// TLS needs valid time for certificate verification
void syncClockFromNtp() {
  if (!serverUsesHttps()) return;

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("⏳ NTP time sync");
  for (int i = 0; i < 40; i++) {
    struct tm ti;
    if (getLocalTime(&ti)) {
      Serial.println(" — OK");
      return;
    }
    Serial.print(".");
    delay(250);
  }
  Serial.println(" — timeout (HTTPS may fail until time is valid)");
}

void beginHttpForUrl(HTTPClient& http, const String& fullUrl) {
  if (fullUrl.startsWith("https://")) {
#if ESP32_HTTPS_INSECURE
    gWifiClientSecure.setInsecure();
#endif
    http.begin(gWifiClientSecure, fullUrl);
  } else {
    http.begin(fullUrl);
  }
}

// ──────────────────── PIN DEFINITIONS ────────────────────
#define FINGERPRINT_RX 16   // ESP32 RX2 ← R305 TX (green wire)
#define FINGERPRINT_TX 17   // ESP32 TX2 → R305 RX (white wire)
#define LED_SUCCESS    2    // Built-in LED (GPIO2) for success
#define BUZZER_PIN     4    // Optional buzzer pin

// ──────────────────── GLOBALS ────────────────────
HardwareSerial mySerial(2);                          // UART2
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

unsigned long lastScanTime    = 0;
unsigned long lastPollTime    = 0;
const unsigned long SCAN_INTERVAL = 2000;   // Min 2s between scans
const unsigned long POLL_INTERVAL = 3000;   // Poll server every 3s

// Mode control — can be changed via Serial OR from web dashboard
String currentMode    = "attend";   // "attend" or "enroll"
int    enrollId       = -1;         // Fingerprint ID to enroll
String enrollName     = "";         // Student name (from web)
bool   modeFromWeb    = false;      // True if mode was set from web

unsigned long lastWifiReconnectAttempt = 0;

// ──────────────────── SETUP ────────────────────
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println();
  Serial.println("╔══════════════════════════════════════════════╗");
  Serial.println("║  Fingerprint Attendance System v2.0          ║");
  Serial.println("║  ESP32 + R305 — Web Remote Control           ║");
  Serial.println("╚══════════════════════════════════════════════╝");
  Serial.println();

  // Configure pins
  pinMode(LED_SUCCESS, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_SUCCESS, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Initialize fingerprint sensor on UART2
  mySerial.begin(57600, SERIAL_8N1, FINGERPRINT_RX, FINGERPRINT_TX);
  finger.begin(57600);

  if (finger.verifyPassword()) {
    Serial.println("✅ R305 Fingerprint sensor detected!");
  } else {
    Serial.println("❌ Fingerprint sensor NOT found. Check wiring!");
    while (1) { delay(1); }  // Halt
  }

  // Print sensor parameters
  Serial.println("──────────────────────────────────");
  finger.getParameters();
  Serial.print("   Sensor capacity : "); Serial.println(finger.capacity);
  Serial.print("   Security level  : "); Serial.println(finger.security_level);
  Serial.print("   Stored templates: "); Serial.println(finger.templateCount);
  Serial.println("──────────────────────────────────");

  // Connect to WiFi
  connectWiFi();

  Serial.println();
  Serial.println("📌 Commands (via Serial Monitor):");
  Serial.println("   ENROLL <id>  — Start enrollment for fingerprint ID");
  Serial.println("   ATTEND       — Switch to attendance mode (default)");
  Serial.println("   DELETE <id>  — Delete a stored fingerprint");
  Serial.println("   COUNT        — Show stored fingerprint count");
  Serial.println("──────────────────────────────────");
  Serial.println("📡 Mode can also be changed from Web Dashboard!");
  Serial.println("🔍 Waiting for fingerprint...");
}

// ──────────────────── MAIN LOOP ────────────────────
void loop() {
  maintainWifi();

  // Check for serial commands (local override)
  handleSerialCommands();

  // Poll server for mode changes from web dashboard
  if (millis() - lastPollTime >= POLL_INTERVAL) {
    lastPollTime = millis();
    pollServerForMode();
  }

  // Handle enrollment mode
  if (currentMode == "enroll" && enrollId > 0) {
    enrollFingerprint(enrollId);
    return;
  }

  // Attendance mode — scan for fingerprints
  if (currentMode == "attend") {
    if (millis() - lastScanTime >= SCAN_INTERVAL) {
      lastScanTime = millis();
      int fingerprintId = scanFingerprint();

      if (fingerprintId > 0) {
        Serial.print("✅ Fingerprint matched! ID: ");
        Serial.println(fingerprintId);

        // Visual + audio feedback
        successFeedback();

        // Send attendance to backend
        sendAttendance(fingerprintId);
      }
    }
  }
}

// ──────────────────── POLL SERVER FOR MODE + COMMANDS ────────────────────
void pollServerForMode() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/device/mode";
  beginHttpForUrl(http, url);
  http.setTimeout(3000);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();
    
    StaticJsonDocument<512> doc;  // Larger buffer for command data
    DeserializationError err = deserializeJson(doc, response);
    
    if (!err) {
      String serverMode = doc["mode"].as<String>();
      int serverEnrollId = doc["enrollId"] | -1;
      String serverEnrollName = doc["enrollName"] | "";

      // ── Handle mode changes from web ──
      if (serverMode == "enroll" && serverEnrollId > 0) {
        if (currentMode != "enroll" || enrollId != serverEnrollId) {
          currentMode = "enroll";
          enrollId = serverEnrollId;
          enrollName = serverEnrollName;
          modeFromWeb = true;

          Serial.println();
          Serial.println("╔═══════════════════════════════════════╗");
          Serial.println("║  🌐 MODE CHANGED FROM WEB DASHBOARD  ║");
          Serial.println("╠═══════════════════════════════════════╣");
          Serial.print("║  Mode: ENROLL  |  ID #");
          Serial.println(enrollId);
          if (enrollName.length() > 0) {
            Serial.print("║  Student: ");
            Serial.println(enrollName);
          }
          Serial.println("╚═══════════════════════════════════════╝");
          Serial.println("👆 Place finger on sensor to enroll...");
        }
      } else if (serverMode == "attend") {
        if (currentMode != "attend") {
          currentMode = "attend";
          enrollId = -1;
          modeFromWeb = true;

          Serial.println();
          Serial.println("🌐 Web Dashboard → Switched to ATTENDANCE mode");
          Serial.println("🔍 Waiting for fingerprint...");
        }
      }

      // ── Handle pending commands from web dashboard ──
      if (doc.containsKey("command")) {
        String cmdType = doc["command"]["type"].as<String>();
        int cmdId = doc["command"]["id"] | -1;

        if (cmdType == "delete") {
          Serial.println();
          Serial.print("🌐 Web Command: DELETE fingerprint ID #");
          Serial.println(cmdId);

          if (cmdId > 0 && cmdId < 128) {
            uint8_t result = finger.deleteModel(cmdId);
            if (result == FINGERPRINT_OK) {
              Serial.println("   ✅ Fingerprint deleted successfully");
              successFeedback();
              sendCommandResult("delete_complete", "Deleted fingerprint ID #" + String(cmdId), cmdId);
            } else {
              Serial.println("   ❌ Failed to delete fingerprint");
              errorFeedback();
              sendCommandResult("delete_failed", "Failed to delete ID #" + String(cmdId), cmdId);
            }
          } else {
            Serial.println("   ❌ Invalid ID for delete");
            sendCommandResult("delete_failed", "Invalid fingerprint ID", cmdId);
          }
        }
        else if (cmdType == "count") {
          Serial.println();
          Serial.println("🌐 Web Command: COUNT stored fingerprints");
          finger.getTemplateCount();
          Serial.print("   📊 Stored fingerprints: ");
          Serial.println(finger.templateCount);
          sendCommandResult("count_result", String(finger.templateCount), finger.templateCount);
        }
        else if (cmdType == "empty") {
          Serial.println();
          Serial.println("🌐 Web Command: EMPTY sensor database");
          uint8_t result = finger.emptyDatabase();
          if (result == FINGERPRINT_OK) {
            Serial.println("   ✅ All fingerprints deleted from sensor");
            successFeedback();
            sendCommandResult("empty_complete", "All fingerprints deleted from sensor", 0);
          } else {
            Serial.println("   ❌ Failed to empty sensor database");
            errorFeedback();
            sendCommandResult("empty_failed", "Failed to empty sensor database", 0);
          }
        }
        else {
          Serial.print("   ❓ Unknown web command: ");
          Serial.println(cmdType);
        }
      }
    }
  }

  http.end();
}

// ──────────────────── SEND ACK TO SERVER ────────────────────
void sendAckToServer(String status, String message) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/device/ack";
  beginHttpForUrl(http, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);

  StaticJsonDocument<256> doc;
  doc["mode"] = currentMode;
  doc["status"] = status;
  doc["message"] = message;

  String payload;
  serializeJson(doc, payload);

  http.POST(payload);
  http.end();
}

// ──────────────────── SEND COMMAND RESULT TO SERVER ────────────────────
void sendCommandResult(String status, String message, int data) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/device/ack";
  beginHttpForUrl(http, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);

  StaticJsonDocument<256> doc;
  doc["mode"] = currentMode;
  doc["status"] = status;
  doc["message"] = message;
  doc["data"] = data;

  String payload;
  serializeJson(doc, payload);

  Serial.print("📤 Sending result → ");
  Serial.println(payload);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.println("   ✅ Server acknowledged");
  } else {
    Serial.print("   ❌ Failed to send: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// ──────────────────── WiFi CONNECTION ────────────────────
void connectWiFi() {
  Serial.print("📡 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("✅ WiFi connected! IP: ");
    Serial.println(WiFi.localIP());
    if (serverUsesHttps()) {
      syncClockFromNtp();
    }
  } else {
    Serial.println();
    Serial.println("❌ WiFi connection failed! Running in offline mode.");
  }
}

// Retry WiFi periodically when dropped (router restarts, weak signal)
void maintainWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiReconnectAttempt < 20000) return;
  lastWifiReconnectAttempt = millis();
  Serial.println("📡 WiFi disconnected — reconnecting...");
  WiFi.disconnect(false);
  delay(200);
  connectWiFi();
}

// ──────────────────── FINGERPRINT SCANNING ────────────────────
int scanFingerprint() {
  uint8_t result = finger.getImage();
  if (result != FINGERPRINT_OK) return -1;  // No finger detected

  result = finger.image2Tz();
  if (result != FINGERPRINT_OK) {
    Serial.println("⚠️  Image conversion failed");
    return -1;
  }

  result = finger.fingerSearch();
  if (result != FINGERPRINT_OK) {
    Serial.println("⚠️  No match found");
    errorFeedback();
    return -1;
  }

  Serial.print("   Match confidence: ");
  Serial.println(finger.confidence);
  return finger.fingerID;
}

// ──────────────────── SEND ATTENDANCE (HTTP POST) ────────────────────
void sendAttendance(int fingerprintId) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected. Reconnecting...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("❌ Cannot send attendance — no WiFi.");
      return;
    }
  }

  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/attendance";
  beginHttpForUrl(http, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["fingerprintId"] = fingerprintId;
  doc["status"]        = "present";
  doc["device"]        = DEVICE_ATTENDANCE_LABEL;

  String payload;
  serializeJson(doc, payload);

  Serial.print("📤 Sending attendance → ");
  Serial.println(payload);

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("📥 Server response (");
    Serial.print(httpCode);
    Serial.print("): ");
    Serial.println(response);

    if (httpCode == 200 || httpCode == 201) {
      Serial.println("✅ Attendance recorded successfully!");
    } else {
      Serial.println("⚠️  Server returned an error.");
    }
  } else {
    Serial.print("❌ HTTP error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// ──────────────────── FINGERPRINT ENROLLMENT ────────────────────
void enrollFingerprint(int id) {
  Serial.print("📝 Enrolling fingerprint at ID #");
  Serial.println(id);
  if (enrollName.length() > 0) {
    Serial.print("   Student: ");
    Serial.println(enrollName);
  }

  // ── Step 1: Tell web to show "Place your finger" ──
  Serial.println("   Place your finger on the sensor...");
  sendAckToServer("enroll_place_finger", "Place your finger on the sensor");

  int result = -1;
  unsigned long startTime = millis();
  unsigned long timeout = 60000;  // 60 second timeout (more time for user)

  while (result != FINGERPRINT_OK) {
    result = finger.getImage();
    if (result == FINGERPRINT_OK) {
      Serial.println("   ✅ Image captured (1/2)");
    } else if (result == FINGERPRINT_NOFINGER) {
      if (millis() - startTime > timeout) {
        Serial.println("   ⏰ Enrollment timed out.");
        sendAckToServer("enroll_failed", "Enrollment timed out — no finger detected");
        enrollId = -1;
        return;
      }
      delay(100);
    } else {
      Serial.println("   ❌ Imaging error");
      sendAckToServer("enroll_failed", "Sensor imaging error");
      enrollId = -1;
      return;
    }
  }

  result = finger.image2Tz(1);
  if (result != FINGERPRINT_OK) {
    Serial.println("   ❌ Template conversion failed (1/2)");
    sendAckToServer("enroll_failed", "Failed to process fingerprint image");
    enrollId = -1;
    return;
  }

  // ── Step 2: Tell web "First scan done, remove finger" ──
  Serial.println("   ✅ First scan captured!");
  sendAckToServer("enroll_captured_1", "First scan captured successfully");

  delay(500);

  Serial.println("   ✋ Remove your finger...");
  sendAckToServer("enroll_remove_finger", "Remove your finger from the sensor");

  delay(1500);
  while (finger.getImage() != FINGERPRINT_NOFINGER) { delay(100); }

  // ── Step 3: Tell web "Place the same finger again" ──
  Serial.println("   👆 Place the SAME finger again...");
  sendAckToServer("enroll_place_again", "Place the SAME finger again");

  // Wait for second image
  result = -1;
  startTime = millis();
  while (result != FINGERPRINT_OK) {
    result = finger.getImage();
    if (result == FINGERPRINT_OK) {
      Serial.println("   ✅ Image captured (2/2)");
    } else if (result == FINGERPRINT_NOFINGER) {
      if (millis() - startTime > timeout) {
        Serial.println("   ⏰ Enrollment timed out on second scan.");
        sendAckToServer("enroll_failed", "Timed out waiting for second scan");
        enrollId = -1;
        return;
      }
      delay(100);
    } else {
      Serial.println("   ❌ Imaging error on second scan");
      sendAckToServer("enroll_failed", "Sensor error on second scan");
      enrollId = -1;
      return;
    }
  }

  // ── Step 4: Tell web "Second scan captured, processing..." ──
  Serial.println("   ✅ Second scan captured!");
  sendAckToServer("enroll_captured_2", "Second scan captured successfully");

  result = finger.image2Tz(2);
  if (result != FINGERPRINT_OK) {
    Serial.println("   ❌ Template conversion failed (2/2)");
    sendAckToServer("enroll_failed", "Failed to process second fingerprint image");
    enrollId = -1;
    return;
  }

  // ── Step 5: Creating model ──
  Serial.println("   ⚙️ Processing fingerprint...");
  sendAckToServer("enroll_processing", "Creating fingerprint model...");

  result = finger.createModel();
  if (result != FINGERPRINT_OK) {
    Serial.println("   ❌ Fingerprints did not match!");
    sendAckToServer("enroll_failed", "Fingerprints did not match — try again");
    enrollId = -1;
    return;
  }

  // ── Step 6: Store model ──
  result = finger.storeModel(id);
  if (result == FINGERPRINT_OK) {
    Serial.print("   ✅ Fingerprint enrolled at ID #");
    Serial.println(id);
    successFeedback();

    String msg = "Enrolled ID #" + String(id);
    if (enrollName.length() > 0) {
      msg += " for " + enrollName;
    }
    sendAckToServer("enroll_complete", msg);
  } else {
    Serial.println("   ❌ Failed to store fingerprint!");
    errorFeedback();
    sendAckToServer("enroll_failed", "Failed to store in sensor memory");
  }

  // Stay in enroll mode — don't auto-switch!
  // User will manually switch via web dashboard when done enrolling.
  enrollId = -1;
  enrollName = "";
  Serial.println("📝 Ready for next enrollment (select student from web)...");
}

// ──────────────────── DELETE FINGERPRINT ────────────────────
void deleteFingerprint(int id) {
  uint8_t result = finger.deleteModel(id);
  if (result == FINGERPRINT_OK) {
    Serial.print("✅ Deleted fingerprint ID #");
    Serial.println(id);
  } else {
    Serial.print("❌ Failed to delete ID #");
    Serial.println(id);
  }
}

// ──────────────────── SERIAL COMMANDS ────────────────────
void handleSerialCommands() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();

    if (cmd.startsWith("ENROLL")) {
      int id = cmd.substring(7).toInt();
      if (id > 0 && id < 128) {
        currentMode = "enroll";
        enrollId = id;
        enrollName = "";
        modeFromWeb = false;
        Serial.print("📝 Entering enrollment mode for ID #");
        Serial.println(id);
      } else {
        Serial.println("❌ Invalid ID. Use: ENROLL <1-127>");
      }
    }
    else if (cmd == "ATTEND") {
      currentMode = "attend";
      enrollId = -1;
      modeFromWeb = false;
      Serial.println("🔍 Switched to attendance mode.");
    }
    else if (cmd.startsWith("DELETE")) {
      int id = cmd.substring(7).toInt();
      if (id > 0 && id < 128) {
        deleteFingerprint(id);
      } else {
        Serial.println("❌ Invalid ID. Use: DELETE <1-127>");
      }
    }
    else if (cmd == "COUNT") {
      finger.getTemplateCount();
      Serial.print("📊 Stored fingerprints: ");
      Serial.println(finger.templateCount);
    }
    else if (cmd == "STATUS") {
      Serial.println("──────────────────────────────────");
      Serial.print("   API base   : "); Serial.println(SERVER_BASE);
      Serial.print("   HTTPS      : "); Serial.println(serverUsesHttps() ? "Yes" : "No");
      Serial.print("   Device tag : "); Serial.println(DEVICE_ATTENDANCE_LABEL);
      Serial.print("   Mode       : "); Serial.println(currentMode);
      Serial.print("   Enroll ID  : "); Serial.println(enrollId);
      Serial.print("   WiFi       : "); Serial.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
      Serial.print("   IP         : "); Serial.println(WiFi.localIP());
      Serial.print("   Web control: "); Serial.println(modeFromWeb ? "Yes" : "No");
      Serial.println("──────────────────────────────────");
    }
    else if (cmd == "HELP") {
      Serial.println("📌 Commands:");
      Serial.println("   ENROLL <id>  — Enroll fingerprint");
      Serial.println("   ATTEND       — Attendance mode");
      Serial.println("   DELETE <id>  — Delete fingerprint");
      Serial.println("   COUNT        — Show stored count");
      Serial.println("   STATUS       — Show device status");
    }
    else {
      Serial.println("❓ Unknown command. Type HELP for options.");
    }
  }
}

// ──────────────────── FEEDBACK FUNCTIONS ────────────────────
void successFeedback() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_SUCCESS, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(LED_SUCCESS, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

void errorFeedback() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(500);
  digitalWrite(BUZZER_PIN, LOW);
}
