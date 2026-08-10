const Card = require("../models/Card");
const User = require("../models/User");

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

    const user = await User.create({ fullName, phone, email });
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
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
