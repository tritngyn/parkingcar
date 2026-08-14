const Admin = require("../models/Admin");
const User = require("../models/User");
const Card = require("../models/Card");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

exports.signup = async (req, res) => {
  try {
    const { fullName, phone, password, plate, cardUid } = req.body;
    if (!fullName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (fullName, phone, password)",
      });
    }

    let user = await User.findOne({ phone });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại này đã được đăng ký",
      });
    }

    if (cardUid) {
      const uid = String(cardUid).trim().toUpperCase();
      const mongoSession = await mongoose.startSession();
      try {
        await mongoSession.withTransaction(async () => {
        const availableCard = await Card.findOne({
          uid,
          status: "AVAILABLE",
          owner: null,
        }).session(mongoSession);
        if (!availableCard) {
          const error = new Error("Thẻ không tồn tại hoặc đã được gán cho người khác");
          error.statusCode = 409;
          throw error;
        }

        user = new User({ fullName, phone, password });
        await user.save({ session: mongoSession });

        const assignedCard = await Card.findOneAndUpdate(
          { _id: availableCard._id, status: "AVAILABLE", owner: null },
          { $set: { status: "ASSIGNED", owner: user._id, plate: plate || null } },
          { returnDocument: "after", session: mongoSession, runValidators: true },
        );
        if (!assignedCard) {
          const error = new Error("Thẻ vừa được gán cho người khác, vui lòng quét thẻ khác");
          error.statusCode = 409;
          throw error;
        }
        });
      } finally {
        await mongoSession.endSession();
      }
    } else {
      user = new User({ fullName, phone, password });
      await user.save();
    }
    
    res.status(201).json({
      success: true,
      message: cardUid
        ? "Đăng ký tài khoản và gán thẻ thành công"
        : "Đăng ký tài khoản thành công, bạn có thể gán thẻ sau khi đăng nhập",
    });
  } catch (err) {
    res.status(err.statusCode || (err.code === 11000 ? 409 : 500)).json({
      success: false,
      message: err.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body; // username có thể là admin username hoặc user phone
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên đăng nhập hoặc mật khẩu",
      });
    }



    // 1. Kiểm tra bảng Admin trước
    const admin = await Admin.findOne({ username });
    if (admin) {
      const isMatch = await admin.comparePassword(password);
      if (isMatch) {
        const token = jwt.sign(
          { id: admin._id, username: admin.username, role: "admin" },
          process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
          { expiresIn: "1d" }
        );
        return res.json({
          success: true,
          token,
          user: { username: admin.username, role: "admin" },
        });
      }
    }

    // 2. Nếu không phải Admin, kiểm tra bảng User (coi username là phone)
    const user = await User.findOne({ phone: username });
    if (user) {
      const isMatch = await user.comparePassword(password);
      if (isMatch) {
        const token = jwt.sign(
          { id: user._id, phone: user.phone, role: "user" },
          process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
          { expiresIn: "1d" }
        );
        return res.json({
          success: true,
          token,
          user: { fullName: user.fullName, phone: user.phone, role: "user" },
        });
      }
    }

    // Không tìm thấy hoặc sai pass
    return res.status(401).json({
      success: false,
      message: "Tên đăng nhập hoặc mật khẩu không đúng",
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
