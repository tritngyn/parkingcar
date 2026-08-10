require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Card = require("../models/Card");
const User = require("../models/User");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const sample = {
  admin: { username: "admin", password: "Admin@123" },
  user: {
    fullName: "Nguyen Van A",
    phone: "0900000000",
    email: "nguyenvana@example.com",
    balance: 100000,
  },
  fallbackCard: { uid: "DEMO0001", type: "GUEST" },
};

async function seedSampleData() {
  if (!process.env.MONGO_URI) {
    throw new Error("Chưa khai báo MONGO_URI trong file .env");
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  let admin = await Admin.findOne({ username: sample.admin.username });
  const adminCreated = !admin;
  if (!admin) {
    admin = await Admin.create(sample.admin);
  }

  let user = await User.findOne({ phone: sample.user.phone });
  const userCreated = !user;
  if (!user) {
    user = await User.create(sample.user);
  }

  let card = await Card.findOne({ owner: user._id });
  if (!card) {
    card = await Card.findOne({
      $or: [
        { status: "AVAILABLE", owner: null },
        { status: { $exists: false }, owner: { $in: [null] } },
      ],
    }).sort({ createdAt: 1 });
  }
  if (!card) {
    card = await Card.findOneAndUpdate(
      { uid: sample.fallbackCard.uid },
      {
        $setOnInsert: {
          ...sample.fallbackCard,
          status: "AVAILABLE",
          owner: null,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );
  }
  if (card.owner && String(card.owner) !== String(user._id)) {
    throw new Error(`Thẻ ${card.uid} đã thuộc user khác`);
  }
  card.owner = user._id;
  card.status = "ASSIGNED";
  await card.save();

  console.log(JSON.stringify({
    database: mongoose.connection.name,
    admin: { id: admin._id, username: admin.username, created: adminCreated },
    user: {
      id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      balance: user.balance,
      created: userCreated,
    },
    card: { id: card._id, uid: card.uid, type: card.type, status: card.status },
  }, null, 2));
}

seedSampleData()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
