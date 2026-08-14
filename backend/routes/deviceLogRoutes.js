const express = require("express");
const { getDeviceLogs } = require("../controllers/deviceLogController");

const router = express.Router();
router.get("/", getDeviceLogs);

module.exports = router;
