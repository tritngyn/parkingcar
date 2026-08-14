const Card = require("../models/Card");
const User = require("../models/User");
const { formatDateTime } = require("../models/ParkingSession");
const TelegramLink = require("../models/TelegramLink");
const { createLinkCode, getBotUsername } = require("../service/telegramBotService");

exports.getAllUsers = async (req, res) => {
  try {
    res.json(await User.find().sort({ createdAt: -1 }));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { fullName, phone, email, cardUid } = req.body;
    if (!fullName || !phone || !cardUid) {
      return res.status(400).json({ success: false, message: "Thiếu fullName, phone hoặc cardUid" });
    }

    const uid = String(cardUid).trim().toUpperCase();
    const card = await Card.findOne({ uid });
    if (!card) {
      return res.status(404).json({ success: false, message: "Thẻ không tồn tại trong kho" });
    }
    if (card.status !== "AVAILABLE" || card.owner) {
      return res.status(409).json({ success: false, message: "Thẻ đã được gán cho user khác" });
    }

    const password = req.body.password || "123456";
    const user = await User.create({ fullName, phone, email, password });
    card.owner = user._id;
    card.status = "ASSIGNED";
    await card.save();
    res.status(201).json({ success: true, data: { user, card } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Số điện thoại đã tồn tại" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.topUp = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Số tiền nạp phải lớn hơn 0" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { balance: amount } },
      { returnDocument: "after", runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user" });
    }
    res.json({ success: true, data: { balance: user.balance } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.topUpMe = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) {
      return res.status(400).json({
        success: false,
        message: "Số tiền nạp phải là số nguyên từ 1 đến 1.000.000.000đ",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { balance: amount } },
      { returnDocument: "after", runValidators: true },
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user" });
    }

    res.json({
      success: true,
      message: "Nạp tiền mô phỏng thành công",
      data: { amount, balance: user.balance },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignCardMe = async (req, res) => {
  try {
    const uid = String(req.body.cardUid || "").trim().toUpperCase();
    const plate = String(req.body.plate || "").trim() || null;
    if (!uid) {
      return res.status(400).json({ success: false, message: "Chưa quét thẻ RFID" });
    }

    const existingCard = await Card.findOne({ owner: req.user.id });
    if (existingCard) {
      return res.status(409).json({ success: false, message: "User đã được gán một thẻ RFID" });
    }

    let card = await Card.findOne({ uid });
    if (card && (card.status !== "AVAILABLE" || card.owner)) {
      return res.status(409).json({
        success: false,
        message: "Thẻ đã được gán cho người khác",
      });
    }

    if (card) {
      card.status = "ASSIGNED";
      card.owner = req.user.id;
      card.plate = plate;
      await card.save();
    } else {
      // UID vừa quét là thẻ vật lý mới: thêm vào kho và gán trong một bước.
      card = await Card.create({
        uid,
        status: "ASSIGNED",
        owner: req.user.id,
        plate,
      });
    }

    res.json({ success: true, message: "Gán thẻ thành công", data: { uid: card.uid, plate: card.plate } });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: error.message });
  }
};

exports.createTelegramLink = async (req, res) => {
  try {
    const code = createLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await TelegramLink.findOneAndUpdate(
      { user: req.user.id },
      { $set: { code, expiresAt } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    const botUsername = await getBotUsername();
    res.json({ success: true, data: { code, expiresAt, url: `https://t.me/${botUsername}?start=${code}` } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.unlinkTelegram = async (req, res) => {
  try {
    await Promise.all([
      User.findByIdAndUpdate(req.user.id, { $set: { "telegram.chatId": null, "telegram.linkedAt": null } }),
      TelegramLink.deleteOne({ user: req.user.id }),
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTelegramPreferences = async (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { "telegram.notificationsEnabled": enabled } },
      { returnDocument: "after" },
    );
    res.json({ success: true, data: { enabled: user.telegram.notificationsEnabled } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const card = await Card.findOne({ owner: userId });
    let transactions = [];
    let thisMonthSessions = 0;
    let thisMonthSpent = 0;

    if (card) {
      const ParkingSession = require("../models/ParkingSession");
      const sessions = await ParkingSession.find({ uid: card.uid }).sort({ entryTime: -1 }).limit(50);
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      sessions.forEach(session => {
        if (session.entryTime >= firstDayOfMonth) {
          thisMonthSessions++;
          if (session.fee) thisMonthSpent += session.fee;
        }

        transactions.push({
          id: session._id,
          type: "entry",
          datetime: formatDateTime(session.entryTime),
          timestamp: session.entryTime.toISOString(),
          lane: "Gate - IN",
          fee: 0
        });

        if (session.status === "completed" && session.exitTime) {
          transactions.push({
            id: session._id + "_exit",
            type: "exit",
            datetime: formatDateTime(session.exitTime),
            timestamp: session.exitTime.toISOString(),
            lane: "Gate - OUT",
            fee: -(session.fee || 0)
          });
        }
      });
      transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    res.json({
      success: true,
      data: {
        user: {
          name: user.fullName,
          initials: user.fullName.substring(0, 2).toUpperCase(),
          phone: user.phone,
          balance: user.balance,
          parkingStatus: user.parkingStatus || "OUT",
          plate: card ? card.plate : "Chưa gắn thẻ",
          cardUid: card ? card.uid : null,
          notifications: 0,
          telegram: {
            linked: Boolean(user.telegram?.chatId),
            linkedAt: user.telegram?.linkedAt || null,
            notificationsEnabled: user.telegram?.notificationsEnabled !== false,
          }
        },
        stats: {
          thisMonthSessions,
          thisMonthSpent
        },
        transactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
