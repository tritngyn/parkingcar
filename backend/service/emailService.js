const nodemailer = require("nodemailer");

/**
 * Tạo transporter sử dụng SMTP của Gmail
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Hàm gửi email chứa mã OTP xác thực
 * @param {string} email Địa chỉ email nhận
 * @param {string} fullName Tên người dùng
 * @param {string} otpCode Mã OTP 6 số
 */
const sendOTPNotification = async (email, fullName, otpCode) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Chưa cấu hình EMAIL_USER và EMAIL_PASS trong .env. Bỏ qua việc gửi email.");
    return;
  }

  const mailOptions = {
    from: `"Hệ Thống Đỗ Xe" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Xác thực tài khoản - Mã OTP của bạn",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #0284c7; text-align: center;">Mã xác thực tài khoản</h2>
        <p>Chào <strong>${fullName}</strong>, cảm ơn bạn đã đăng ký tài khoản tại Hệ Thống Đỗ Xe.</p>
        <p>Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã OTP sau để xác thực tài khoản:</p>
        <div style="background-color: #f0fdfa; padding: 15px; border-left: 4px solid #0d9488; margin: 20px 0; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #0f766e;">
          ${otpCode}
        </div>
        <p style="color: #ef4444; font-size: 13px;">* Mã OTP này sẽ hết hạn sau 10 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <p style="margin-top: 30px;">Trân trọng,<br>Ban quản trị Hệ Thống Đỗ Xe</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email OTP gửi thành công tới ${email}: ${info.messageId}`);
  } catch (error) {
    console.error("Lỗi khi gửi email OTP:", error);
  }
};

module.exports = {
  sendOTPNotification,
};
