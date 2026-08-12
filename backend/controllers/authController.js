const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const db = require("../config/dbStore");

exports.signup = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Thiếu username hoặc password",
      });
    }

    if (!db.isDBConnected()) {
      return res.status(400).json({
        success: false,
        message: "Không thể đăng ký admin ở chế độ In-Memory",
      });
    }

    let admin = await Admin.findOne({ username });
    if (admin) {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập admin đã tồn tại",
      });
    }
    admin = new Admin({ username, password });
    await admin.save();
    res.status(201).json({
      success: true,
      message: "Đăng ký admin thành công",
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
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Thiếu username hoặc password",
      });
    }

    // Fallback tài khoản admin khi không có MongoDB
    if (!db.isDBConnected()) {
      if (username === "admin" && password === "admin") {
        const token = jwt.sign(
          { id: "mock-admin-id", username: "admin" },
          process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
          { expiresIn: "1d" }
        );
        return res.json({
          success: true,
          token,
          user: { username: "admin" },
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Tên đăng nhập hoặc mật khẩu không đúng (Chế độ In-Memory)",
        });
      }
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Tên đăng nhập hoặc mật khẩu không đúng",
      });
    }
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Tên đăng nhập hoặc mật khẩu không đúng",
      });
    }
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
      { expiresIn: "1d" }
    );
    res.json({
      success: true,
      token,
      user: { username: admin.username },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
