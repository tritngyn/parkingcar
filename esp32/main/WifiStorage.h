#ifndef WIFI_STORAGE_H
#define WIFI_STORAGE_H

#include <Arduino.h>

namespace WifiStorage {

    // Kiểm tra đã có SSID lưu hay chưa
    bool hasCredentials();

    // Đọc SSID đã lưu
    String getSSID();

    // Đọc password đã lưu
    String getPassword();

    // Lưu SSID + password
    bool saveCredentials(
        const String& ssid,
        const String& password
    );

    // Xóa cấu hình WiFi
    void clearCredentials();
}

#endif