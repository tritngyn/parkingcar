const Card = require("../models/Card");
const User = require("../models/User");
const ParkingSession = require("../models/ParkingSession");
const { formatDateTime } = require("../models/ParkingSession");
const { calculateParkingFee } = require("../utils/parkingFee");

/**
 * Xử lý nghiệp vụ lõi khi quẹt thẻ RFID (Xe vào / Xe ra)
 * @param {Object} param0
 * @param {string} param0.uid      - Mã UID thẻ RFID
 * @returns {Promise<Object>} Kết quả xử lý
 */
async function processRFIDScan({ uid }) {
  uid = String(uid || "").trim().toUpperCase();
  if (!uid) throw new Error("UID không hợp lệ");

  // 1. Kiểm tra thẻ hợp lệ và đã gán cho user
  let card = await Card.findOne({ uid }).populate("owner");
  if (!card) {
    await Card.create({ uid, status: "AVAILABLE" });
    throw new Error(`Thẻ ${uid} đã được thêm vào kho nhưng chưa được gán cho user`);
  }
  if (card.status !== "ASSIGNED" || !card.owner) {
    throw new Error(`Thẻ ${uid} chưa được gán cho user`);
  }

  // 2. Tìm phiên đỗ xe đang mở (active hoặc pending_payment)
  const activeSession = await ParkingSession.findOne({
    uid,
    status: { $in: ["active", "pending_payment"] },
  }).sort({ entryTime: -1 });

  // 3. Không có phiên → XE VÀO
  if (!activeSession) {
    const entryTime = new Date();
    const session = await ParkingSession.create({
      uid,
      user: card.owner._id,
      direction: "IN",
      status: "active",
      entryTime,
      exitTime: null,
    });
    try {
      await User.findByIdAndUpdate(card.owner._id, { $set: { parkingStatus: "IN" } });
    } catch (error) {
      await ParkingSession.deleteOne({ _id: session._id });
      throw error;
    }
    console.log(`XE VÀO: UID=${uid} lúc ${formatDateTime(entryTime)}, session=${session._id}`);

    return {
      type: "entry",
      balance: card.owner.balance,
      fee: 0,
      session,
      uid,
    };
  }

  // 4. Có phiên active → XE RA
  const exitTime = new Date();

  const fee = calculateParkingFee(activeSession.entryTime, exitTime);
  const user = await User.findOneAndUpdate(
    { _id: card.owner._id, balance: { $gte: fee } },
    { $inc: { balance: -fee } },
    { returnDocument: "after", runValidators: true },
  );

  if (!user) {
    activeSession.fee = fee;
    activeSession.status = "pending_payment";
    await activeSession.save();
    console.log(`XE RA KHÔNG ĐỦ SỐ DƯ: UID=${uid}, fee=${fee}`);
    return {
      type: "exit_insufficient_balance",
      balance: card.owner.balance,
      hasSufficientBalance: false,
      fee,
      session: activeSession,
      uid,
    };
  }

  activeSession.status = "completed";
  activeSession.direction = "OUT";
  activeSession.exitTime = exitTime;
  activeSession.fee = fee;
  try {
    await activeSession.save();
  } catch (error) {
    await User.findByIdAndUpdate(user._id, { $inc: { balance: fee } });
    throw error;
  }
  try {
    await User.findByIdAndUpdate(user._id, { $set: { parkingStatus: "OUT" } });
  } catch (error) {
    activeSession.status = "active";
    activeSession.direction = "IN";
    activeSession.exitTime = null;
    activeSession.fee = 0;
    await activeSession.save();
    await User.findByIdAndUpdate(user._id, { $inc: { balance: fee } });
    throw error;
  }
  console.log(`XE RA: UID=${uid} lúc ${formatDateTime(exitTime)}, fee=${fee}`);
  return {
    type: "exit",
    balance: user.balance,
    hasSufficientBalance: true,
    fee,
    session: activeSession,
    uid,
  };
}

/**
 * Xử lý mở cổng thủ công từ giao diện Web
 * @param {Object} param0
 * @param {string} param0.lane - "in" hoặc "out"
 * @param {string} param0.uid  - UID thẻ (hoặc "EMERGENCY")
 */
async function processManualGateOpen({ lane, uid }) {
  uid = uid || "EMERGENCY";

  if (lane === "in") {
    // XE VÀO (Thủ công)
    const entryTime = new Date();
    const session = await ParkingSession.create({
      uid,
      direction: "IN",
      status: "active",
      entryTime,
      exitTime: null,
    });
    console.log(`XE VÀO (THỦ CÔNG): UID=${uid} lúc ${formatDateTime(entryTime)}, session=${session._id}`);
    return session;
  }

  if (lane === "out") {
    // XE RA (Thủ công)
    if (uid !== "EMERGENCY") {
      const activeSession = await ParkingSession.findOne({
        uid,
        status: { $in: ["active", "pending_payment"] },
      }).sort({ entryTime: -1 });

      if (activeSession) {
        const exitTime = new Date();
        const fee = calculateParkingFee(activeSession.entryTime, exitTime);

        activeSession.fee = fee;
        activeSession.status = "completed";
        activeSession.direction = "OUT";
        activeSession.exitTime = exitTime;
        await activeSession.save();
        if (activeSession.user) {
          await User.findByIdAndUpdate(activeSession.user, { $set: { parkingStatus: "OUT" } });
        } else {
          const assignedCard = await Card.findOne({ uid }).select("owner");
          if (assignedCard?.owner) {
            activeSession.user = assignedCard.owner;
            await activeSession.save();
            await User.findByIdAndUpdate(assignedCard.owner, { $set: { parkingStatus: "OUT" } });
          }
        }
        console.log(`XE RA (THỦ CÔNG): UID=${uid} lúc ${formatDateTime(exitTime)}, fee=${fee}`);
        return activeSession;
      }
    }

    // EMERGENCY hoặc không tìm thấy phiên
    const now = new Date();
    const session = await ParkingSession.create({
      uid: "EMERGENCY",
      direction: "OUT",
      status: "completed",
      entryTime: now,
      exitTime: now,
      fee: 0,
    });
    console.log(`XE RA (KHẨN CẤP): session=${session._id} lúc ${formatDateTime(now)}`);
    return session;
  }
}

module.exports = { processRFIDScan, processManualGateOpen };
