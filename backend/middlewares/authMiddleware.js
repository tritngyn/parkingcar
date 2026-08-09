const jwt = require("jsonwebtoken");

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretjwtkey_change_in_production",
      (err, user) => {
        if (err) {
          return res.status(403).json({
            success: false,
            message: "Token không hợp lệ hoặc đã hết hạn",
          });
        }
        req.user = user;
        next();
      }
    );
  } else {
    res.status(401).json({
      success: false,
      message: "Không tìm thấy token xác thực",
    });
  }
};

module.exports = authenticateJWT;
