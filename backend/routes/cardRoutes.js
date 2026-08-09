const express = require("express");
const router = express.Router();
const cardController = require("../controllers/cardController");
const authenticateJWT = require("../middlewares/authMiddleware");

// Có thể thêm authenticateJWT vào các route nếu cần bảo mật, ví dụ: router.get("/", authenticateJWT, cardController.getAllCards);
// Ở dự án gốc, các route này chưa yêu cầu authenticateJWT, nhưng chúng ta cấu trúc sẵn middleware nếu cần sử dụng.
router.get("/", cardController.getAllCards);
router.post("/", cardController.createCard);
router.delete("/:uid", cardController.deleteCard);

module.exports = router;
