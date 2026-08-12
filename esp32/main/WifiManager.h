#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

namespace WifiManager {

    // Khởi động hệ thống WiFi
    void begin();

    // Phải gọi liên tục trong loop()
    // để WebServer hoạt động
    void loop();

    // ESP32 hiện đã kết nối WiFi hay chưa
    bool isConnected();

    // ESP32 hiện đang ở chế độ cấu hình AP hay không
    bool isAPMode();

    // Thử kết nối WiFi
    bool connectToWiFi(
        const String& ssid,
        const String& password
    );

    // Bật Access Point + Web Server
    void startAccessPoint();

    // Tắt Access Point
    void stopAccessPoint();

    // Xóa WiFi đã lưu
    void clearSavedWiFi();

    // Xóa WiFi đã lưu rồi khởi động lại ESP32
    void resetWiFi();

}

#endif
