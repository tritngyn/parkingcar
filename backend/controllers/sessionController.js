const db = require("../config/dbStore");
const { sendGateCommand } = require("../service/mqttService");
const { getIO, latestData } = require("../service/socketService");

exports.getAllSessions = async (req, res) => {
  try {
    const sessions = await db.sessions.findAll();
    const mapped = sessions.map((s) => {
      const isPendingPayment = s.status === "active" && s.fee > 0;
      let status = "IN";
      if (s.status === "completed") {
        status = "OUT";
      } else if (isPendingPayment) {
        status = "PENDING_PAYMENT";
      }
      return {
        _id: s._id,
        uid: s.uid,
        time_in: s.entryTime || s.createdAt,
        time_out: s.exitTime || null,
        status: status,
        fee: s.fee || 0,
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getActiveSessions = async (req, res) => {
  try {
    const sessions = await db.sessions.findActiveAll();
    const mapped = sessions.map((s) => {
      const isPendingPayment = s.fee > 0;
      return {
        _id: s._id,
        uid: s.uid,
        time_in: s.entryTime || s.createdAt,
        status: isPendingPayment ? "PENDING_PAYMENT" : "IN",
        fee: s.fee || 0,
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
    const session = await db.sessions.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lượt đỗ xe",
      });
    }
    if (session.status !== "active" || session.fee === 0) {
      return res.status(400).json({
        success: false,
        message: `Lượt đỗ xe đang ở trạng thái ${session.status}, không cần thanh toán`,
      });
    }

    session.status = "completed";
    session.exitTime = new Date();
    await db.sessions.save(session);

    // Gửi lệnh mở cổng RA qua MQTT
    const commandSent = sendGateCommand({
      lane: "out",
      action: "open",
      uid: session.uid,
      requestId: `pay-${Date.now()}`,
      source: "backend",
    });

    if (!commandSent) {
      console.error(`Không thể gửi lệnh mở cổng ra cho UID ${session.uid}`);
    } else {
      console.log(`Đã gửi lệnh mở cổng RA cho UID ${session.uid}`);
    }

    const receivedAt = new Date().toISOString();
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

    // [ID 4] Gửi thông báo Telegram (sẽ được tích hợp qua telegramService)
    try {
      const telegramService = require("../service/telegramService");
      telegramService.sendNotification({
        uid: session.uid,
        event: "exit",
        cardType: "GUEST",
        fee: session.fee,
        time: session.exitTime,
      });
    } catch (e) {
      console.warn("Telegram notification fallback failed:", e.message);
    }

    res.json({
      success: true,
      message: "Thanh toán thành công, cổng exit đã mở",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSessionStats = async (req, res) => {
  try {
    const sessions = await db.sessions.findAll();

    // Khởi tạo các khung giờ từ 06:00 đến 20:00 tương ứng Recharts
    const hours = [];
    for (let h = 6; h <= 20; h++) {
      const padHour = String(h).padStart(2, "0") + ":00";
      hours.push(padHour);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = hours.map((h) => {
      const [hStr] = h.split(":");
      const hourNum = parseInt(hStr, 10);

      // Lọc xe vào trong giờ này hôm nay
      const entries = sessions.filter((s) => {
        const eTime = new Date(s.entryTime || s.createdAt);
        const eDate = new Date(eTime);
        eDate.setHours(0, 0, 0, 0);
        return eDate.getTime() === today.getTime() && eTime.getHours() === hourNum;
      }).length;

      // Lọc xe ra trong giờ này hôm nay
      const exits = sessions.filter((s) => {
        if (!s.exitTime) return false;
        const exTime = new Date(s.exitTime);
        const exDate = new Date(exTime);
        exDate.setHours(0, 0, 0, 0);
        return exDate.getTime() === today.getTime() && exTime.getHours() === hourNum;
      }).length;

      // Tính tổng doanh thu thu được trong giờ này hôm nay
      const revenue = sessions
        .filter((s) => {
          if (!s.exitTime || !s.fee) return false;
          const exTime = new Date(s.exitTime);
          const exDate = new Date(exTime);
          exDate.setHours(0, 0, 0, 0);
          return exDate.getTime() === today.getTime() && exTime.getHours() === hourNum;
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
