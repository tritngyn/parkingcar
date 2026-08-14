const express = require("express");
const userController = require("../controllers/userController");
const authenticateJWT = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/me", authenticateJWT, userController.getMe);
router.post("/me/telegram/link", authenticateJWT, userController.createTelegramLink);
router.delete("/me/telegram/link", authenticateJWT, userController.unlinkTelegram);
router.patch("/me/telegram/preferences", authenticateJWT, userController.updateTelegramPreferences);
router.patch("/me/top-up", authenticateJWT, userController.topUpMe);
router.patch("/me/card", authenticateJWT, userController.assignCardMe);
router.get("/", authenticateJWT, userController.getAllUsers);
router.delete("/:id", authenticateJWT, userController.deleteUser);
router.post("/register", userController.registerUser);
router.patch("/:id/top-up", userController.topUp);

module.exports = router;
