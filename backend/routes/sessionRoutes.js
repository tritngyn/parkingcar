const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");

router.get("/", sessionController.getAllSessions);
router.get("/active", sessionController.getActiveSessions);
router.get("/stats", sessionController.getSessionStats); // API lấy dữ liệu biểu đồ Recharts (ID 8)
router.post("/pay", sessionController.paySession);

module.exports = router;
