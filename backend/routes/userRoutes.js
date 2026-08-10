const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

router.get("/", userController.getAllUsers);
router.post("/register", userController.registerUser);
router.patch("/:id/top-up", userController.topUp);

module.exports = router;
