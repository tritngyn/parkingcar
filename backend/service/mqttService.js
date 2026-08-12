const mqtt = require("mqtt");
const parkingService = require("./parkingService");
const telegramService = require("./telegramService");
const { getIO, latestData } = require("./socketService");

const MQTT_URL = process.env.MQTT_BROKER;

if (!MQTT_URL) {
  throw new Error("Thiếu biến môi trường MQTT_BROKER");
}

const parsedMQTTURL = new URL(MQTT_URL);
if (parsedMQTTURL.port === "8883" && parsedMQTTURL.protocol !== "mqtts:") {
  throw new Error("MQTT port 8883 phải dùng giao thức mqtts:// (TLS)");
}

const TOPIC_RFID_SCAN = "parking/group17/rfid/scan";
const TOPIC_GATE_COMMAND = "parking/group17/gate/command";
const TOPIC_GATE_STATUS = "parking/group17/gate/status";
const TOPIC_SYSTEM_STATUS = "parking/group17/system/status";

let mqttClient = null;

/**
 * Cập nhật latestData và gửi qua Socket.io lên Frontend
 */
function updateLatestGateStatus(lane, status, source, uid, fee) {
  const io = getIO();
  const receivedAt = new Date().toISOString();
  latestData.gates[lane] = {
    status: status.toUpperCase(),
    source,
    uid,
    fee,
    receivedAt,
  };

  if (io) {
    io.emit("gate-status", {
      topic: TOPIC_GATE_STATUS,
      data: { lane, status: status.toLowerCase(), source, uid, fee },
      receivedAt,
    });
  }
}

/**
 * Gửi JSON lên một MQTT topic.
 */
function publishJson(topic, data, options = {}) {
  if (!mqttClient || !mqttClient.connected) {
    console.error(`Không thể publish ${topic}: MQTT chưa kết nối`);
    return false;
  }

  const payload = JSON.stringify(data);
  mqttClient.publish(
    topic,
    payload,
    {
      qos: options.qos ?? 1,
      retain: options.retain ?? false,
    },
    (error) => {
      if (error) {
        console.error(`MQTT publish lỗi tại ${topic}:`, error.message);
        return;
      }
      console.log(`MQTT publish OK [${topic}]: ${payload}`);
    },
  );
  return true;
}

/**
 * Gửi lệnh cổng cho ESP32 (ID 2)
 */
function sendGateCommand({
  lane,
  action = "open",
  uid = "",
  requestId = "",
  source = "backend",
}) {
  if (!["in", "out"].includes(lane)) {
    throw new Error(`Lane không hợp lệ: ${lane}`);
  }
  if (!["open", "close"].includes(action)) {
    throw new Error(`Action không hợp lệ: ${action}`);
  }

  return publishJson(TOPIC_GATE_COMMAND, {
    messageType: "command", // Khớp với Arduino check
    requestId,
    source,
    action,
    lane,
    uid,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Xử lý UID do ESP32 gửi lên (ID 1 & ID 3)
 */
async function handleRFIDScan(message) {
  const uid = String(message.uid || "")
    .trim()
    .toUpperCase();
  const eventId = String(message.eventId || "");
  const deviceId = String(message.deviceId || "");

  if (!uid) {
    console.warn("Bỏ qua RFID message vì thiếu UID");
    return;
  }

  const VALID_UIDS = ["A288F506", "39B21405"]; // Dữ liệu thẻ hợp lệ (Mock DB)
  if (!VALID_UIDS.includes(uid)) {
    console.warn(
      `Access Denied: Thẻ UID=${uid} không nằm trong danh sách cho phép.`,
    );
    return;
  }

  console.log(`Đang xử lý thẻ hợp lệ UID=${uid}`);

  try {
    // Gọi parkingService để xử lý nghiệp vụ DB và giá cả
    const result = await parkingService.processRFIDScan({
      uid,
      eventId,
      deviceId,
    });

    let rfidStatus = "IDLE";
    let lane = "in";

    if (result.type === "entry") {
      lane = "in";
      rfidStatus = "OPEN";

      // 1. Mở cổng vào
      sendGateCommand({
        lane: "in",
        action: "open",
        uid,
        requestId: eventId,
        source: "backend",
      });

      // 2. Cập nhật Socket state
      updateLatestGateStatus("in", "OPEN", "mqtt", uid, 0);

      // 3. Gửi thông báo Telegram (ID 4)
      telegramService.sendNotification({
        uid,
        event: "entry",
        cardType: result.cardType,
        time: result.session.entryTime,
      });
    } else if (result.type === "exit_vip") {
      lane = "out";
      rfidStatus = "OPEN";

      // 1. Mở cổng ra cho VIP
      sendGateCommand({
        lane: "out",
        action: "open",
        uid,
        requestId: eventId,
        source: "backend",
      });

      // 2. Cập nhật Socket state
      updateLatestGateStatus("out", "OPEN", "mqtt", uid, 0);

      // 3. Gửi thông báo Telegram (ID 4)
      telegramService.sendNotification({
        uid,
        event: "exit",
        cardType: "VIP",
        fee: 0,
        time: result.session.exitTime,
      });
    } else if (result.type === "exit_guest") {
      lane = "out";
      rfidStatus = "PENDING_PAYMENT";

      // 1. Cập nhật Socket state (Yêu cầu thanh toán, không mở cổng ngay)
      updateLatestGateStatus("out", "PENDING_PAYMENT", "mqtt", uid, result.fee);

      // 2. Gửi thông báo Telegram yêu cầu thanh toán (ID 4)
      telegramService.sendNotification({
        uid,
        event: "exit",
        cardType: "GUEST",
        fee: result.fee,
        balance: result.balance,
        time: new Date(), // Thời điểm quét ra
      });
    }

    // Gửi Socket.io thông báo sự kiện quét thẻ lên giao diện
    const rfidData = {
      uid,
      lane,
      status: rfidStatus,
      fee: result.fee,
      cardType: result.cardType,
      balance: result.balance,
      hasSufficientBalance: result.hasSufficientBalance,
      receivedAt: new Date().toISOString(),
    };

    latestData.rfid = rfidData;

    const io = getIO();
    if (io) {
      io.emit("rfid-scan", {
        topic: TOPIC_RFID_SCAN,
        data: rfidData,
        receivedAt: rfidData.receivedAt,
      });
    }
  } catch (error) {
    console.error("Lỗi khi xử lý RFID quét:", error.message);
  }
}

/**
 * Nhận phản hồi trạng thái cổng từ ESP32.
 */
async function handleGateStatus(message) {
  console.log("Gate status từ ESP32:", message);
  if (message.lane) {
    latestData.gates[message.lane] = {
      status: (message.status || "unknown").toUpperCase(),
      source: message.source || "esp32",
      uid: message.uid || null,
      receivedAt: new Date().toISOString(),
    };
  }
}

function handleSystemStatus(message) {
  const receivedAt = new Date().toISOString();
  latestData.device = {
    deviceId: message.deviceId || null,
    status: String(message.status || "offline").toLowerCase(),
    ssid: message.ssid || null,
    ip: message.ip || null,
    rssi: Number.isFinite(Number(message.rssi)) ? Number(message.rssi) : null,
    uptimeMs: Number(message.uptimeMs) || 0,
    receivedAt,
  };

  const io = getIO();
  if (io) {
    io.emit("device-status", latestData.device);
  }
  console.log("ESP32 system status:", latestData.device);
}

/**
 * Khởi tạo MQTT.
 */
function initializeMQTT() {
  if (mqttClient) {
    return mqttClient;
  }

  console.log(`Đang kết nối MQTT: ${MQTT_URL}`);

  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `parking-backend-group17-${Date.now()}`,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  mqttClient.on("connect", () => {
    console.log("Backend đã kết nối MQTT");
    mqttClient.subscribe(
      [TOPIC_RFID_SCAN, TOPIC_GATE_STATUS, TOPIC_SYSTEM_STATUS],
      { qos: 1 },
      (error) => {
        if (error) {
          console.error("Không thể subscribe MQTT:", error.message);
          return;
        }
        console.log("Backend đã subscribe các MQTT topics");
      },
    );
  });

  mqttClient.on("message", async (topic, buffer) => {
    let message;
    try {
      message = JSON.parse(buffer.toString());
    } catch (error) {
      console.error(`JSON MQTT không hợp lệ [${topic}]:`, buffer.toString());
      return;
    }

    try {
      const io = getIO();
      if (topic === TOPIC_RFID_SCAN) {
        await handleRFIDScan(message);
      } else if (topic === TOPIC_GATE_STATUS) {
        await handleGateStatus(message);
      } else if (topic === TOPIC_SYSTEM_STATUS) {
        handleSystemStatus(message);
      }

      if (io) {
        io.emit("mqtt-message", {
          topic,
          data: message,
        });
      }
    } catch (error) {
      console.error(`Lỗi xử lý MQTT topic ${topic}:`, error);
    }
  });

  mqttClient.on("reconnect", () => {
    console.log("Backend đang kết nối lại MQTT...");
  });

  mqttClient.on("offline", () => {
    console.warn("Backend MQTT offline");
  });

  mqttClient.on("error", (error) => {
    console.error("Backend MQTT error:", error.message);
  });

  return mqttClient;
}

function getMQTTClient() {
  return mqttClient;
}

module.exports = {
  initializeMQTT,
  getMQTTClient,
  publishJson,
  sendGateCommand,
};
