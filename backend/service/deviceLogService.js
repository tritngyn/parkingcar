const DeviceLog = require("../models/DeviceLog");

async function writeDeviceLog(data) {
  try {
    return await DeviceLog.create(data);
  } catch (error) {
    // Log giám sát không được làm gián đoạn xử lý RFID/MQTT chính.
    console.error("Không thể ghi device log:", error.message);
    return null;
  }
}

async function getLatestDeviceLog(deviceId) {
  return DeviceLog.findOne({ component: "device", deviceId }).sort({ createdAt: -1 });
}

module.exports = { writeDeviceLog, getLatestDeviceLog };
