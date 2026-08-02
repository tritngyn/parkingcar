const mqtt = require("mqtt");
const ParkingSession = require("../models/ParkingSession");
const Card = require("../models/Card");

// Mặc định sử dụng broker.emqx.io giống ESP32
const MQTT_URL = process.env.MQTT_BROKER || "mqtt://broker.emqx.io:1883";

const TOPIC_RFID_SCAN = "parking/group17/rfid/scan";
const TOPIC_GATE_COMMAND = "parking/group17/gate/command";
const TOPIC_GATE_STATUS = "parking/group17/gate/status";
const TOPIC_SYSTEM_STATUS = "parking/group17/system/status";

let mqttClient = null;
let ioInstance = null;
let latestDataRef = null;

/**
 * Cập nhật latestData và gửi qua Socket.io lên Frontend
 */
function updateLatestGateStatus(lane, status, source, uid, fee, io) {
  if (latestDataRef) {
    const receivedAt = new Date().toISOString();
    latestDataRef.gates[lane] = {
      status: status.toUpperCase(),
      source,
      uid,
      fee,
      receivedAt
    };

    if (io) {
      io.emit("gate-status", {
        topic: TOPIC_GATE_STATUS,
        data: { lane, status: status.toLowerCase(), source, uid, fee },
        receivedAt
      });
    }
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
    }
  );
  return true;
}

/**
 * Gửi lệnh cổng cho ESP32.
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
    messageType: "command",
    lane: lane,
    action: action,
    source: source,
    uid: uid,
    requestId: requestId || `backend-req-${Date.now()}`
  });
}

/**
 * Xử lý UID do ESP32 gửi lên.
 */
async function handleRFIDScan(message, io) {
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
    console.warn(`Access Denied: Thẻ UID=${uid} không nằm trong danh sách cho phép.`);
    return;
  }

  console.log(`Đang xử lý thẻ hợp lệ UID=${uid}`);

  // Tìm thông tin thẻ
  let card = await Card.findOne({ uid });
  if (!card) {
    card = await Card.create({ uid, balance: 0 });
    console.log(`Tự động đăng ký thẻ mới UID: ${uid} với balance=0`);
  }

  // Tìm phiên đỗ xe đang hoạt động (status = active)
  const activeSession = await ParkingSession.findOne({
    uid,
    status: "active",
  }).sort({ entryTime: -1 });

  let rfidStatus = "IDLE";
  let fee = 0;
  let lane = "in";

  if (!activeSession) {
    // XE VÀO
    lane = "in";
    rfidStatus = "OPEN";
    await handleVehicleEntry({ uid, eventId, deviceId });
  } else {
    // XE RA
    lane = "out";
    const result = await handleVehicleExit({ uid, eventId, deviceId, card, activeSession, io });
    rfidStatus = result.rfidStatus;
    fee = result.fee;
  }

  // Gửi Socket.io thông báo sự kiện quét thẻ lên giao diện
  const rfidData = {
    uid,
    lane,
    status: rfidStatus,
    fee,
    cardType: card.type,
    receivedAt: new Date().toISOString()
  };

  if (latestDataRef) {
    latestDataRef.rfid = rfidData;
  }

  if (io) {
    io.emit("rfid-scan", {
      topic: TOPIC_RFID_SCAN,
      data: rfidData,
      receivedAt: rfidData.receivedAt
    });
  }
}

/**
 * Xe vào.
 */
async function handleVehicleEntry({ uid, eventId, deviceId }) {
  const session = await ParkingSession.create({
    uid,
    status: "active",
    entryTime: new Date(),
    entryDeviceId: deviceId,
    entryEventId: eventId,
  });

  console.log(`XE VÀO: UID=${uid}, session=${session._id}`);

  sendGateCommand({
    lane: "in",
    action: "open",
    uid,
    requestId: eventId,
    source: "backend",
  });

  updateLatestGateStatus("in", "OPEN", "mqtt", uid, 0, ioInstance);
}

/**
 * Xe ra (xử lý chung theo số dư balance).
 */
async function handleVehicleExit({ uid, eventId, deviceId, card, activeSession, io }) {
  const exitTime = new Date();
  const parkedMilliseconds = exitTime.getTime() - activeSession.entryTime.getTime();
  const parkedHours = Math.max(1, Math.ceil(parkedMilliseconds / (60 * 60 * 1000)));
  const pricePerHour = 20; 
  const fee = parkedHours * pricePerHour;

  activeSession.fee = fee;
  activeSession.exitTime = exitTime;
  activeSession.exitDeviceId = deviceId;
  activeSession.exitEventId = eventId;

  // Lấy balance từ db / card model
  const balance = card.balance || 0;

  if (balance >= fee) {
    // Tự động trừ tiền
    card.balance -= fee;
    if (card.save && typeof card.save === "function") await card.save();
    
    activeSession.status = "completed";
    await activeSession.save();

    console.log(`XE RA (TỰ ĐỘNG TRỪ TIỀN): UID=${uid}, trừ ${fee}`);

    sendGateCommand({ lane: "out", action: "open", uid, requestId: eventId, source: "backend" });
    updateLatestGateStatus("out", "OPEN", "mqtt", uid, 0, io);
    return { rfidStatus: "OPEN", fee: 0 };
  } else {
    // Thiếu tiền, giữ session active để chờ thanh toán
    activeSession.status = "active";
    await activeSession.save();

    console.log(`XE RA (YÊU CẦU THANH TOÁN): UID=${uid}, fee=${fee}`);

    updateLatestGateStatus("out", "PENDING_PAYMENT", "mqtt", uid, fee, io);
    return { rfidStatus: "PENDING_PAYMENT", fee };
  }
}

/**
 * Nhận phản hồi trạng thái cổng từ ESP32.
 */
async function handleGateStatus(message, io) {
  console.log("Gate status từ ESP32:", message);
  if (latestDataRef && message.lane) {
    latestDataRef.gates[message.lane] = {
      status: (message.status || "unknown").toUpperCase(),
      source: message.source || "esp32",
      uid: message.uid || null,
      receivedAt: new Date().toISOString()
    };
  }
}

/**
 * Khởi tạo MQTT.
 */
function initializeMQTT(io = null, latestData = null) {
  if (mqttClient) {
    return mqttClient;
  }

  ioInstance = io;
  latestDataRef = latestData;

  console.log(`Đang kết nối MQTT: ${MQTT_URL}`);

  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `parking-backend-group17-${Date.now()}`,
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
      }
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
      if (topic === TOPIC_RFID_SCAN) {
        await handleRFIDScan(message, io);
      } else if (topic === TOPIC_GATE_STATUS) {
        await handleGateStatus(message, io);
      } else if (topic === TOPIC_SYSTEM_STATUS) {
        console.log("ESP32 system status:", message);
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
