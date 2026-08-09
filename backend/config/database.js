const mongoose = require("mongoose");
const dns = require("dns");

// Thiết lập DNS server công cộng để sửa lỗi querySrv ECONNREFUSED trên một số nhà mạng/router
try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
    console.warn("⚠️ Không thể tự động thiết lập DNS server công cộng:", err.message);
}

/**
 * Kết nối backend với MongoDB Atlas.
 *
 * @returns {Promise<boolean>}
 * Trả về true khi kết nối thành công.
 * Ném lỗi khi thiếu URI hoặc không kết nối được.
 */
async function connectDatabase() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error("Chưa khai báo MONGO_URI trong file .env");
    }

    // Không giữ các truy vấn trong bộ nhớ khi database chưa kết nối.
    mongoose.set("bufferCommands", false);

    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
    });

    console.log(
        `MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`,
    );

    return true;
}

mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
});

module.exports = connectDatabase;