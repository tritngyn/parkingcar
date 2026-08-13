require("dotenv").config();
const mongoose = require("mongoose");
const connectDatabase = require("./config/database");
const Admin = require("./models/Admin");

async function seedAdmin() {
  try {
    await connectDatabase();
    let admin = await Admin.findOne({ username: "admin" });
    if (!admin) {
      admin = new Admin({ username: "admin", password: "admin" });
      await admin.save();
      console.log("Đã tạo tài khoản admin mặc định: admin / admin");
    } else {
      // Cập nhật lại pass thành admin cho chắc chắn
      admin.password = "admin"; 
      await admin.save();
      console.log("Đã reset mật khẩu admin về: admin");
    }
    process.exit(0);
  } catch (error) {
    console.error("Lỗi:", error.message);
    process.exit(1);
  }
}

seedAdmin();
