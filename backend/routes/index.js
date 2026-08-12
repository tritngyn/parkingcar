const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const cardRoutes = require("./cardRoutes");
const sessionRoutes = require("./sessionRoutes");
const gateRoutes = require("./gateRoutes");
const userRoutes = require("./userRoutes");

router.use("/auth", authRoutes);
router.use("/cards", cardRoutes);
router.use("/sessions", sessionRoutes);
router.use("/gate", gateRoutes);
router.use("/users", userRoutes);

module.exports = router;
