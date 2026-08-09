const { sendGateCommand } = require("../service/mqttService");
const { getIO, latestData } = require("../service/socketService");

exports.controlGate = async (req, res) => {
  try {
    const { lane, action } = req.body; // lane: "in"/"out", action: "open"/"close"
    if (!lane || !action) {
      return res.status(400).json({
        success: false,
        message: "Thiếu lane hoặc action",
      });
    }

    const commandSent = sendGateCommand({
      lane: lane,
      action: action,
      uid: "MANUAL",
      requestId: `manual-${Date.now()}`,
      source: "backend",
    });

    if (!commandSent) {
      console.error(
        `Không thể gửi lệnh điều khiển cổng thủ công (${lane} -> ${action})`
      );
    } else {
      console.log(
        `Đã gửi lệnh điều khiển cổng thủ công (${lane} -> ${action})`
      );
    }

    const receivedAt = new Date().toISOString();
    latestData.gates[lane] = {
      status: action.toUpperCase(),
      source: "manual-api",
      uid: "MANUAL",
      receivedAt: receivedAt,
    };

    const io = getIO();
    if (io) {
      io.emit("gate-status", {
        topic: "parking/group17/gate/status",
        data: { lane: lane, status: action, source: "manual-api" },
        receivedAt: receivedAt,
      });
    }

    res.json({
      success: true,
      message: `Đã gửi lệnh ${action} cho cổng ${lane}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
