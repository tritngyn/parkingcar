require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const { initializeMQTT } = require("./service/mqttService");
const connectDatabase = require("./config/database");
const { initSocket, latestData, startAssignmentScan, stopAssignmentScan } = require("./service/socketService");
const apiRoutes = require("./routes");
const { startTelegramBot } = require("./service/telegramBotService");
const { startNotificationMonitor, notifySystemError } = require("./service/notificationMonitorService");

const app = express();
const httpServer = http.createServer(app);

// Khởi tạo Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Lưu trữ instance socket.io vào service dùng chung
initSocket(io);

// ================================
// CƠ SỞ DỮ LIỆU (MONGODB)
// ================================
async function initializeDatabase() {
  try {
    await connectDatabase();
    console.log("Đã kết nối MongoDB Atlas thành công");
  } catch (error) {
    console.error("Lỗi nghiêm trọng: Không thể kết nối MongoDB:", error.message);
    await notifySystemError("mongodb", error.message);
    process.exit(1);
  }
}

// ================================
// EXPRESS CONFIGURATION & CORS
// ================================
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ================================
// API ROUTES
// ================================

// Đăng ký các Router Module hóa
app.use("/api", apiRoutes);

// API Health Check kiểm tra trạng thái hoạt động backend
app.get("/api/health", (req, res) => {
  const { getMQTTClient } = require("./service/mqttService");
  const mongoStates = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    success: true,
    message: "Backend is running",
    database: {
      mode: "mongodb",
      state:
        mongoStates[mongoose.connection.readyState] ??
        `unknown-${mongoose.connection.readyState}`,
      name: mongoose.connection.name || null,
    },
    mqtt: {
      connected: getMQTTClient() ? getMQTTClient().connected : false,
      broker: process.env.MQTT_BROKER,
    },
  });
});

// API lấy dữ liệu trạng thái cổng mới nhất khi vừa load trang web
app.get("/api/status", (req, res) => {
  res.json(latestData);
});

// ================================
// SOCKET.IO EVENTS CONNECTION
// ================================
io.on("connection", (socket) => {
  console.log("Web đã kết nối:", socket.id);

  // Gửi dữ liệu trạng thái mới nhất ngay khi web vừa kết nối
  socket.emit("initial-data", latestData);

  socket.on("assignment-scan:start", (acknowledge) => {
    startAssignmentScan(socket.id);
    console.log(`Đã bật chế độ gán thẻ cho Socket ${socket.id}`);
    socket.emit("assignment-scan:ready", { expiresInMs: 60000 });
    if (typeof acknowledge === "function") {
      acknowledge({ success: true, expiresInMs: 60000 });
    }
  });

  socket.on("assignment-scan:stop", () => stopAssignmentScan(socket.id));

  socket.on("disconnect", () => {
    stopAssignmentScan(socket.id);
    console.log("Web đã ngắt kết nối:", socket.id);
  });
});

// ================================
// KHỞI ĐỘNG SERVER
// ================================
const WEB_PORT = process.env.PORT || 3000;

async function startServer() {
  await initializeDatabase();
  initializeMQTT();
  startTelegramBot();
  startNotificationMonitor();

  httpServer.listen(WEB_PORT, () => {
    console.log(`Backend running at http://localhost:${WEB_PORT}`);
    console.log(`Database: Connected to MongoDB Atlas`);
  });
}

startServer().catch((error) => {
  console.error("Không thể khởi động backend:", error);
  process.exit(1);
});
