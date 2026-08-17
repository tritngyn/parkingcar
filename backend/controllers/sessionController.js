const ParkingSession = require("../models/ParkingSession");
const { formatDateTime } = require("../models/ParkingSession");
const { sendGateCommand } = require("../service/mqttService");
const { getIO, latestData } = require("../service/socketService");
const Card = require("../models/Card");
const User = require("../models/User");
const { toVietnamISOString } = require("../utils/dateTime");
const { calculateParkingFee } = require("../utils/parkingFee");

function getDisplayedFee(session, now = new Date()) {
  return session.status === "active"
    ? calculateParkingFee(session.entryTime, now)
    : (session.fee || 0);
}

exports.getAllSessions = async (req, res) => {
  try {
    const sessions = await ParkingSession.find().sort({ entryTime: -1 });
    const mapped = sessions.map((s) => {
      const isPendingPayment = s.status === "pending_payment" || (s.status === "active" && s.fee > 0);
      let status = "IN";
      if (s.status === "completed") {
        status = "OUT";
      } else if (isPendingPayment) {
        status = "PENDING_PAYMENT";
      }
      return {
        _id: s._id,
        uid: s.uid,
        user: s.user,
        direction: s.direction || status,
        time_in: formatDateTime(s.entryTime),
        time_out: formatDateTime(s.exitTime),
        status: status,
        fee: getDisplayedFee(s),
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getActiveSessions = async (req, res) => {
  try {
    const sessions = await ParkingSession.find({
      status: { $in: ["active", "pending_payment"] }
    }).sort({ entryTime: -1 });
    const mapped = sessions.map((s) => {
      const isPendingPayment = s.fee > 0;
      return {
        _id: s._id,
        uid: s.uid,
        user: s.user,
        direction: s.direction || "IN",
        time_in: formatDateTime(s.entryTime),
        status: isPendingPayment ? "PENDING_PAYMENT" : "IN",
        fee: getDisplayedFee(s),
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.paySession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã lượt đỗ xe (sessionId)",
      });
    }
    const session = await ParkingSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lượt đỗ xe",
      });
    }
    if (!["active", "pending_payment"].includes(session.status) || session.fee === 0) {
      return res.status(400).json({
        success: false,
        message: `Lượt đỗ xe đang ở trạng thái ${session.status}, không cần thanh toán`,
      });
    }

    const card = await Card.findOne({ uid: session.uid });
    if (!card || card.status !== "ASSIGNED" || !card.owner) {
      return res.status(400).json({
        success: false,
        message: "Thẻ chưa được gán cho user",
      });
    }

    // Admin confirms this payment manually. This flow intentionally bypasses
    // the card owner's balance check and does not debit their account.
    const user = await User.findById(card.owner);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng sở hữu thẻ",
      });
    }

    session.status = "completed";
    session.direction = "OUT";
    session.exitTime = new Date();
    try {
      await session.save();
      await User.findByIdAndUpdate(card.owner, { $set: { parkingStatus: "OUT" } });
    } catch (error) {
      session.status = "pending_payment";
      session.direction = "IN";
      session.exitTime = null;
      await session.save().catch(() => {});
      throw error;
    }

    // Gửi lệnh mở cổng RA qua MQTT
    const commandSent = sendGateCommand({
      lane: "out",
      action: "open",
      source: "web",
    });

    if (!commandSent) {
      console.error(`Không thể gửi lệnh mở cổng ra cho UID ${session.uid}`);
    } else {
      console.log(`Đã gửi lệnh mở cổng RA cho UID ${session.uid}`);
    }

    const receivedAt = toVietnamISOString();
    latestData.gates.out = {
      status: "OPEN",
      source: "api-pay",
      uid: session.uid,
      fee: session.fee,
      receivedAt: receivedAt,
    };

    const io = getIO();
    if (io) {
      io.emit("gate-status", {
        topic: "parking/group17/gate/status",
        data: {
          lane: "out",
          status: "open",
          source: "api-pay",
          uid: session.uid,
          fee: session.fee,
        },
        receivedAt: receivedAt,
      });
    }

    const { notifyUserByUid } = require("../service/userNotificationService");
    void notifyUserByUid(session.uid, "PAYMENT_SUCCESS", {
      fee: session.fee,
      balance: user.balance,
      time: session.exitTime,
    });

    res.json({
      success: true,
      message: "Thanh toán thành công, cổng exit đã mở",
      fee: session.fee,
      balance: user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSessionStats = async (req, res) => {
  try {
    const sessions = await ParkingSession.find().sort({ entryTime: -1 });

    const vietnamParts = (value) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(value));
      return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
    };

    // Cover the full day so overnight traffic is not omitted from analytics.
    const hours = [];
    for (let h = 0; h <= 23; h++) {
      const padHour = String(h).padStart(2, "0") + ":00";
      hours.push(padHour);
    }

    const today = vietnamParts(new Date());
    const isTodayAtHour = (value, hour) => {
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      const parts = vietnamParts(date);
      return parts.year === today.year &&
        parts.month === today.month &&
        parts.day === today.day &&
        Number(parts.hour) === hour;
    };

    const stats = hours.map((h) => {
      const [hStr] = h.split(":");
      const hourNum = parseInt(hStr, 10);

      // Lọc xe vào trong giờ này hôm nay
      const entries = sessions.filter((s) => {
        return isTodayAtHour(s.entryTime || s.createdAt, hourNum);
      }).length;

      // Lọc xe ra trong giờ này hôm nay
      const exits = sessions.filter((s) => {
        return isTodayAtHour(s.exitTime, hourNum);
      }).length;

      // Tính tổng doanh thu thu được trong giờ này hôm nay
      const revenue = sessions
        .filter((s) => {
          if (!s.exitTime || !s.fee) return false;
          return isTodayAtHour(s.exitTime, hourNum);
        })
        .reduce((sum, s) => sum + (s.fee || 0), 0);

      return {
        hour: h,
        entries,
        exits,
        revenue,
      };
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
