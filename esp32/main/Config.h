#ifndef CONFIG_H
#define CONFIG_H

// =====================================================
// DEVICE
// =====================================================
#define DEVICE_ID "esp32-01"


// =====================================================
// MQTT
// =====================================================
#define MQTT_SERVER "e2d2970e3b4a4079b87cdd8c3372fa3d.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883

#define TOPIC_RFID_SCAN      "parking/group17/rfid/scan"
#define TOPIC_GATE_COMMAND   "parking/group17/gate/command"
#define TOPIC_GATE_STATUS    "parking/group17/gate/status"
#define TOPIC_SYSTEM_STATUS  "parking/group17/system/status"


// =====================================================
// WIFI
// =====================================================

// Sau này ESP32 sẽ phát WiFi này khi chưa được cấu hình
#define WIFI_AP_SSID "ParkAdmin_Setup"
#define WIFI_AP_PASSWORD "parking123"

// Thời gian ESP32 thử kết nối vào WiFi đã lưu
#define WIFI_CONNECT_TIMEOUT 15000


// =====================================================
// RFID RC522
// =====================================================
#define RFID_SS_PIN    17
#define RFID_SCK_PIN   16
#define RFID_MOSI_PIN  4
#define RFID_MISO_PIN  2
#define RFID_RST_PIN   15


// =====================================================
// SERVO
// =====================================================
#define SERVO_IN_PIN   25 //8
#define SERVO_OUT_PIN  13 //3

#define GATE_CLOSED_ANGLE 0
#define GATE_OPEN_ANGLE   -90

#define GATE_OPEN_TIME 2000
#define GATE_MOVE_TIME 500


// =====================================================
// BUTTON
// =====================================================
#define BUTTON_IN_PIN   14 //5 
#define BUTTON_OUT_PIN  12 //4

#define DEBOUNCE_TIME 200


// =====================================================
// LED
// =====================================================
#define LED_IN_GREEN_PIN   33 //9
#define LED_IN_RED_PIN     32//10

#define LED_OUT_GREEN_PIN  27 //6
#define LED_OUT_RED_PIN    26//7


// =====================================================
// RFID
// =====================================================
#define RFID_REPEAT_DELAY 1500

#endif