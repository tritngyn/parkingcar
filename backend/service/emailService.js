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
 * Hàm gửi email thông báo khi đăng ký thành công
 * @param {string} email Địa chỉ email nhận
 * @param {string} fullName Tên người dùng
 */
const sendRegistrationNotification = async (email, fullName) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Chưa cấu hình EMAIL_USER và EMAIL_PASS trong .env. Bỏ qua việc gửi email.");
    return;
  }

  const mailOptions = {
    from: `"Hệ Thống Đỗ Xe" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Xác nhận đăng ký tài khoản thành công",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #0284c7; text-align: center;">Chào mừng ${fullName}!</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Hệ Thống Đỗ Xe</strong> của chúng tôi.</p>
        <p>Tài khoản của bạn đã được tạo thành công và sẵn sàng để sử dụng.</p>
        <div style="background-color: #f0fdfa; padding: 15px; border-left: 4px solid #0d9488; margin: 20px 0;">
          <p style="margin: 0;"><strong>Lưu ý:</strong> Bạn có thể sử dụng Email này để đăng nhập vào ứng dụng bất kỳ lúc nào.</p>
        </div>
        <p>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
        <p style="margin-top: 30px;">Trân trọng,<br>Ban quản trị Hệ Thống Đỗ Xe</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email gửi thành công tới ${email}: ${info.messageId}`);
  } catch (error) {
    console.error("Lỗi khi gửi email:", error);
  }
};

module.exports = {
  sendRegistrationNotification,
};
