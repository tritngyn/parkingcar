const Admin = require("../models/Admin");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const db = require("../config/dbStore");

exports.signup = async (req, res) => {
  try {
    const { fullName, phone, password, plate } = req.body;
    if (!fullName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (fullName, phone, password)",
      });
    }

    if (!db.isDBConnected()) {
      return res.status(400).json({
        success: false,
        message: "Không thể đăng ký người dùng ở chế độ In-Memory",
      });
    }

    let user = await User.findOne({ phone });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại này đã được đăng ký",
      });
    }

    user = new User({ fullName, phone, password });
    await user.save();

    // Tạm thời chưa gán thẻ (sẽ gán bởi Admin sau), nhưng ta lưu lại thông tin để Admin biết.
    // Nếu có plate, ta có thể lưu vào DB. Tuy nhiên Schema User chưa có plate, Card có plate.
    // Tạm thời User signup thành công, chưa có Card.
    
    res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công",
    });
  } catch (err) {
    res.status(500).json({
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

    // Fallback tài khoản admin khi không có MongoDB
    if (!db.isDBConnected()) {
      if (username === "admin" && password === "admin") {
        const token = jwt.sign(
          { id: "mock-admin-id", username: "admin", role: "admin" },
          process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
          { expiresIn: "1d" }
        );
        return res.json({
          success: true,
          token,
          user: { username: "admin", role: "admin" },
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Tên đăng nhập hoặc mật khẩu không đúng (Chế độ In-Memory)",
        });
      }
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
