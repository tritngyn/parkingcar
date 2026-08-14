const Card = require("../models/Card");

exports.getAllCards = async (req, res) => {
  try {
    const cards = await Card.find()
      .populate("owner", "fullName phone email balance")
      .sort({ createdAt: -1 });
    res.json(cards);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCard = async (req, res) => {
  try {
    const uid = String(req.body.uid || "").trim().toUpperCase();
    if (!uid) {
      return res.status(400).json({ success: false, message: "Thiếu UID của thẻ" });
    }
    const existingCard = await Card.findOne({ uid });
    if (existingCard) {
      return res.status(400).json({
        success: false,
        message: "Thẻ UID này đã được đăng ký trước đó",
      });
    }
    const card = await Card.create({ uid, status: "AVAILABLE", owner: null });
    res.status(201).json({ success: true, data: card });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const result = await Card.findOneAndDelete({ uid: req.params.uid });
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thẻ cần xóa",
      });
    }
    res.json({ success: true, message: "Xóa thẻ thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
