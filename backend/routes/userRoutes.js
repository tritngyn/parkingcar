const express = require("express");
const userController = require("../controllers/userController");
const authenticateJWT = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/me", authenticateJWT, userController.getMe);
router.get("/", authenticateJWT, userController.getAllUsers);
router.post("/register", userController.registerUser);
router.patch("/:id/top-up", userController.topUp);

module.exports = router;
