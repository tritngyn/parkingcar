const express = require("express");
const router = express.Router();
const gateController = require("../controllers/gateController");

router.post("/command", gateController.controlGate);

module.exports = router;
