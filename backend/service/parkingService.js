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
  let card = await Card.findOne({ uid }).populate("owner");
  if (!card) {
    await Card.create({ uid, type: "GUEST", status: "AVAILABLE" });
    throw new Error(`Thẻ ${uid} đã được thêm vào kho nhưng chưa được gán cho user`);
  }
  if (card.status !== "ASSIGNED" || !card.owner) {
    throw new Error(`Thẻ ${uid} chưa được gán cho user`);
  }

  // 2. Tìm phiên đỗ xe đang hoạt động (status = active)
  const activeSession = await ParkingSession.findOne({
    uid,
    status: { $in: ["active", "pending_payment"] },
  }).sort({ entryTime: -1 });

  if (activeSession?.status === "pending_payment" || activeSession?.fee > 0) {
    if (activeSession.status !== "pending_payment") {
      activeSession.status = "pending_payment";
      await activeSession.save();
    }
    return {
      type: "exit_guest",
      cardType: "GUEST",
      fee: activeSession.fee,
      balance: card.owner.balance,
      hasSufficientBalance: card.owner.balance >= activeSession.fee,
      session: activeSession,
      uid,
      eventId,
    };
  }

  if (!activeSession) {
    // 3. XE VÀO
    const session = await ParkingSession.create({
      uid,
      status: "active",
      entryTime: new Date(),
      device: deviceId,
      direction: "IN",
    });
    console.log(`XE VÀO: UID=${uid}, session=${session._id}`);

    return {
      type: "entry",
      cardType: card.type,
      balance: card.owner.balance,
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
      activeSession.device = deviceId;
      activeSession.direction = "OUT";
      activeSession.fee = 0;
      await activeSession.save();
      console.log(`XE RA VIP: UID=${uid}`);

      return {
        type: "exit_vip",
        cardType: "VIP",
        balance: card.owner.balance,
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
      activeSession.status = "pending_payment";
      activeSession.device = deviceId;
      activeSession.direction = "OUT";
      await activeSession.save();
      console.log(`XE RA GUEST (YÊU CẦU THANH TOÁN): UID=${uid}, fee=${fee}`);

      return {
        type: "exit_guest",
        cardType: "GUEST",
        balance: card.owner.balance,
        hasSufficientBalance: card.owner.balance >= fee,
        fee,
        session: activeSession,
        uid,
        eventId,
      };
    }
  }
}

/**
 * Xử lý mở cổng thủ công từ giao diện Web
 */
async function processManualGateOpen({ lane, uid, deviceId = "WEB_MANUAL" }) {
  uid = uid || "EMERGENCY";

  if (lane === "in") {
    // XE VÀO (Thủ công)
    // Cố gắng tìm thẻ, nếu không có thì không sao (EMERGENCY)
    const session = await ParkingSession.create({
      uid,
      status: "active",
      entryTime: new Date(),
      device: deviceId,
      direction: "IN",
    });
    console.log(`XE VÀO (THỦ CÔNG): UID=${uid}, session=${session._id}`);
    return session;
  } else if (lane === "out") {
    // XE RA (Thủ công)
    // Nếu có uid cụ thể, tìm phiên đang active
    if (uid !== "EMERGENCY") {
      const activeSession = await ParkingSession.findOne({
        uid,
        status: { $in: ["active", "pending_payment"] },
      }).sort({ entryTime: -1 });

      if (activeSession) {
        const exitTime = new Date();
        const parkedMilliseconds = exitTime.getTime() - activeSession.entryTime.getTime();
        const parkedHours = Math.max(1, Math.ceil(parkedMilliseconds / (60 * 60 * 1000)));
        const pricePerHour = 20; // 20 VND/PHP per hour
        
        // Thẻ VIP thì fee = 0, còn lại tính tiền (kể cả Guest)
        const card = await Card.findOne({ uid });
        const fee = card?.type === "VIP" ? 0 : (parkedHours * pricePerHour);

        activeSession.fee = fee;
        activeSession.status = "completed"; // Hoàn thành luôn (thu tiền mặt / miễn phí)
        activeSession.exitTime = exitTime;
        activeSession.device = deviceId;
        activeSession.direction = "OUT";
        await activeSession.save();
        console.log(`XE RA (THỦ CÔNG - ĐÃ GHI NHẬN DB): UID=${uid}, fee=${fee}`);
        return activeSession;
      }
    }

    // Nếu UID là EMERGENCY hoặc không tìm thấy active session, tạo 1 bản ghi hoàn tất luôn
    const session = await ParkingSession.create({
      uid: "EMERGENCY",
      status: "completed",
      entryTime: new Date(),
      exitTime: new Date(),
      device: deviceId,
      direction: "OUT",
      fee: 0, // Emergency không tính phí
    });
    console.log(`XE RA (THỦ CÔNG - KHẨN CẤP): session=${session._id}`);
    return session;
  }
}

module.exports = {
  processRFIDScan,
  processManualGateOpen,
};
