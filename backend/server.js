require("dotenv").config();
const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { initializeMQTT, sendGateCommand, getMQTTClient } = require("./service/mqttService");
const connectDatabase = require("./config/database");
const Admin = require("./models/Admin");
const Card = require("./models/Card");
const ParkingSession = require("./models/ParkingSession");

const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// ================================
// CƠ SỞ DỮ LIỆU (MONGODB)
// ================================
// mongoose.set("bufferCommands", false); // Không treo truy vấn khi chưa có kết nối DB

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
      "Backend chuyển sang chế độ In-Memory. Dữ liệu sẽ mất khi tắt server.",
    );
  }
}


// CƠ CHẾ BACKUP IN-MEMORY KHI CHƯA CÓ DATABASE
const inMemoryStore = {
  cards: [
    { uid: "GUEST123", type: "GUEST", createdAt: new Date() },
    { uid: "VIP789", type: "VIP", createdAt: new Date() }
  ],
  sessions: []
};

const db = {
  cards: {
    findOne: async (query) => {
      if (isDBConnected) {
        try { return await Card.findOne(query); } catch (e) { /* fallback */ }
      }
      return inMemoryStore.cards.find(c => c.uid === query.uid) || null;
    },
    save: async (cardData) => {
      if (isDBConnected) {
        try {
          const card = new Card(cardData);
          return await card.save();
        } catch (e) { /* fallback */ }
      }
      const newCard = { ...cardData, createdAt: new Date() };
      inMemoryStore.cards.push(newCard);
      return newCard;
    },
    find: async () => {
      if (isDBConnected) {
        try { return await Card.find().sort({ createdAt: -1 }); } catch (e) { /* fallback */ }
      }
      return [...inMemoryStore.cards].sort((a, b) => b.createdAt - a.createdAt);
    },
    deleteOne: async (uid) => {
      if (isDBConnected) {
        try { return await Card.findOneAndDelete({ uid }); } catch (e) { /* fallback */ }
      }
      const index = inMemoryStore.cards.findIndex(c => c.uid === uid);
      if (index === -1) return null;
      return inMemoryStore.cards.splice(index, 1)[0];
    }
  },
  sessions: {
    findActive: async (uid) => {
      if (isDBConnected) {
        try {
          return await ParkingSession.findOne({
            uid: uid.toUpperCase(),
            status: "active"
          }).sort({ entryTime: -1 });
        } catch (e) { /* fallback */ }
      }
      return inMemoryStore.sessions.find(s => s.uid.toUpperCase() === uid.toUpperCase() && s.status === "active") || null;
    },
    save: async (sessionData) => {
      if (isDBConnected) {
        try {
          if (sessionData.save && typeof sessionData.save === "function") {
            return await sessionData.save();
          }
          const session = new ParkingSession(sessionData);
          return await session.save();
        } catch (e) { /* fallback */ }
      }
      const id = sessionData._id;
      if (id) {
        const existingIndex = inMemoryStore.sessions.findIndex(s => s._id === id || String(s._id) === String(id));
        if (existingIndex !== -1) {
          inMemoryStore.sessions[existingIndex] = {
            ...inMemoryStore.sessions[existingIndex],
            ...sessionData,
            updatedAt: new Date()
          };
          return inMemoryStore.sessions[existingIndex];
        }
      }
      const newSession = {
        _id: sessionData._id || `sess-${Date.now()}`,
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.sessions.push(newSession);
      return newSession;
    },
    findActiveAll: async () => {
      if (isDBConnected) {
        try {
          return await ParkingSession.find({
            status: "active"
          }).sort({ entryTime: -1 });
        } catch (e) { /* fallback */ }
      }
      return inMemoryStore.sessions
        .filter(s => s.status === "active")
        .sort((a, b) => b.entryTime - a.entryTime);
    },
    findAll: async () => {
      if (isDBConnected) {
        try {
          return await ParkingSession.find().sort({ entryTime: -1 });
        } catch (e) { /* fallback */ }
      }
      return [...inMemoryStore.sessions].sort((a, b) => b.entryTime - a.entryTime);
    },
    findById: async (id) => {
      if (isDBConnected) {
        try { return await ParkingSession.findById(id); } catch (e) { /* fallback */ }
      }
      return inMemoryStore.sessions.find(s => s._id === id || String(s._id) === String(id)) || null;
    }
  }
};

// ================================
// CẤU HÌNH
// ================================

const WEB_PORT = process.env.PORT || 3000;

// Nếu Mosquitto chạy trên cùng máy với backend:
const MQTT_BROKER_URL = process.env.MQTT_BROKER || "mqtt://localhost:1883";

// Topic ESP32 đang publish
const RFID_TOPIC = process.env.RFID_TOPIC || "parking/group17/rfid/scan";
const GATE_STATUS_TOPIC = process.env.GATE_STATUS_TOPIC || "parking/group17/gate/status";
const GATE_COMMAND_TOPIC = process.env.GATE_COMMAND_TOPIC || "parking/group17/gate/command";

// ================================
// EXPRESS
// ================================
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Dùng để kiểm tra backend
app.get("/api/health", (req, res) => {
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
      broker: MQTT_BROKER_URL,
    },
  });
});

// ================================
// API ĐĂNG KÝ / ĐĂNG NHẬP ADMIN
// ================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Thiếu username hoặc password" });
    }
    let admin = await Admin.findOne({ username });
    if (admin) {
      return res.status(400).json({ success: false, message: "Tên đăng nhập admin đã tồn tại" });
    }
    admin = new Admin({ username, password });
    await admin.save();
    res.status(201).json({ success: true, message: "Đăng ký admin thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Thiếu username hoặc password" });
    }

    // Fallback tài khoản admin khi không có MongoDB
    if (!isDBConnected) {
      if (username === "admin" && password === "admin") {
        const token = jwt.sign(
          { id: "mock-admin-id", username: "admin" },
          process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
          { expiresIn: "1d" }
        );
        return res.json({ success: true, token, user: { username: "admin" } });
      } else {
        return res.status(401).json({ success: false, message: "Tên đăng nhập hoặc mật khẩu không đúng (Chế độ In-Memory)" });
      }
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ success: false, message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
      { expiresIn: "1d" }
    );
    res.json({ success: true, token, user: { username: admin.username } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Middleware xác thực JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET || "supersecretjwtkey_change_in_production", (err, user) => {
      if (err) {
        return res.status(403).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ success: false, message: "Không tìm thấy token xác thực" });
  }
};

// ================================
// API QUẢN LÝ THẺ (CARDS)
// ================================

app.get("/api/cards", async (req, res) => {
  try {
    const cards = await db.cards.find();
    res.json(cards);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/cards", async (req, res) => {
  try {
    const { uid, type } = req.body;
    if (!uid) {
      return res.status(400).json({ success: false, message: "Thiếu UID của thẻ" });
    }
    const existingCard = await db.cards.findOne({ uid });
    if (existingCard) {
      return res.status(400).json({ success: false, message: "Thẻ UID này đã được đăng ký trước đó" });
    }
    const card = await db.cards.save({ uid, type });
    res.status(201).json({ success: true, data: card });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/cards/:uid", async (req, res) => {
  try {
    const result = await db.cards.deleteOne(req.params.uid);
    if (!result) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thẻ cần xóa" });
    }
    res.json({ success: true, message: "Xóa thẻ thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================================
// API QUẢN LÝ LƯỢT ĐỖ XE (SESSIONS)
// ================================

app.get("/api/sessions", async (req, res) => {
  try {
    const sessions = await db.sessions.findAll();
    const mapped = sessions.map(s => {
      const isPendingPayment = s.status === "active" && s.fee > 0;
      let status = "IN";
      if (s.status === "completed") {
        status = "OUT";
      } else if (isPendingPayment) {
        status = "PENDING_PAYMENT";
      }
      return {
        _id: s._id,
        uid: s.uid,
        time_in: s.entryTime || s.createdAt,
        time_out: s.exitTime || null,
        status: status,
        fee: s.fee || 0
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/sessions/active", async (req, res) => {
  try {
    const sessions = await db.sessions.findActiveAll();
    const mapped = sessions.map(s => {
      const isPendingPayment = s.fee > 0;
      return {
        _id: s._id,
        uid: s.uid,
        time_in: s.entryTime || s.createdAt,
        status: isPendingPayment ? "PENDING_PAYMENT" : "IN",
        fee: s.fee || 0
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/sessions/pay", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Thiếu mã lượt đỗ xe (sessionId)" });
    }
    const session = await db.sessions.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lượt đỗ xe" });
    }
    if (session.status !== "active" || session.fee === 0) {
      return res.status(400).json({ success: false, message: `Lượt đỗ xe đang ở trạng thái ${session.status}, không cần thanh toán` });
    }

    session.status = "completed";
    session.exitTime = new Date();
    await db.sessions.save(session);

    // Gửi lệnh mở cổng RA qua MQTT
    const commandSent = sendGateCommand({
      lane: "out",
      action: "open",
      uid: session.uid,
      requestId: `pay-${Date.now()}`,
      source: "backend"
    });

    if (!commandSent) {
      console.error(`Không thể gửi lệnh mở cổng ra cho UID ${session.uid}`);
    } else {
      console.log(`Đã gửi lệnh mở cổng RA cho UID ${session.uid}`);
    }

    const receivedAt = new Date().toISOString();
    latestData.gates.out = {
      status: "OPEN",
      source: "api-pay",
      uid: session.uid,
      fee: session.fee,
      receivedAt: receivedAt
    };

    io.emit("gate-status", {
      topic: "parking/group17/gate/status",
      data: { lane: "out", status: "open", source: "api-pay", uid: session.uid, fee: session.fee },
      receivedAt: receivedAt
    });

    res.json({ success: true, message: "Thanh toán thành công, cổng exit đã mở" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================================
// API ĐIỀU KHIỂN CỔNG THỦ CÔNG
// ================================

app.post("/api/gate/command", async (req, res) => {
  try {
    const { lane, action } = req.body; // lane: "in"/"out", action: "open"/"close"
    if (!lane || !action) {
      return res.status(400).json({ success: false, message: "Thiếu lane hoặc action" });
    }

    const commandSent = sendGateCommand({
      lane: lane,
      action: action,
      uid: "MANUAL",
      requestId: `manual-${Date.now()}`,
      source: "backend"
    });

    if (!commandSent) {
      console.error(
        `Không thể gửi lệnh điều khiển cổng thủ công (${lane} -> ${action})`
      );
    } else {
      console.log(
        `Đã gửi lệnh điều khiển cổng thủ công (${lane} -> ${action})`
      );
    }

    const receivedAt = new Date().toISOString();
    latestData.gates[lane] = {
      status: action.toUpperCase(),
      source: "manual-api",
      uid: "MANUAL",
      receivedAt: receivedAt
    };

    io.emit("gate-status", {
      topic: "parking/group17/gate/status",
      data: { lane: lane, status: action, source: "manual-api" },
      receivedAt: receivedAt
    });

    res.json({ success: true, message: `Đã gửi lệnh ${action} cho cổng ${lane}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================================
// LƯU TRẠNG THÁI MỚI NHẤT
// ================================

const latestData = {
  rfid: null,
  gates: {
    in: {
      status: "unknown",
      source: null,
      uid: null
    },
    out: {
      status: "unknown",
      source: null,
      uid: null
    }
  }
};

// API lấy dữ liệu mới nhất khi vừa mở web
app.get("/api/status", (req, res) => {
  res.json(latestData);
});

// ================================
// SOCKET.IO
// ================================

io.on("connection", (socket) => {
  console.log("Web đã kết nối:", socket.id);

  // Gửi dữ liệu mới nhất ngay khi web vừa kết nối
  socket.emit("initial-data", latestData);

  socket.on("disconnect", () => {
    console.log("Web đã ngắt kết nối:", socket.id);
  });
});

// ================================
// KHỞI ĐỘNG SERVER
// ================================

async function startServer() {
  await initializeDatabase();
  initializeMQTT(io, latestData);

  httpServer.listen(WEB_PORT, () => {
    console.log(`Backend running at http://localhost:${WEB_PORT}`);

    if (isDBConnected) {
      console.log("Database mode: MongoDB Atlas");
    } else {
      console.log("Database mode: In-Memory");
    }
  });
}

startServer().catch((error) => {
  console.error("Không thể khởi động backend:", error);
  process.exit(1);
});