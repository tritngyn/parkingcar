#include "WifiManager.h"

#include <WiFi.h>
#include <WebServer.h>

#include "Config.h"
#include "WifiStorage.h"
#include "WifiSetupPage.h"


// =====================================================
// PRIVATE VARIABLES
// =====================================================

namespace {

    WebServer server(80);

    bool apMode = false;


    // Dùng để restart sau khi gửi response về browser
    bool restartPending = false;

    unsigned long restartAt = 0;


    // -------------------------------------------------
    // JSON helper
    // -------------------------------------------------

    String jsonEscape(
        const String& text
    ) {

        String result;

        for (
            size_t i = 0;
            i < text.length();
            i++
        ) {

            char c =
                text[i];

            if (c == '"') {

                result +=
                    "\\\"";

            }

            else if (c == '\\') {

                result +=
                    "\\\\";

            }

            else {

                result +=
                    c;

            }

        }

        return result;
    }


    // =================================================
    // HTTP /
    // =================================================

    void handleRoot() {

        server.send_P(
            200,
            "text/html",
            WIFI_SETUP_PAGE
        );
    }


    // =================================================
    // GET /api/networks
    // =================================================

    void handleScanNetworks() {

        Serial.println(
            "Bat dau scan WiFi..."
        );


        int count =
            WiFi.scanNetworks();


        String json =
            "{\"networks\":[";


        for (
            int i = 0;
            i < count;
            i++
        ) {

            if (i > 0) {

                json += ",";
            }


            String ssid =
                WiFi.SSID(i);


            int rssi =
                WiFi.RSSI(i);


            bool secure =
                WiFi.encryptionType(i)
                != WIFI_AUTH_OPEN;


            json +=
                "{";

            json +=
                "\"ssid\":\"";

            json +=
                jsonEscape(ssid);

            json +=
                "\",";


            json +=
                "\"rssi\":";

            json +=
                String(rssi);

            json +=
                ",";


            json +=
                "\"secure\":";

            json +=
                secure
                ? "true"
                : "false";


            json +=
                "}";
        }


        json +=
            "]}";


        WiFi.scanDelete();


        server.send(
            200,
            "application/json",
            json
        );


        Serial.print(
            "Tim thay "
        );

        Serial.print(
            count
        );

        Serial.println(
            " mang WiFi."
        );
    }


    // =================================================
    // POST /api/connect
    // =================================================

    void handleConnect() {

        if (
            !server.hasArg(
                "ssid"
            )
        ) {

            server.send(
                400,
                "application/json",
                "{\"success\":false,\"message\":\"Missing SSID\"}"
            );

            return;
        }


        String ssid =
            server.arg(
                "ssid"
            );


        String password =
            server.arg(
                "password"
            );


        Serial.println();
        Serial.println(
            "================================="
        );

        Serial.print(
            "Thu ket noi WiFi: "
        );

        Serial.println(
            ssid
        );


        bool success =
            WifiManager::connectToWiFi(
                ssid,
                password
            );


        if (success) {

            bool saved =
                WifiStorage::saveCredentials(
                    ssid,
                    password
                );


            if (!saved) {

                server.send(
                    500,
                    "application/json",
                    "{\"success\":false,\"message\":\"Connected but cannot save configuration\"}"
                );

                return;
            }


            Serial.println(
                "Da luu WiFi vao NVS."
            );


            server.send(
                200,
                "application/json",
                "{\"success\":true,\"message\":\"Connected successfully\"}"
            );


            /*
                Không ESP.restart() ngay.

                Nếu restart ngay thì browser
                có thể chưa nhận được response.
            */

            restartPending =
                true;

            restartAt =
                millis() + 2000;

        }

        else {

            Serial.println(
                "Sai password hoac khong the ket noi WiFi."
            );


            /*
                Trở lại AP mode
            */

            WifiManager::startAccessPoint();


            server.send(
                200,
                "application/json",
                "{\"success\":false,\"message\":\"Cannot connect to this WiFi. Check the password.\"}"
            );
        }
    }


    // =================================================
    // POST /api/reset
    // =================================================

    void handleReset() {

        WifiStorage::
            clearCredentials();


        server.send(
            200,
            "application/json",
            "{\"success\":true}"
        );


        restartPending =
            true;

        restartAt =
            millis() + 1500;
    }


    // =================================================
    // 404
    // =================================================

    void handleNotFound() {

        /*
            Nếu người dùng nhập địa chỉ bất kỳ
            khi đang kết nối AP,
            đưa về trang cấu hình.
        */

        server.sendHeader(
            "Location",
            "/"
        );

        server.send(
            302,
            "text/plain",
            ""
        );
    }


    // =================================================
    // START WEB SERVER
    // =================================================

    void startWebServer() {

        server.on(
            "/",
            HTTP_GET,
            handleRoot
        );


        server.on(
            "/api/networks",
            HTTP_GET,
            handleScanNetworks
        );


        server.on(
            "/api/connect",
            HTTP_POST,
            handleConnect
        );


        server.on(
            "/api/reset",
            HTTP_POST,
            handleReset
        );


        server.onNotFound(
            handleNotFound
        );


        server.begin();


        Serial.println(
            "WiFi config WebServer started."
        );
    }

}



// =====================================================
// PUBLIC: begin()
// =====================================================

void WifiManager::begin() {

    Serial.println();
    Serial.println(
        "===== WIFI MANAGER ====="
    );


    /*
        Có WiFi đã lưu
    */

    if (
        WifiStorage::
            hasCredentials()
    ) {

        String ssid =
            WifiStorage::
                getSSID();


        String password =
            WifiStorage::
                getPassword();


        Serial.print(
            "Tim thay WiFi da luu: "
        );

        Serial.println(
            ssid
        );


        if (
            connectToWiFi(
                ssid,
                password
            )
        ) {

            Serial.println(
                "WiFi Manager: Station mode."
            );

            return;
        }


        Serial.println(
            "WiFi da luu khong ket noi duoc."
        );
    }


    /*
        Không có WiFi hoặc kết nối thất bại
    */

    startAccessPoint();
}



// =====================================================
// PUBLIC: connectToWiFi()
// =====================================================

bool WifiManager::connectToWiFi(
    const String& ssid,
    const String& password
) {

    Serial.print(
        "Dang ket noi "
    );

    Serial.println(
        ssid
    );


    /*
        WIFI_AP_STA rất quan trọng.

        Nếu người dùng đang kết nối trang
        192.168.4.1 mà ESP chuyển thẳng WIFI_STA,
        điện thoại sẽ bị ngắt khỏi ESP trước khi
        nhận kết quả.

        AP_STA cho phép:
        - vẫn giữ Access Point
        - đồng thời thử kết nối router
    */

    if (apMode) {

        WiFi.mode(
            WIFI_AP_STA
        );

    }

    else {

        WiFi.mode(
            WIFI_STA
        );
    }


    WiFi.begin(
        ssid.c_str(),
        password.c_str()
    );


    unsigned long started =
        millis();


    while (
        WiFi.status()
            != WL_CONNECTED
        &&
        millis() - started
            < WIFI_CONNECT_TIMEOUT
    ) {

        /*
            Nếu Web Server đang chạy,
            vẫn xử lý HTTP request
        */

        if (apMode) {

            server.handleClient();
        }


        delay(100);

        Serial.print(".");
    }


    Serial.println();


    if (
        WiFi.status()
        == WL_CONNECTED
    ) {

        Serial.println(
            "WiFi ket noi thanh cong."
        );


        Serial.print(
            "Station IP: "
        );

        Serial.println(
            WiFi.localIP()
        );


        return true;
    }


    /*
        Ngắt kết nối STA
        nhưng không xóa thông tin NVS
    */

    WiFi.disconnect(
        false,
        false
    );


    Serial.println(
        "WiFi ket noi that bai."
    );


    return false;
}



// =====================================================
// PUBLIC: startAccessPoint()
// =====================================================

void WifiManager::startAccessPoint() {

    /*
        Nếu AP đã chạy thì không start server lại
    */

    if (apMode) {

        return;
    }


    Serial.println();
    Serial.println(
        "===== CONFIG MODE ====="
    );


    /*
        Cho ESP vừa là AP vừa có thể scan/connect STA
    */

    WiFi.mode(
        WIFI_AP_STA
    );


    bool success =
        WiFi.softAP(
            WIFI_AP_SSID,
            WIFI_AP_PASSWORD
        );


    if (!success) {

        Serial.println(
            "Khong the tao Access Point!"
        );

        return;
    }


    apMode =
        true;


    IPAddress ip =
        WiFi.softAPIP();


    Serial.print(
        "Access Point: "
    );

    Serial.println(
        WIFI_AP_SSID
    );


    Serial.print(
        "AP IP: "
    );

    Serial.println(
        ip
    );


    Serial.println(
        "Mo trinh duyet: http://192.168.4.1"
    );


    startWebServer();
}



// =====================================================
// PUBLIC: stopAccessPoint()
// =====================================================

void WifiManager::stopAccessPoint() {

    if (!apMode) {

        return;
    }


    WiFi.softAPdisconnect(
        true
    );


    apMode =
        false;


    Serial.println(
        "Access Point stopped."
    );
}



// =====================================================
// PUBLIC: loop()
// =====================================================

void WifiManager::loop() {

    /*
        Web server chỉ cần xử lý
        khi AP đang hoạt động
    */

    if (apMode) {

        server.handleClient();
    }


    /*
        Restart sau khi browser
        đã nhận response
    */

    if (
        restartPending
        &&
        millis() >= restartAt
    ) {

        Serial.println(
            "Restarting ESP32..."
        );


        delay(100);


        ESP.restart();
    }
}



// =====================================================
// PUBLIC: isConnected()
// =====================================================

bool WifiManager::isConnected() {

    return (
        WiFi.status()
        == WL_CONNECTED
    );
}



// =====================================================
// PUBLIC: isAPMode()
// =====================================================

bool WifiManager::isAPMode() {

    return apMode;
}



// =====================================================
// PUBLIC: clearSavedWiFi()
// =====================================================

void WifiManager::clearSavedWiFi() {

    Serial.println(
        "Xoa cau hinh WiFi..."
    );


    WifiStorage::
        clearCredentials();

    Serial.println(
        "Da xoa WiFi da luu."
    );
}



// =====================================================
// PUBLIC: resetWiFi()
// =====================================================

void WifiManager::resetWiFi() {

    clearSavedWiFi();


    WiFi.disconnect(
        true,
        true
    );


    delay(500);


    ESP.restart();
}
