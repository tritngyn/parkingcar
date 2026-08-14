const ParkingSession = require("../models/ParkingSession");
const Card = require("../models/Card");
const {
  notifyParkingTooLong,
  sendAdminNotification,
} = require("./telegramService");

const RFID_WINDOW_MS = Number(process.env.RFID_SPAM_WINDOW_MS) || 10000;
const RFID_THRESHOLD = Number(process.env.RFID_SPAM_THRESHOLD) || 5;
const ALERT_COOLDOWN_MS = Number(process.env.TELEGRAM_ALERT_COOLDOWN_MS) || 300000;
const LONG_PARKING_MS = Number(process.env.LONG_PARKING_HOURS || 8) * 60 * 60 * 1000;
const MONITOR_INTERVAL_MS = Number(process.env.PARKING_MONITOR_INTERVAL_MS) || 60000;

const rfidScans = new Map();
const systemAlertTimes = new Map();
let parkingTimer = null;
let parkingCheckRunning = false;

function recordRFIDScan({ uid, lane = "unknown", deviceId = null }) {
  const now = Date.now();
  const previous = rfidScans.get(uid) || { times: [], alertedAt: 0 };
  const times = previous.times.filter((time) => now - time <= RFID_WINDOW_MS);
  times.push(now);
  rfidScans.set(uid, { times, alertedAt: previous.alertedAt });

  if (times.length < RFID_THRESHOLD || now - previous.alertedAt < ALERT_COOLDOWN_MS) return false;

  rfidScans.set(uid, { times, alertedAt: now });
  void sendAdminNotification({
    type: "RFID_SPAM",
    data: {
      uid,
      count: times.length,
      seconds: Math.round(RFID_WINDOW_MS / 1000),
      lane,
      deviceId,
      time: new Date(now),
    },
  });
  return true;
}

function notifySystemError(source, message) {
  const key = `${source}:${message}`;
  const now = Date.now();
  if (now - (systemAlertTimes.get(key) || 0) < ALERT_COOLDOWN_MS) return Promise.resolve(false);
  systemAlertTimes.set(key, now);
  return sendAdminNotification({
    type: "SYSTEM_ERROR",
    data: { source, message, time: new Date(now) },
  });
}

function notifyDeviceStatus(type, data) {
  const key = `${type}:${data.deviceId || "unknown"}`;
  const now = Date.now();
  if (type === "DEVICE_OFFLINE" && now - (systemAlertTimes.get(key) || 0) < ALERT_COOLDOWN_MS) {
    return Promise.resolve(false);
  }
  systemAlertTimes.set(key, now);
  return sendAdminNotification({ type, data: { ...data, time: new Date(now) } });
}

async function checkLongParkingSessions() {
  if (parkingCheckRunning) return;
  parkingCheckRunning = true;
  try {
    const cutoff = new Date(Date.now() - LONG_PARKING_MS);
    const sessions = await ParkingSession.find({
      status: { $in: ["active", "pending_payment"] },
      exitTime: null,
      entryTime: { $lte: cutoff },
      longParkingNotifiedAt: null,
    }).populate("user", "fullName telegram");

    for (const session of sessions) {
      const card = await Card.findOne({ uid: session.uid }).select("plate owner").populate("owner", "fullName telegram");
      const user = session.user || card?.owner;
      const userChatId = user?.telegram?.notificationsEnabled === false ? null : user?.telegram?.chatId;
      const results = await notifyParkingTooLong({
        userChatId,
        uid: session.uid,
        licensePlate: card?.plate,
        userName: user?.fullName,
        entryTime: session.entryTime,
        durationMs: Date.now() - session.entryTime.getTime(),
      });
      const delivered = results.some((result) => result.status === "fulfilled" && result.value === true);
      if (delivered) {
        session.longParkingNotifiedAt = new Date();
        await session.save();
      }
    }
  } catch (error) {
    notifySystemError("parking-monitor", error.message);
  } finally {
    parkingCheckRunning = false;
  }
}

function startNotificationMonitor() {
  if (parkingTimer) return parkingTimer;
  void checkLongParkingSessions();
  parkingTimer = setInterval(() => void checkLongParkingSessions(), MONITOR_INTERVAL_MS);
  return parkingTimer;
}

function stopNotificationMonitor() {
  if (parkingTimer) clearInterval(parkingTimer);
  parkingTimer = null;
}

module.exports = {
  recordRFIDScan,
  notifySystemError,
  notifyDeviceStatus,
  checkLongParkingSessions,
  startNotificationMonitor,
  stopNotificationMonitor,
};
