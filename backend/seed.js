require("dotenv").config();
const mongoose = require("mongoose");
const ParkingSession = require("./models/ParkingSession");

const connectDatabase = require("./config/database");

const VALID_UIDS = ["A288F506", "39B21405", "CARD123", "CARD789", "XYZ987", "ABC123"];

// Hàm random số nguyên
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Hàm random phần tử trong mảng
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedData() {
  try {
    console.log("Đang kết nối MongoDB Atlas...");
    await connectDatabase();
    console.log("Kết nối thành công!");

    // Xoá dữ liệu cũ nếu muốn
    console.log("Đang xoá dữ liệu ParkingSession cũ...");
    await ParkingSession.deleteMany({});

    console.log("Đang tạo ~150 phiên đỗ xe giả (Fake Data) cho ngày hôm nay...");
    
    const fakeSessions = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bắt đầu từ 00:00 hôm nay

    for (let i = 0; i < 150; i++) {
      // Random giờ vào từ 6h sáng đến thời điểm hiện tại
      const currentHour = new Date().getHours();
      const maxEntryHour = Math.max(6, currentHour - 1);
      const entryHour = randomInt(6, maxEntryHour);
      const entryMin = randomInt(0, 59);
      
      const entryTime = new Date(today);
      entryTime.setHours(entryHour, entryMin, 0, 0);

      const uid = randomItem(VALID_UIDS);
      
      // 80% xe đã ra (completed), 20% xe vẫn đang đỗ (active)
      const isCompleted = Math.random() < 0.8;

      if (isCompleted) {
        // Thời gian đỗ từ 30 phút đến 5 tiếng
        const parkDurationMs = randomInt(30, 300) * 60 * 1000; 
        const exitTime = new Date(entryTime.getTime() + parkDurationMs);
        
        // Tránh xe ra bị lố sang ngày mai (hoặc tương lai quá xa)
        if (exitTime.getTime() > Date.now()) {
           continue; // Bỏ qua nếu thời gian ra nằm ở tương lai so với hiện tại
        }

        const parkedHours = Math.max(1, Math.ceil(parkDurationMs / (60 * 60 * 1000)));
        const fee = parkedHours * 20; // 20 peso/giờ

        fakeSessions.push({
          uid,
          status: "completed",
          entryTime,
          exitTime,
          fee,
        });
      } else {
        // Nếu entryTime nằm ở tương lai so với hiện tại thì bỏ qua
        if (entryTime.getTime() > Date.now()) {
          continue; 
        }

        // Xe vẫn đang đỗ
        fakeSessions.push({
          uid,
          status: "active",
          entryTime,
          fee: 0,
        });
      }
    }

    // Insert vào DB
    await ParkingSession.insertMany(fakeSessions);
    console.log(`Đã tạo thành công ${fakeSessions.length} bản ghi!`);

    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi seed data:", error.message);
    process.exit(1);
  }
}

seedData();
