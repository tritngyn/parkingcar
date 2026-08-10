#ifndef WIFI_SETUP_PAGE_H
#define WIFI_SETUP_PAGE_H
const char WIFI_SETUP_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >
    <title>
        ParkAdmin Network Setup
    </title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            font-family:
                Arial,
                Helvetica,
                sans-serif;
            background: #f5f7fa;
            color: #202733;
        }
        .container {
            width: 92%;
            max-width: 430px;
            margin: 30px auto;
        }
        .wifi-icon {
            width: 55px;
            height: 55px;
            margin: auto;
            border-radius: 15px;
            background: #e6f2f8;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
        }
        h1 {
            text-align: center;
            font-size: 22px;
            margin-bottom: 5px;
        }
        .subtitle {
            text-align: center;
            color: #7a8491;
            margin-bottom: 25px;
        }
        /* =========================================
           CARD
        ========================================= */
        .card {
            background: white;
            border-radius: 12px;
            margin-bottom: 18px;
            overflow: hidden;
            box-shadow:
                0 1px 5px
                rgba(0,0,0,0.08);
        }
        .card-title {
            padding: 14px 16px;
            font-size: 12px;
            font-weight: bold;
            color: #7a8491;
            border-bottom:
                1px solid #eeeeee;
        }
        /* =========================================
           NETWORK LIST
        ========================================= */
        .network {
            display: flex;
            align-items: center;
            padding: 15px 16px;
            border-bottom:
                1px solid #eeeeee;
            cursor: pointer;
            transition:
                background 0.15s ease;
        }
        .network:last-child {
            border-bottom: none;
        }
        .network:hover {
            background: #f5fbff;
        }
        .network.selected {
            background: #edf8fd;
        }
        .network.extra-network {
            display: none;
        }
        .network.extra-network.visible {
            display: flex;
        }
        .view-more {
            border-radius: 0;
            background: #fff;
            color: #087dad;
            font-size: 13px;
        }
        .view-more:hover {
            background: #f5fbff;
        }
        .radio {
            width: 18px;
            height: 18px;
            border:
                2px solid #d3d8df;
            border-radius: 50%;
            margin-right: 12px;
            flex-shrink: 0;
        }
        .network.selected .radio {
            background: #087dad;
            border-color: #087dad;
            box-shadow:
                inset 0 0 0 4px white;
        }
        .network-info {
            flex: 1;
            min-width: 0;
        }
        .ssid {
            font-weight: bold;
            margin-bottom: 4px;
            word-break: break-word;
        }
        .security {
            font-size: 12px;
            color: #8b949e;
        }
        .signal {
            margin-left: 10px;
            white-space: nowrap;
        }
        .signal-bars {
            display: inline-flex;
            align-items: flex-end;
            gap: 2px;
            width: 22px;
            height: 18px;
        }
        .signal-bars span {
            width: 4px;
            border-radius: 2px 2px 0 0;
            background: #d3d8df;
        }
        .signal-bars span:nth-child(1) { height: 4px; }
        .signal-bars span:nth-child(2) { height: 8px; }
        .signal-bars span:nth-child(3) { height: 12px; }
        .signal-bars span:nth-child(4) { height: 16px; }
        .signal-bars.strength-1 span:nth-child(-n+1),
        .signal-bars.strength-2 span:nth-child(-n+2),
        .signal-bars.strength-3 span:nth-child(-n+3),
        .signal-bars.strength-4 span:nth-child(-n+4) {
            background: #087dad;
        }
        /* =========================================
           BUTTON
        ========================================= */
        button {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 9px;
            background: #087dad;
            color: white;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
        }
        button:disabled {
            background: #9cbac8;
            cursor: not-allowed;
        }
        .refresh {
            margin-bottom: 15px;
            background: #ffffff;
            color: #087dad;
            border:
                1px solid #087dad;
        }
        .refresh:hover {
            background: #f1f9fc;
        }
        .status {
            margin-top: 15px;
            text-align: center;
            font-size: 14px;
        }
        /* =========================================
           MODAL BACKGROUND
        ========================================= */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background:
                rgba(0, 0, 0, 0.45);
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .modal.show {
            display: flex;
        }
        /* =========================================
           MODAL BOX
        ========================================= */
        .modal-box {
            width: 100%;
            max-width: 390px;
            background: white;
            border-radius: 14px;
            padding: 20px;
            box-shadow:
                0 12px 35px
                rgba(0,0,0,0.20);
            animation:
                modalOpen 0.18s ease;
        }
        @keyframes modalOpen {
            from {
                transform:
                    scale(0.96);
                opacity: 0;
            }
            to {
                transform:
                    scale(1);
                opacity: 1;
            }
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 19px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .close-button {
            width: auto;
            padding: 0;
            background: transparent;
            color: #777;
            font-size: 28px;
            line-height: 1;
        }
        .close-button:hover {
            color: #222;
        }
        /* =========================================
           SELECTED NETWORK IN MODAL
        ========================================= */
        .modal-network {
            display: flex;
            align-items: center;
            padding: 13px;
            margin-bottom: 20px;
            background: #f4f9fc;
            border-radius: 9px;
        }
        .modal-wifi-icon {
            font-size: 24px;
            margin-right: 12px;
        }
        .modal-ssid {
            font-size: 16px;
            font-weight: bold;
            word-break: break-word;
        }
        .modal-security {
            margin-top: 3px;
            font-size: 12px;
            color: #8b949e;
        }
        /* =========================================
           PASSWORD INPUT
        ========================================= */
        .password-section {
            margin-bottom: 18px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
        }
        .password-wrapper {
            position: relative;
        }
        input {
            width: 100%;
            padding: 13px;
            border:
                1px solid #d8dde3;
            border-radius: 8px;
            font-size: 15px;
            outline: none;
        }
        input:focus {
            border-color: #087dad;
            box-shadow:
                0 0 0 2px
                rgba(8,125,173,0.10);
        }
        /* =========================================
           MODAL BUTTONS
        ========================================= */
        .modal-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        .modal-buttons button {
            flex: 1;
        }
        .cancel-button {
            background: #e9edf0;
            color: #333;
        }
        .cancel-button:hover {
            background: #dde2e6;
        }
        .connect-button {
            background: #087dad;
        }
        .connect-button:hover {
            background: #066b95;
        }
        .modal-status {
            text-align: center;
            min-height: 18px;
            font-size: 13px;
            margin-top: 5px;
        }
        /* =========================================
           MOBILE
        ========================================= */
        @media (max-width: 480px) {
            .container {
                margin-top: 20px;
            }
            .modal-box {
                padding: 18px;
            }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="wifi-icon">
        📶
    </div>
    <h1>
        ParkAdmin Network Setup
    </h1>
    <div class="subtitle">
        Connect the parking system
        to the local internet.
    </div>
    <button
        class="refresh"
        onclick="loadNetworks()"
    >
        Scan WiFi Networks
    </button>
    <div class="card">
        <div class="card-title">
            AVAILABLE NETWORKS
        </div>
        <div id="networkList">
            <div
                style="
                    padding: 20px;
                    text-align: center;
                    color: #777;
                "
            >
                Scanning...
            </div>
        </div>
    </div>
    <div
        id="status"
        class="status"
    ></div>
</div>
<!-- =========================================
     WIFI PASSWORD MODAL
========================================= -->
<div
    id="wifiModal"
    class="modal"
>
    <div class="modal-box">
        <div class="modal-header">
            <div>
                Connect to WiFi
            </div>
            <button
                class="close-button"
                onclick="closeWifiModal()"
            >
                &times;
            </button>
        </div>
        <div class="modal-network">
            <div class="modal-wifi-icon">
                📶
            </div>
            <div>
                <div
                    id="modalSSID"
                    class="modal-ssid"
                >
                    WiFi
                </div>
                <div
                    id="modalSecurity"
                    class="modal-security"
                >
                    Password protected
                </div>
            </div>
        </div>
        <div
            id="passwordSection"
            class="password-section"
        >
            <label>
                Password
            </label>
            <div class="password-wrapper">
                <input
                    id="password"
                    type="password"
                    placeholder="Enter WiFi password"
                >
            </div>
        </div>
        <div
            id="modalStatus"
            class="modal-status"
        ></div>
        <div class="modal-buttons">
            <button
                class="cancel-button"
                onclick="closeWifiModal()"
            >
                Cancel
            </button>
            <button
                id="connectButton"
                class="connect-button"
                onclick="connectWifi()"
            >
                Connect
            </button>
        </div>
    </div>
</div>
<script>
// =====================================================
// GLOBAL VARIABLES
// =====================================================
let selectedSSID = "";
let selectedNetworkSecure = true;
// =====================================================
// LOAD WIFI NETWORKS
// =====================================================
async function loadNetworks() {
    const list =
        document.getElementById(
            "networkList"
        );
    list.innerHTML =
        "<div style='padding:20px;text-align:center;color:#777'>Scanning...</div>";
    try {
        const response =
            await fetch(
                "/api/networks"
            );
        const data =
            await response.json();
        list.innerHTML = "";
        if (
            !data.networks ||
            data.networks.length === 0
        ) {
            list.innerHTML =
                "<div style='padding:20px;text-align:center;color:#777'>No networks found</div>";
            return;
        }
        data.networks.forEach(
            (network, index) => {
                const item =
                    document.createElement(
                        "div"
                    );
                item.className =
                    index < 6 ? "network" : "network extra-network";
                item.innerHTML = `
                    <div class="radio"></div>
                    <div class="network-info">
                        <div class="ssid">
                            ${escapeHtml(network.ssid)}
                        </div>
                        <div class="security">
                            ${
                                network.secure
                                    ? "Password protected"
                                    : "Open network"
                            }
                        </div>
                    </div>
                    <div class="signal">
                        ${
                            getSignalIcon(
                                network.rssi
                            )
                        }
                    </div>
                `;
                item.onclick =
                    function() {
                        selectedSSID =
                            network.ssid;
                        selectedNetworkSecure =
                            network.secure;
                        document
                            .querySelectorAll(
                                ".network"
                            )
                            .forEach(
                                n =>
                                    n.classList.remove(
                                        "selected"
                                    )
                            );
                        item.classList.add(
                            "selected"
                        );
                        openWifiModal(
                            network
                        );
                    };
                list.appendChild(
                    item
                );
            }
        );
        if (data.networks.length > 6) {
            const viewMoreButton = document.createElement("button");
            viewMoreButton.type = "button";
            viewMoreButton.className = "view-more";
            viewMoreButton.innerText = `View more (${data.networks.length - 6})`;
            viewMoreButton.onclick = function() {
                const extraNetworks = list.querySelectorAll(".extra-network");
                const expanded = extraNetworks[0].classList.toggle("visible");
                extraNetworks.forEach((network, index) => {
                    if (index > 0) network.classList.toggle("visible", expanded);
                });
                viewMoreButton.innerText = expanded ? "Show less" : `View more (${data.networks.length - 6})`;
            };
            list.appendChild(viewMoreButton);
        }
    }
    catch (error) {
        console.log(
            error
        );
        list.innerHTML =
            "<div style='padding:20px;text-align:center;color:red'>Scan failed</div>";
    }
}
// =====================================================
// SIGNAL ICON
// =====================================================
function getSignalIcon(rssi) {
    const strength = rssi >= -55 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
    const label = strength === 4 ? "Strong" : strength === 3 ? "Good" : strength === 2 ? "Weak" : "Very weak";
    return `<span class="signal-bars strength-${strength}" title="${label} signal" aria-label="${label} signal"><span></span><span></span><span></span><span></span></span>`;
}
// =====================================================
// ESCAPE HTML
// =====================================================
function escapeHtml(text) {
    const div =
        document.createElement(
            "div"
        );
    div.textContent =
        text;
    return div.innerHTML;
}
// =====================================================
// OPEN WIFI MODAL
// =====================================================
function openWifiModal(network) {
    selectedSSID =
        network.ssid;
    selectedNetworkSecure =
        network.secure;
    document.getElementById(
        "modalSSID"
    ).innerText =
        network.ssid;
    document.getElementById(
        "modalSecurity"
    ).innerText =
        network.secure
            ? "Password protected"
            : "Open network";
    const passwordSection =
        document.getElementById(
            "passwordSection"
        );
    const passwordInput =
        document.getElementById(
            "password"
        );
    const modalStatus =
        document.getElementById(
            "modalStatus"
        );
    const connectButton =
        document.getElementById(
            "connectButton"
        );
    passwordInput.value = "";
    passwordInput.type =
        "password";
    modalStatus.innerText = "";
    connectButton.disabled =
        false;
    if (
        network.secure
    ) {
        passwordSection.style.display =
            "block";
    }
    else {
        passwordSection.style.display =
            "none";
    }
    document
        .getElementById(
            "wifiModal"
        )
        .classList.add(
            "show"
        );
    if (
        network.secure
    ) {
        setTimeout(
            function() {
                passwordInput.focus();
            },
            150
        );
    }
}
// =====================================================
// CLOSE WIFI MODAL
// =====================================================
function closeWifiModal() {
    const modal =
        document.getElementById(
            "wifiModal"
        );
    const password =
        document.getElementById(
            "password"
        );
    const modalStatus =
        document.getElementById(
            "modalStatus"
        );
    const button =
        document.getElementById(
            "connectButton"
        );
    modal.classList.remove(
        "show"
    );
    password.value = "";
    password.type =
        "password";
    modalStatus.innerText = "";
    button.disabled =
        false;
}
// =====================================================
// CONNECT WIFI
// =====================================================
async function connectWifi() {
    const password =
        document.getElementById(
            "password"
        ).value;
    const status =
        document.getElementById(
            "modalStatus"
        );
    const button =
        document.getElementById(
            "connectButton"
        );
    if (
        !selectedSSID
    ) {
        status.style.color =
            "red";
        status.innerText =
            "Please select a WiFi network.";
        return;
    }
    if (
        selectedNetworkSecure &&
        password.length === 0
    ) {
        status.style.color =
            "red";
        status.innerText =
            "Please enter the WiFi password.";
        return;
    }
    status.style.color =
        "#555";
    status.innerText =
        "Connecting to "
        + selectedSSID
        + "...";
    button.disabled =
        true;
    try {
        const response =
            await fetch(
                "/api/connect",
                {
                    method:
                        "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },
                    body:
                        "ssid=" +
                        encodeURIComponent(
                            selectedSSID
                        )
                        +
                        "&password=" +
                        encodeURIComponent(
                            selectedNetworkSecure
                                ? password
                                : ""
                        )
                }
            );
        const data =
            await response.json();
        if (
            data.success
        ) {
            status.style.color =
                "green";
            status.innerText =
                "Connected successfully. Restarting ESP32...";
            button.innerText =
                "Connected";
        }
        else {
            status.style.color =
                "red";
            status.innerText =
                data.message ||
                "Connection failed.";
            button.disabled =
                false;
            button.innerText =
                "Connect";
        }
    }
    catch (error) {
        console.log(
            error
        );
        status.style.color =
            "red";
        status.innerText =
            "Cannot communicate with ESP32.";
        button.disabled =
            false;
        button.innerText =
            "Connect";
    }
}
// =====================================================
// CLICK OUTSIDE MODAL
// =====================================================
document.getElementById(
    "wifiModal"
).addEventListener(
    "click",
    function(event) {
        if (
            event.target === this
        ) {
            closeWifiModal();
        }
    }
);
// =====================================================
// ENTER TO CONNECT
// =====================================================
document.getElementById(
    "password"
).addEventListener(
    "keydown",
    function(event) {
        if (
            event.key === "Enter"
        ) {
            connectWifi();
        }
    }
);
// =====================================================
// ESC TO CLOSE
// =====================================================
document.addEventListener(
    "keydown",
    function(event) {
        if (
            event.key === "Escape"
        ) {
            closeWifiModal();
        }
    }
);
// =====================================================
// AUTO SCAN WHEN PAGE LOADS
// =====================================================
window.onload =
    loadNetworks;
</script>
</body>
</html>
)rawliteral";
#endif
