require("dotenv").config();
const mongoose = require("mongoose");
const connectDatabase = require("./config/database");
const User = require("./models/User");
const Card = require("./models/Card");

async function seedData() {
  try {
    await connectDatabase();
    
    // Tạo User mẫu
    const phone = "0901234567";
    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({
        fullName: "Nguyen Van An",
        phone: phone,
        password: "123", // hash tự động do pre('save')
        balance: 50000
      });
      await user.save();
      console.log(`Đã tạo User: ${user.fullName}`);
    } else {
      console.log(`User ${user.fullName} đã tồn tại`);
    }

    // Cập nhật thẻ
    const targetUid = "A288F506"; // Thẻ thực tế của hệ thống
    let card = await Card.findOne({ uid: targetUid });
    if (!card) {
      card = new Card({
        uid: targetUid,
        type: "GUEST",
        status: "ASSIGNED",
        owner: user._id,
        plate: "51G-123.45"
      });
      await card.save();
      console.log(`Đã tạo thẻ mới: ${targetUid}`);
    } else {
      card.owner = user._id;
      card.status = "ASSIGNED";
      card.plate = "51G-123.45";
      await card.save();
      console.log(`Đã cập nhật thẻ: ${targetUid} cho user ${user.fullName}`);
    }

    console.log("Seeding thành công!");
    process.exit(0);
  } catch (error) {
    console.error("Lỗi:", error.message);
    process.exit(1);
  }
}

seedData();
