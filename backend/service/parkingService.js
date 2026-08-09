const Card = require("../models/Card");
const ParkingSession = require("../models/ParkingSession");

/**
 * Xử lý nghiệp vụ lõi khi quẹt thẻ RFID (Xe vào / Xe ra) (ID 1 & ID 3)
 * @param {Object} param0
 * @param {string} param0.uid - Mã UID thẻ RFID
 * @param {string} param0.eventId - Mã sự kiện quét thẻ từ ESP32
 * @param {string} param0.deviceId - Mã thiết bị ESP32 quét thẻ
 * @returns {Promise<Object>} Trả về thông tin kết quả xử lý nghiệp vụ
 */
async function processRFIDScan({ uid, eventId, deviceId }) {
  uid = String(uid || "").trim().toUpperCase();
  if (!uid) {
    throw new Error("UID không hợp lệ");
  }

  // 1. Tìm thông tin thẻ (để biết VIP hay GUEST)
  let card = await Card.findOne({ uid });
  if (!card) {
    card = await Card.create({ uid, type: "GUEST" });
    console.log(`Tự động đăng ký thẻ mới UID: ${uid} làm GUEST`);
  }

  // 2. Tìm phiên đỗ xe đang hoạt động (status = active)
  const activeSession = await ParkingSession.findOne({
    uid,
    status: "active",
  }).sort({ entryTime: -1 });

  if (!activeSession) {
    // 3. XE VÀO
    const session = await ParkingSession.create({
      uid,
      status: "active",
      entryTime: new Date(),
      entryDeviceId: deviceId,
      entryEventId: eventId,
    });
    console.log(`XE VÀO: UID=${uid}, session=${session._id}`);

    return {
      type: "entry",
      cardType: card.type,
      fee: 0,
      session,
      uid,
      eventId,
    };
  } else {
    // 4. XE RA
    const exitTime = new Date();

    if (card.type === "VIP") {
      activeSession.status = "completed";
      activeSession.exitTime = exitTime;
      activeSession.exitDeviceId = deviceId;
      activeSession.exitEventId = eventId;
      activeSession.fee = 0;
      await activeSession.save();
      console.log(`XE RA VIP: UID=${uid}`);

      return {
        type: "exit_vip",
        cardType: "VIP",
        fee: 0,
        session: activeSession,
        uid,
        eventId,
      };
    } else {
      // Xe GUEST ra: tính toán phí đỗ xe nhưng giữ trạng thái active chờ thanh toán
      const parkedMilliseconds =
        exitTime.getTime() - activeSession.entryTime.getTime();
      const parkedHours = Math.max(
        1,
        Math.ceil(parkedMilliseconds / (60 * 60 * 1000))
      );
      const pricePerHour = 20; // 20 PHP/giờ
      const fee = parkedHours * pricePerHour;

      activeSession.fee = fee;
      await activeSession.save();
      console.log(`XE RA GUEST (YÊU CẦU THANH TOÁN): UID=${uid}, fee=${fee}`);

      return {
        type: "exit_guest",
        cardType: "GUEST",
        fee,
        session: activeSession,
        uid,
        eventId,
      };
    }
  }
}

module.exports = {
  processRFIDScan,
};
