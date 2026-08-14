const mqtt = require("mqtt");
const parkingService = require("./parkingService");
const { notifyUserByUid } = require("./userNotificationService");
const { getIO, latestData, emitAssignmentCard } = require("./socketService");
const { toVietnamISOString } = require("../utils/dateTime");
const { writeDeviceLog, getLatestDeviceLog } = require("./deviceLogService");
const { recordRFIDScan, notifySystemError, notifyDeviceStatus } = require("./notificationMonitorService");

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
let lastMqttLogStatus = null;
let deviceOfflineTimer = null;
const deviceBootIds = new Map();
const initializedDeviceIds = new Set();

function logMqttStatus(status) {
  if (lastMqttLogStatus === status) return;
  lastMqttLogStatus = status;
  void writeDeviceLog({ component: "mqtt", status });
}

/**
 * Cập nhật latestData và gửi qua Socket.io lên Frontend
 */
function updateLatestGateStatus(lane, status, source, uid, fee) {
  const io = getIO();
  const receivedAt = toVietnamISOString();
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
        notifySystemError("mqtt-publish", `${topic}: ${error.message}`);
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
  source = "backend",
}) {
  if (!["in", "out"].includes(lane)) {
    throw new Error(`Lane không hợp lệ: ${lane}`);
  }
  if (!["open", "close"].includes(action)) {
    throw new Error(`Action không hợp lệ: ${action}`);
  }

  return publishJson(TOPIC_GATE_COMMAND, {
    messageType: "command",
    source,
    action,
    lane,
  });
}

/**
 * Xử lý UID do ESP32 gửi lên (ID 1 & ID 3)
 */
async function handleRFIDScan(message) {
  const uid = String(message.uid || "")
    .trim()
    .toUpperCase();
  const deviceId = String(message.deviceId || "");

  if (!uid) {
    console.warn("Bỏ qua RFID message vì thiếu UID");
    return;
  }

  recordRFIDScan({ uid, deviceId: deviceId || null });

  if (emitAssignmentCard({ uid, deviceId: deviceId || null, receivedAt: toVietnamISOString() })) {
    console.log(`RFID ${uid} được dùng để gán thẻ cho user`);
    return;
  }

  console.log(`Đang xử lý thẻ UID=${uid}`);
  await writeDeviceLog({
    component: "rfid",
    status: "card_received",
    deviceId: deviceId || null,
  });

  let rfidStatus = "IDLE";
  let lane = "in";
  let result = { fee: 0, balance: 0, hasSufficientBalance: false };

  try {
    // Gọi parkingService để xử lý nghiệp vụ DB và giá cả
    result = await parkingService.processRFIDScan({
      uid,
    });


    if (result.type === "entry") {
      lane = "in";
      rfidStatus = "OPEN";

      // 1. Mở cổng vào
      sendGateCommand({
        lane: "in",
        action: "open",
        source: "rfid",
      });

      // 2. Cập nhật Socket state
      updateLatestGateStatus("in", "OPEN", "rfid", uid, 0);

      // 3. Gửi thông báo Telegram (ID 4)
      void notifyUserByUid(uid, "ENTRY", { time: result.session.entryTime });
    } else if (result.type === "exit") {
      lane = "out";
      rfidStatus = "OPEN";

      // 1. Đã trừ tiền thành công, mở cổng ra
      sendGateCommand({
        lane: "out",
        action: "open",
        source: "rfid",
      });

      // 2. Cập nhật Socket state
      updateLatestGateStatus("out", "OPEN", "rfid", uid, 0);

      // 3. Gửi thông báo Telegram (ID 4)
      void notifyUserByUid(uid, "EXIT", {
        fee: result.fee,
        balance: result.balance,
        time: result.session.exitTime,
      });
    } else if (result.type === "exit_insufficient_balance") {
      lane = "out";
      rfidStatus = "PENDING_PAYMENT";

      // 1. Cập nhật Socket state (Yêu cầu thanh toán, không mở cổng ngay)
      updateLatestGateStatus("out", "PENDING_PAYMENT", "rfid", uid, result.fee);

      void notifyUserByUid(uid, "LOW_BALANCE", {
        fee: result.fee,
        balance: result.balance,
      });

    }

    // Gửi Socket.io thông báo sự kiện quét thẻ lên giao diện
    const rfidData = {
      uid,
      lane,
      status: rfidStatus,
      fee: result.fee,
      balance: result.balance,
      hasSufficientBalance: result.hasSufficientBalance,
      receivedAt: toVietnamISOString(),
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
    // Vẫn gửi sự kiện lên Web để hiển thị thẻ bị từ chối
    rfidStatus = "ERROR";
    const errorRfidData = {
      uid,
      lane, // Mặc định hiển thị ở lối vào nếu lỗi (Hoặc có thể để frontend tự handle)
      status: rfidStatus,
      fee: 0,
      balance: 0,
      hasSufficientBalance: false,
      receivedAt: toVietnamISOString(),
    };
    latestData.rfid = errorRfidData;
    const io = getIO();
    if (io) {
      io.emit("rfid-scan", {
        topic: TOPIC_RFID_SCAN,
        data: errorRfidData,
        receivedAt: errorRfidData.receivedAt,
      });
    }
  }
}

/**
 * Nhận phản hồi trạng thái cổng từ ESP32.
 */
async function handleGateStatus(message) {
  console.log("Gate status từ ESP32:", message);
  if (message.lane) {
    const previousGate = latestData.gates[message.lane] || {};
    const receivedAt = toVietnamISOString();
    latestData.gates[message.lane] = {
      status: (message.status || "unknown").toUpperCase(),
      source: message.source || "esp32",
      uid: previousGate.uid || null,
      fee: previousGate.fee || 0,
      receivedAt,
    };

    const io = getIO();
    if (io) {
      io.emit("gate-status", {
        topic: TOPIC_GATE_STATUS,
        data: {
          lane: message.lane,
          status: message.status,
          source: message.source || "esp32",
        },
        receivedAt,
      });
    }
  }
}

async function handleSystemStatus(message) {
  const inMemoryPreviousStatus = latestData.device.status || null;
  const nextDeviceStatus = String(message.status || "offline").toLowerCase();
  const receivedAt = toVietnamISOString();
  const incomingBootId = String(message.bootId || "") || null;
  const isFirstDeviceMessage = Boolean(message.deviceId) && !initializedDeviceIds.has(message.deviceId);
  const latestPersistedLog = isFirstDeviceMessage ? await getLatestDeviceLog(message.deviceId) : null;
  const previousStatus = isFirstDeviceMessage
    ? (latestPersistedLog?.status || inMemoryPreviousStatus)
    : inMemoryPreviousStatus;
  if (message.deviceId) initializedDeviceIds.add(message.deviceId);
  let knownBootId = deviceBootIds.get(message.deviceId) || latestPersistedLog?.bootId || null;
  const bootChanged = nextDeviceStatus === "online" && incomingBootId && knownBootId !== incomingBootId;
  const persistedStatusChanged = isFirstDeviceMessage && latestPersistedLog?.status !== nextDeviceStatus;
  if (incomingBootId && message.deviceId) {
    knownBootId = incomingBootId;
    deviceBootIds.set(message.deviceId, incomingBootId);
  }
  latestData.device = {
    deviceId: message.deviceId || null,
    status: nextDeviceStatus,
    receivedAt,
  };

  const io = getIO();
  if (io) {
    io.emit("device-status", latestData.device);
  }
  console.log("ESP32 system status:", latestData.device);
  if (previousStatus !== latestData.device.status || persistedStatusChanged || bootChanged) {
    await writeDeviceLog({
      component: "device",
      status: latestData.device.status,
      deviceId: latestData.device.deviceId,
      bootId: knownBootId,
      details: { resetReason: message.resetReason, ip: message.ip, uptimeMs: message.uptimeMs },
    });
    if (bootChanged) {
      void notifyDeviceStatus("DEVICE_RESTARTED", {
        deviceId: latestData.device.deviceId,
        resetReason: message.resetReason,
        ip: message.ip,
      });
    }
    if (previousStatus === "online" && latestData.device.status === "offline") {
      void notifyDeviceStatus("DEVICE_OFFLINE", {
        deviceId: latestData.device.deviceId,
        reason: "MQTT Last Will báo thiết bị mất kết nối",
      });
    }
    if (previousStatus === "offline" && latestData.device.status === "online") {
      void notifyDeviceStatus("DEVICE_ONLINE", {
        deviceId: latestData.device.deviceId,
        ip: message.ip,
      });
    }
  }

  if (nextDeviceStatus === "online") {
    if (deviceOfflineTimer) clearTimeout(deviceOfflineTimer);
    deviceOfflineTimer = setTimeout(async () => {
      if (latestData.device.status !== "online") return;
      latestData.device = {
        ...latestData.device,
        status: "offline",
        receivedAt: toVietnamISOString(),
      };
      await writeDeviceLog({
        component: "device",
        status: "offline",
        deviceId: latestData.device.deviceId,
        bootId: knownBootId,
        details: { reason: "heartbeat_timeout" },
      });
      void notifyDeviceStatus("DEVICE_OFFLINE", {
        deviceId: latestData.device.deviceId,
        reason: "Không nhận heartbeat trong 90 giây; có thể mất WiFi hoặc mất nguồn",
      });
      const offlineIO = getIO();
      if (offlineIO) offlineIO.emit("device-status", latestData.device);
    }, 90000);
  } else if (deviceOfflineTimer) {
    clearTimeout(deviceOfflineTimer);
    deviceOfflineTimer = null;
  }
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
    logMqttStatus("connected");
    mqttClient.subscribe(
      [TOPIC_RFID_SCAN, TOPIC_GATE_STATUS, TOPIC_SYSTEM_STATUS],
      { qos: 1 },
      (error) => {
        if (error) {
          console.error("Không thể subscribe MQTT:", error.message);
          logMqttStatus("error");
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
        await handleSystemStatus(message);
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
    logMqttStatus("reconnecting");
  });

  mqttClient.on("offline", () => {
    console.warn("Backend MQTT offline");
    logMqttStatus("disconnected");
    notifySystemError("mqtt", "Backend đã mất kết nối tới MQTT broker");
  });

  mqttClient.on("error", (error) => {
    console.error("Backend MQTT error:", error.message);
    logMqttStatus("error");
    notifySystemError("mqtt", error.message);
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
