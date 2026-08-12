#include "WifiStorage.h"

#include <Preferences.h>

namespace {

    // Namespace trong NVS
    const char* NVS_NAMESPACE = "wifi-config";

    // Key lưu dữ liệu
    const char* KEY_SSID = "ssid";
    const char* KEY_PASSWORD = "password";
}


bool WifiStorage::hasCredentials() {

    Preferences preferences;

    preferences.begin(
        NVS_NAMESPACE,
        true
    );

    String ssid = preferences.getString(
        KEY_SSID,
        ""
    );

    preferences.end();

    return ssid.length() > 0;
}


String WifiStorage::getSSID() {

    Preferences preferences;

    preferences.begin(
        NVS_NAMESPACE,
        true
    );

    String ssid = preferences.getString(
        KEY_SSID,
        ""
    );

    preferences.end();

    return ssid;
}


String WifiStorage::getPassword() {

    Preferences preferences;

    preferences.begin(
        NVS_NAMESPACE,
        true
    );

    String password = preferences.getString(
        KEY_PASSWORD,
        ""
    );

    preferences.end();

    return password;
}


bool WifiStorage::saveCredentials(
    const String& ssid,
    const String& password
) {

    if (ssid.length() == 0) {
        return false;
    }

    Preferences preferences;

    if (!preferences.begin(
        NVS_NAMESPACE,
        false
    )) {
        return false;
    }

    size_t savedSSID = preferences.putString(
        KEY_SSID,
        ssid
    );

    preferences.putString(
        KEY_PASSWORD,
        password
    );

    preferences.end();

    return savedSSID > 0;
}


void WifiStorage::clearCredentials() {

    Preferences preferences;

    preferences.begin(
        NVS_NAMESPACE,
        false
    );

    preferences.clear();

    preferences.end();
}