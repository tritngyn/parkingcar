#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

#include "Config.h"
#include "WifiStorage.h"
#include "WifiManager.h"
// // ===================== WIFI =====================
// const char* WIFI_SSID = "Khoa Tran";
// const char* WIFI_PASSWORD = "123456789@@";

// // ===================== MQTT =====================
// const char* MQTT_SERVER = "broker.emqx.io";
// const int MQTT_PORT = 1883;

// const char* DEVICE_ID = "esp32-01";
// const char* TOPIC_RFID_SCAN   = "parking/group17/rfid/scan";
// const char* TOPIC_GATE_COMMAND = "parking/group17/gate/command";
// const char* TOPIC_GATE_STATUS  = "parking/group17/gate/status";
// const char* TOPIC_SYSTEM_STATUS = "parking/group17/system/status";



// // ===================== RFID RC522 =====================
// #define RFID_SS_PIN    17
// #define RFID_SCK_PIN   16
// #define RFID_MOSI_PIN  4
// #define RFID_MISO_PIN  2
// #define RFID_RST_PIN   15


// // ===================== SERVO =====================
// #define SERVO_IN_PIN   25
// #define SERVO_OUT_PIN  13
// Servo servoIn;
// Servo servoOut;

// // ===================== BUTTON =====================
// #define BUTTON_IN_PIN   14
// #define BUTTON_OUT_PIN  12

// // ===================== LED =====================
// #define LED_IN_GREEN_PIN   33
// #define LED_IN_RED_PIN     32
// #define LED_OUT_GREEN_PIN  27
// #define LED_OUT_RED_PIN    26

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
String mqttClientId;

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

Servo servoIn;
Servo servoOut;

bool gateInOpen = false;
bool gateOutOpen = false;
unsigned long gateInOpenedAt = 0;
unsigned long gateOutOpenedAt = 0;
unsigned long lastButtonInTime = 0;
unsigned long lastButtonOutTime = 0;
String lastUID = "";
bool nextScanIsEntry = true; // Mô hình một đầu đọc: lần 1 IN, lần 2 OUT
unsigned long lastRFIDTime = 0;
bool rfidReady = false;
unsigned long lastStatusPublish = 0;
unsigned long lastRFIDRecoveryTime = 0;
unsigned long lastRFIDHealthCheck = 0;

String makeEventId() {
  return String(DEVICE_ID) + "-" + String(random(1000, 9999));
}

void publishJson(const char* topic, JsonDocument& doc, bool retained = false) {
  char payload[512];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  bool ok = mqttClient.publish(topic, reinterpret_cast<const uint8_t*>(payload), len, retained);
  Serial.printf("MQTT publish %s: %s\n", ok ? "OK" : "FAIL", payload);
}

void publishSystemStatus(const char* status) {
  if (!mqttClient.connected()) return;
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["messageType"] = "status";
  doc["status"] = status;
  doc["uptimeMs"] = millis();
  doc["ssid"] = WiFi.SSID();
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  publishJson(TOPIC_SYSTEM_STATUS, doc, true);
}

void publishGateStatus(const char* lane, const char* status, const char* source,
  const String& requestId = "", const String& uid = "") {
  if (!mqttClient.connected()) return;
  StaticJsonDocument<384> doc;
  doc["eventId"] = makeEventId();
  doc["deviceId"] = DEVICE_ID;
  doc["messageType"] = "status";
  doc["source"] = source;
  doc["lane"] = lane;
  doc["status"] = status;
  doc["uptimeMs"] = millis();
  if (requestId.length()) doc["requestId"] = requestId;
  if (uid.length()) doc["uid"] = uid;
  publishJson(TOPIC_GATE_STATUS, doc);
}

void publishRFID(const String& uid) {
  if (!mqttClient.connected()) {
    Serial.println("Khong gui RFID vi MQTT chua ket noi");
    return;
  }

  StaticJsonDocument<320> doc;

  String eventId = makeEventId();

  doc["eventId"] = eventId;
  doc["deviceId"] = DEVICE_ID;
  doc["messageType"] = "rfid_scan";
  doc["source"] = "rfid";
  doc["uid"] = uid;
  doc["uptimeMs"] = millis();

  publishJson(TOPIC_RFID_SCAN, doc);

  Serial.printf(
    "Da gui UID %s len backend, eventId=%s\n",
    uid.c_str(),
    eventId.c_str()
  );
}

void setEntryLED(bool isOpen) {
  digitalWrite(LED_IN_GREEN_PIN, isOpen ? HIGH : LOW);
  digitalWrite(LED_IN_RED_PIN, isOpen ? LOW : HIGH);
}

void setExitLED(bool isOpen) {
  digitalWrite(LED_OUT_GREEN_PIN, isOpen ? HIGH : LOW);
  digitalWrite(LED_OUT_RED_PIN, isOpen ? LOW : HIGH);
}

void openEntryGate(const char* source, const String& requestId = "", const String& uid = "") {
  servoIn.write(GATE_OPEN_ANGLE);
  setEntryLED(true);
  gateInOpen = true;
  gateInOpenedAt = millis();
  delay(GATE_MOVE_TIME);
  publishGateStatus("in", "opened", source, requestId, uid);
}

void closeEntryGate(const char* source = "system") {
  servoIn.write(GATE_CLOSED_ANGLE);
  setEntryLED(false);
  delay(GATE_MOVE_TIME);
  gateInOpen = false;
  publishGateStatus("in", "closed", source);
}

void openExitGate(const char* source, const String& requestId = "", const String& uid = "") {
  servoOut.write(GATE_OPEN_ANGLE);
  setExitLED(true);
  gateOutOpen = true;
  gateOutOpenedAt = millis();
  delay(GATE_MOVE_TIME);
  publishGateStatus("out", "opened", source, requestId, uid);
}

void closeExitGate(const char* source = "system") {
  servoOut.write(GATE_CLOSED_ANGLE);
  setExitLED(false);
  delay(GATE_MOVE_TIME);
  gateOutOpen = false;
  publishGateStatus("out", "closed", source);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<384> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("JSON invalid: %s\n", err.c_str());
    return;
  }

  if (String(topic) != TOPIC_GATE_COMMAND) return;

  const char* messageType = doc["messageType"] | "";
  const char* lane = doc["lane"] | "";
  const char* action = doc["action"] | "";
  const char* source = doc["source"] | "web";
  String requestId = doc["requestId"] | "";
  String uid = doc["uid"] | "";

  if (strcmp(messageType, "command") != 0) return;

  if (strcmp(lane, "in") == 0 && strcmp(action, "open") == 0) {
    openEntryGate(source, requestId, uid);
  }
  else if (strcmp(lane, "out") == 0 && strcmp(action, "open") == 0) {
    openExitGate(source, requestId, uid);
  }
  else if (strcmp(lane, "in") == 0 && strcmp(action, "close") == 0) {
    closeEntryGate(source);
  }
  else if (strcmp(lane, "out") == 0 && strcmp(action, "close") == 0) {
    closeExitGate(source);
  }
  else {
    publishGateStatus(lane, "error", "system", requestId, uid);

  }
}



void connectMQTT() {
  if (mqttClient.connected() || WiFi.status() != WL_CONNECTED) return;
  mqttClientId = "esp32-parking-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // Last Will: broker tự báo offline nếu ESP32 mất kết nối bất ngờ.
  const char* willPayload = "{\"deviceId\":\"esp32-01\",\"messageType\":\"status\",\"status\":\"offline\"}";
  bool ok = mqttClient.connect(
    mqttClientId.c_str(),
    nullptr, nullptr,
    TOPIC_SYSTEM_STATUS, 1, true, willPayload
  );

  if (ok) {
    mqttClient.subscribe(TOPIC_GATE_COMMAND, 1);
    publishSystemStatus("online");
    Serial.println("MQTT connected");
  }
  else {
    Serial.printf("MQTT failed, state=%d\n", mqttClient.state());
  }
}

String getUIDString() {
  String uid;
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

bool initRFID() {
  digitalWrite(RFID_SS_PIN, HIGH);
  digitalWrite(RFID_RST_PIN, HIGH);
  delay(10);

  rfid.PCD_Init();
  delay(50);
  rfid.PCD_AntennaOn();
  rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);

  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.printf("RC522 VersionReg: 0x%02X\n", version);

  if (version == 0x00 || version == 0xFF) {
    Serial.println("RC522 khong phan hoi. Kiem tra nguon 3.3V va day SPI.");
    return false;
  }

  Serial.println("RC522 san sang quet the.");
  return true;
}

void handleRFID() {
  unsigned long now = millis();

  if (!rfidReady) {
    if (now - lastRFIDRecoveryTime >= 2000) {
      lastRFIDRecoveryTime = now;
      Serial.println("Dang khoi dong lai RC522...");
      rfidReady = initRFID();
    }
    return;
  }

  if (now - lastRFIDHealthCheck >= 5000) {
    lastRFIDHealthCheck = now;
    byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
    if (version == 0x00 || version == 0xFF) {
      Serial.println("RC522 mat ket noi sau khi bat WiFi.");
      rfidReady = false;
      return;
    }
  }

  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }

  if (!rfid.PICC_ReadCardSerial()) {
    rfid.PICC_HaltA();
    return;
  }

  String uid = getUIDString();
  // Chống một thẻ bị đọc lặp liên tục
  if (
    uid == lastUID &&
    now - lastRFIDTime < RFID_REPEAT_DELAY
    ) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  lastUID = uid;
  lastRFIDTime = now;

  Serial.printf("RFID scanned: %s\n", uid.c_str());

  // Chỉ gửi UID lên Backend
  publishRFID(uid);

  // Không mở servo tại đây.
  // Chờ Backend kiểm tra DB rồi gửi lệnh về.

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void handleButtons() {
  unsigned long now = millis();
  if (digitalRead(BUTTON_IN_PIN) == LOW && now - lastButtonInTime >= DEBOUNCE_TIME) {
    lastButtonInTime = now;
    openEntryGate("button");
  }
  if (digitalRead(BUTTON_OUT_PIN) == LOW && now - lastButtonOutTime >= DEBOUNCE_TIME) {
    lastButtonOutTime = now;
    openExitGate("button");
  }
}

void handleAutoCloseGate() {
  unsigned long now = millis();
  if (gateInOpen && now - gateInOpenedAt >= GATE_OPEN_TIME) closeEntryGate();
  if (gateOutOpen && now - gateOutOpenedAt >= GATE_OPEN_TIME) closeExitGate();
}

void setup() {
  Serial.begin(115200);
  randomSeed(esp_random());

  pinMode(LED_IN_GREEN_PIN, OUTPUT);
  pinMode(LED_IN_RED_PIN, OUTPUT);
  pinMode(LED_OUT_GREEN_PIN, OUTPUT);
  pinMode(LED_OUT_RED_PIN, OUTPUT);
  pinMode(BUTTON_IN_PIN, INPUT_PULLUP);
  pinMode(BUTTON_OUT_PIN, INPUT_PULLUP);
  setEntryLED(false);
  setExitLED(false);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  servoIn.setPeriodHertz(50);
  servoOut.setPeriodHertz(50);
  servoIn.attach(SERVO_IN_PIN, 500, 2400);
  servoOut.attach(SERVO_OUT_PIN, 500, 2400);
  servoIn.write(GATE_CLOSED_ANGLE);
  servoOut.write(GATE_CLOSED_ANGLE);

  WifiManager::begin();
  pinMode(RFID_SS_PIN, OUTPUT);
  pinMode(RFID_RST_PIN, OUTPUT);
  digitalWrite(RFID_SS_PIN, HIGH);
  digitalWrite(RFID_RST_PIN, HIGH);
  SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SS_PIN);
  rfidReady = initRFID();

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
  if (WifiManager::isConnected()) {
    connectMQTT();
  }
  // WifiManager::clearSavedWiFi();
}


void loop() {
  static unsigned long lastMQTTRetry = 0;

  WifiManager::loop();
  if (WifiManager::isConnected()) {

    if (!mqttClient.connected() && millis() - lastMQTTRetry >= 5000) {
      lastMQTTRetry = millis();
      connectMQTT();
    }

    if (mqttClient.connected()) {
      mqttClient.loop();
      if (millis() - lastStatusPublish >= 30000) {
        lastStatusPublish = millis();
        publishSystemStatus("online");
      }
    }
  }

  handleButtons();
  handleRFID();
  handleAutoCloseGate();
  delay(10);
}
