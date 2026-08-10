require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const { initializeMQTT } = require("./service/mqttService");
const connectDatabase = require("./config/database");
const { initSocket, latestData } = require("./service/socketService");
const apiRoutes = require("./routes");

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
let isDBConnected = false;
async function initializeDatabase() {
  try {
    await connectDatabase();
    isDBConnected = true;
    console.log("Đã kết nối MongoDB Atlas thành công");
  } catch (error) {
    isDBConnected = false;
    console.error("Không thể kết nối MongoDB:", error.message);
    console.warn(
      "Backend chuyển sang chế độ In-Memory. Dữ liệu sẽ mất khi tắt server."
    );
  }
}

// ================================
// EXPRESS CONFIGURATION & CORS
// ================================
app.use(
  cors({
    origin: "http://localhost:5173",
  })
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
      mode: isDBConnected ? "mongodb" : "in-memory",
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

  socket.on("disconnect", () => {
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

  httpServer.listen(WEB_PORT, () => {
    console.log(`Backend running at http://localhost:${WEB_PORT}`);
    console.log(`Database mode: ${isDBConnected ? "MongoDB Atlas" : "In-Memory"}`);
  });
}

startServer().catch((error) => {
  console.error("Không thể khởi động backend:", error);
  process.exit(1);
});
