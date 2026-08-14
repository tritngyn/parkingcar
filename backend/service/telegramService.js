const https = require("https");

// ==========================================================
// TELEGRAM SERVICE
//
// USER:
// - LOW_BALANCE
// - PARKING_TOO_LONG
// - PAYMENT_SUCCESS
//
// ADMIN:
// - RFID_SPAM
// - PARKING_TOO_LONG
// - SYSTEM_ERROR
//
// .env:
// TELEGRAM_BOT_TOKEN=...
// TELEGRAM_ADMIN_CHAT_ID=...
// ==========================================================


// ==========================================================
// 1. HÀM HỖ TRỢ
// ==========================================================

/**
 * Escape ký tự đặc biệt khi sử dụng parse_mode = HTML
 */
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/**
 * Format thời gian theo giờ Việt Nam
 */
function formatTime(time = new Date()) {
  try {
    return new Date(time).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
    });
  } catch (error) {
    return String(time);
  }
}


/**
 * Format tiền Việt Nam
 */
function formatMoney(value = 0) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "0 đ";
  }

  return number.toLocaleString("vi-VN") + " đ";
}


/**
 * Format khoảng thời gian từ milliseconds
 *
 * Ví dụ:
 * 7200000 -> 2 giờ
 * 9000000 -> 2 giờ 30 phút
 */
function formatDuration(milliseconds = 0) {
  const ms = Math.max(0, Number(milliseconds) || 0);

  const totalMinutes = Math.floor(ms / 60000);

  const days = Math.floor(totalMinutes / (60 * 24));

  const hours = Math.floor(
    (totalMinutes % (60 * 24)) / 60
  );

  const minutes = totalMinutes % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days} ngày`);
  }

  if (hours > 0) {
    parts.push(`${hours} giờ`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} phút`);
  }

  return parts.join(" ");
}


// ==========================================================
// 2. HÀM GỬI TELEGRAM CHUNG
// ==========================================================

/**
 * Gửi một tin nhắn Telegram tới chatId bất kỳ.
 *
 * @param {string|number} chatId
 * @param {string} message
 *
 * @returns {Promise<Object>}
 */
function sendTelegramMessage(chatId, message) {
  return new Promise((resolve, reject) => {

    if (process.env.TELEGRAM_DRY_RUN === "true") {
      resolve({ ok: true, dryRun: true, chatId: String(chatId || "dry-run"), message });
      return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      const error = new Error(
        "Thiếu TELEGRAM_BOT_TOKEN trong file .env"
      );

      console.error("❌ Telegram:", error.message);

      reject(error);
      return;
    }


    if (!chatId) {
      const error = new Error(
        "Không có Telegram Chat ID"
      );

      console.error("❌ Telegram:", error.message);

      reject(error);
      return;
    }


    if (!message) {
      const error = new Error(
        "Nội dung tin nhắn Telegram đang trống"
      );

      console.error("❌ Telegram:", error.message);

      reject(error);
      return;
    }


    const data = JSON.stringify({
      chat_id: String(chatId),
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });


    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },

      timeout: 10000,
    };


    const req = https.request(options, (res) => {

      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });


      res.on("end", () => {

        try {

          const response = JSON.parse(body);


          if (response.ok) {

            console.log(
              `✅ Telegram: gửi thành công -> chatId ${chatId}`
            );

            resolve(response);

          } else {

            const error = new Error(
              response.description ||
              "Telegram Bot API trả về lỗi"
            );

            console.error(
              "❌ Telegram Bot API:",
              error.message
            );

            reject(error);
          }

        } catch (error) {

          console.error(
            "❌ Lỗi parse phản hồi Telegram:",
            error.message
          );

          reject(error);
        }

      });

    });


    req.on("timeout", () => {

      req.destroy();

      reject(
        new Error("Telegram request timeout")
      );

    });


    req.on("error", (error) => {

      console.error(
        "❌ Lỗi kết nối Telegram:",
        error.message
      );

      reject(error);

    });


    req.write(data);

    req.end();

  });
}


// ==========================================================
// 3. THÔNG BÁO DÀNH CHO USER
// ==========================================================

/**
 * Gửi cảnh báo cho USER
 *
 * type:
 *
 * LOW_BALANCE
 * PARKING_TOO_LONG
 * PAYMENT_SUCCESS
 *
 *
 * Ví dụ:
 *
 * sendUserNotification({
 *   chatId: user.telegramChatId,
 *   type: "LOW_BALANCE",
 *   data: {
 *      uid: "A288F506",
 *      balance: 10000,
 *      fee: 25000
 *   }
 * })
 *
 */
async function sendUserNotification({
  chatId,
  type,
  data = {},
}) {

  if (!chatId) {
    console.warn(
      "⚠️ User chưa có telegramChatId"
    );

    return false;
  }


  let message = "";


  // --------------------------------------------------------
  // USER - KHÔNG ĐỦ SỐ DƯ
  // --------------------------------------------------------

  if (type === "LOW_BALANCE") {

    const fee = Number(data.fee) || 0;
    const balance = Number(data.balance) || 0;

    const missingAmount =
      Math.max(0, fee - balance);


    message =
      `⚠️ <b>KHÔNG ĐỦ SỐ DƯ</b>\n\n` +

      `Tài khoản của bạn hiện không đủ tiền để thanh toán phí đỗ xe.\n\n` +

      `• <b>Mã thẻ:</b> ` +
      `<code>${escapeHtml(data.uid || "Không xác định")}</code>\n` +

      (data.licensePlate
        ? `• <b>Biển số:</b> ${escapeHtml(data.licensePlate)}\n`
        : "") +

      `• <b>Phí đỗ xe:</b> ${formatMoney(fee)}\n` +

      `• <b>Số dư:</b> ${formatMoney(balance)}\n` +

      `• <b>Số tiền còn thiếu:</b> ` +
      `<b>${formatMoney(missingAmount)}</b>\n\n` +

      `Vui lòng nạp thêm tiền trước khi thanh toán.`;
  }


  // --------------------------------------------------------
  // USER - XE ĐỖ QUÁ LÂU
  // --------------------------------------------------------

  else if (type === "PARKING_TOO_LONG") {

    message =
      `⏰ <b>CẢNH BÁO THỜI GIAN ĐỖ XE</b>\n\n` +

      `Xe của bạn đã ở trong bãi đỗ xe ` +
      `quá thời gian được hệ thống cảnh báo.\n\n` +

      `• <b>Mã thẻ:</b> ` +
      `<code>${escapeHtml(data.uid || "Không xác định")}</code>\n` +

      (data.licensePlate
        ? `• <b>Biển số:</b> ${escapeHtml(data.licensePlate)}\n`
        : "") +

      `• <b>Thời gian vào:</b> ` +
      `${formatTime(data.entryTime)}\n` +

      `• <b>Thời gian đã đỗ:</b> ` +
      `<b>${data.durationText ||
      formatDuration(data.durationMs)
      }</b>\n\n` +

      `Nếu bạn đã rời bãi nhưng vẫn nhận được thông báo này, ` +
      `vui lòng liên hệ quản trị viên.`;
  }


  // --------------------------------------------------------
  // USER - THANH TOÁN THÀNH CÔNG
  // --------------------------------------------------------

  else if (type === "PAYMENT_SUCCESS") {

    message =
      `✅ <b>THANH TOÁN THÀNH CÔNG</b>\n\n` +

      `• <b>Mã thẻ:</b> ` +
      `<code>${escapeHtml(data.uid || "Không xác định")}</code>\n` +

      (data.licensePlate
        ? `• <b>Biển số:</b> ${escapeHtml(data.licensePlate)}\n`
        : "") +

      `• <b>Phí đỗ xe:</b> ` +
      `<b>${formatMoney(data.fee)}</b>\n` +

      `• <b>Số dư còn lại:</b> ` +
      `${formatMoney(data.balance)}\n` +

      (data.durationText || data.durationMs
        ? `• <b>Thời gian đỗ:</b> ${data.durationText ||
        formatDuration(data.durationMs)
        }\n`
        : "") +

      `• <b>Thời gian:</b> ` +
      `${formatTime(data.time || new Date())}`;
  }


  else {

    console.warn(
      `⚠️ Loại thông báo USER không tồn tại: ${type}`
    );

    return false;
  }


  try {

    await sendTelegramMessage(
      chatId,
      message
    );

    return true;

  } catch (error) {

    console.error(
      `❌ Không thể gửi thông báo USER (${type}):`,
      error.message
    );

    return false;
  }
}


// ==========================================================
// 4. THÔNG BÁO DÀNH CHO ADMIN
// ==========================================================

/**
 * Gửi cảnh báo cho ADMIN
 *
 * type:
 *
 * RFID_SPAM
 * PARKING_TOO_LONG
 * SYSTEM_ERROR
 * DEVICE_RESTARTED
 * DEVICE_OFFLINE
 * DEVICE_ONLINE
 */
async function sendAdminNotification({
  type,
  data = {},
}) {

  const chatId =
    process.env.TELEGRAM_ADMIN_CHAT_ID;


  if (!chatId) {

    console.warn(
      "⚠️ Thiếu TELEGRAM_ADMIN_CHAT_ID trong file .env"
    );

    return false;
  }


  let message = "";


  // --------------------------------------------------------
  // ADMIN - RFID SPAM
  // --------------------------------------------------------

  if (type === "RFID_SPAM") {

    message =
      `🚨 <b>CẢNH BÁO SPAM THẺ RFID</b>\n\n` +

      `Hệ thống phát hiện một thẻ RFID được quét ` +
      `liên tục trong khoảng thời gian ngắn.\n\n` +

      `• <b>UID:</b> ` +
      `<code>${escapeHtml(data.uid || "Không xác định")}</code>\n` +

      `• <b>Số lần quét:</b> ` +
      `<b>${data.count || 0}</b>\n` +

      `• <b>Khoảng thời gian:</b> ` +
      `${data.seconds || 0} giây\n` +

      `• <b>Làn:</b> ` +
      `${escapeHtml(data.lane || "Không xác định")}\n` +

      `• <b>Thiết bị:</b> ` +
      `${escapeHtml(data.deviceId || "Không xác định")}\n` +

      `• <b>Thời gian:</b> ` +
      `${formatTime(data.time || new Date())}\n\n` +

      `Admin vui lòng kiểm tra khu vực cổng.`;
  }


  // --------------------------------------------------------
  // ADMIN - XE ĐỖ QUÁ LÂU
  // --------------------------------------------------------

  else if (type === "PARKING_TOO_LONG") {

    message =
      `🚗 <b>CẢNH BÁO XE ĐỖ QUÁ LÂU</b>\n\n` +

      `Hệ thống phát hiện một phương tiện ` +
      `đã ở trong bãi quá thời gian cảnh báo.\n\n` +

      `• <b>UID:</b> ` +
      `<code>${escapeHtml(data.uid || "Không xác định")}</code>\n` +

      (data.licensePlate
        ? `• <b>Biển số:</b> ${escapeHtml(data.licensePlate)}\n`
        : "") +

      (data.userName
        ? `• <b>Chủ xe:</b> ${escapeHtml(data.userName)}\n`
        : "") +

      `• <b>Thời gian vào:</b> ` +
      `${formatTime(data.entryTime)}\n` +

      `• <b>Thời gian đã đỗ:</b> ` +
      `<b>${data.durationText ||
      formatDuration(data.durationMs)
      }</b>\n` +

      `• <b>Thời gian cảnh báo:</b> ` +
      `${formatTime(data.time || new Date())}`;
  }


  // --------------------------------------------------------
  // ADMIN - LỖI HỆ THỐNG
  // --------------------------------------------------------

  else if (type === "SYSTEM_ERROR") {

    message =
      `⚠️ <b>CẢNH BÁO LỖI HỆ THỐNG</b>\n\n` +

      `• <b>Nguồn lỗi:</b> ` +
      `${escapeHtml(data.source || "Không xác định")}\n` +

      `• <b>Nội dung:</b> ` +
      `${escapeHtml(data.message || "Không có mô tả")}\n` +

      `• <b>Thời gian:</b> ` +
      `${formatTime(data.time || new Date())}`;
  }

  else if (type === "DEVICE_RESTARTED") {
    message = `🔄 <b>ESP32 ĐÃ KHỞI ĐỘNG</b>\n\n` +
      `• <b>Thiết bị:</b> ${escapeHtml(data.deviceId || "Không xác định")}\n` +
      `• <b>Nguyên nhân reset:</b> ${escapeHtml(data.resetReason || "Không xác định")}\n` +
      `• <b>IP:</b> ${escapeHtml(data.ip || "Không xác định")}\n` +
      `• <b>Thời gian:</b> ${formatTime(data.time || new Date())}`;
  }

  else if (type === "DEVICE_OFFLINE") {
    message = `📴 <b>ESP32 OFFLINE</b>\n\n` +
      `• <b>Thiết bị:</b> ${escapeHtml(data.deviceId || "Không xác định")}\n` +
      `• <b>Lý do:</b> ${escapeHtml(data.reason || "Mất kết nối")}\n` +
      `• <b>Thời gian:</b> ${formatTime(data.time || new Date())}\n\n` +
      `Vui lòng kiểm tra nguồn điện và kết nối WiFi của ESP32.`;
  }


  else if (type === "DEVICE_ONLINE") {
    message = `🟢 <b>ESP32 ONLINE</b>\n\n` +
      `• <b>Thiết bị:</b> ${escapeHtml(data.deviceId || "Không xác định")}\n` +
      (data.ip ? `• <b>IP:</b> ${escapeHtml(data.ip)}\n` : "") +
      `• <b>Thời gian:</b> ${formatTime(data.time || new Date())}\n\n` +
      `Thiết bị đã kết nối lại và hoạt động bình thường.`;
  }

  else {

    console.warn(
      `⚠️ Loại thông báo ADMIN không tồn tại: ${type}`
    );

    return false;
  }


  try {

    await sendTelegramMessage(
      chatId,
      message
    );

    return true;

  } catch (error) {

    console.error(
      `❌ Không thể gửi thông báo ADMIN (${type}):`,
      error.message
    );

    return false;
  }
}


// ==========================================================
// 5. XE ĐỖ QUÁ LÂU
// GỬI ĐỒNG THỜI CHO USER + ADMIN
// ==========================================================

/**
 * Khi phát hiện xe đỗ quá lâu:
 *
 * - gửi USER nếu user có telegramChatId
 * - gửi ADMIN
 */
async function notifyParkingTooLong({
  userChatId,
  uid,
  licensePlate,
  userName,
  entryTime,
  durationMs,
  durationText,
}) {

  const data = {
    uid,
    licensePlate,
    userName,
    entryTime,
    durationMs,
    durationText,
    time: new Date(),
  };


  const tasks = [];


  // User có Chat ID thì mới gửi
  if (userChatId) {

    tasks.push(
      sendUserNotification({
        chatId: userChatId,
        type: "PARKING_TOO_LONG",
        data,
      })
    );

  }


  // Luôn gửi cho admin
  tasks.push(
    sendAdminNotification({
      type: "PARKING_TOO_LONG",
      data,
    })
  );


  const results =
    await Promise.allSettled(tasks);


  return results;
}


// ==========================================================
// 6. HÀM CŨ - GIỮ LẠI ĐỂ BACKEND HIỆN TẠI KHÔNG BỊ LỖI
// ==========================================================

/**
 * Hàm tương thích với telegramService.js cũ.
 *
 * Code backend cũ nếu đang gọi:
 *
 * sendNotification({
 *    uid,
 *    event,
 *    fee,
 *    time
 * });
 *
 * vẫn chạy được.
 *
 * Hàm này gửi cho ADMIN.
 */
async function sendNotification({
  uid,
  event,
  fee = 0,
  time = new Date(),
}) {

  const chatId =
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID;


  if (!chatId) {

    console.warn(
      "⚠️ Không có TELEGRAM_ADMIN_CHAT_ID hoặc TELEGRAM_CHAT_ID"
    );

    return false;
  }


  const formattedTime =
    formatTime(time);


  let message = "";


  if (event === "entry") {

    message =
      `🚗 <b>[BÃI XE THÔNG MINH - NHÓM 17]</b>\n` +
      `<b>XE VÀO BÃI</b>\n\n` +

      `• <b>Mã thẻ:</b> ` +
      `<code>${escapeHtml(uid)}</code>\n` +

      `• <b>Thời gian vào:</b> ` +
      `${formattedTime}\n` +

      `• <b>Trạng thái:</b> Cổng vào đã mở`;

  }


  else if (event === "exit") {

    const feeText = formatMoney(fee);
    const statusText = "Cổng ra đã mở";


    message =
      `🚙 <b>[BÃI XE THÔNG MINH - NHÓM 17]</b>\n` +
      `<b>XE YÊU CẦU RA</b>\n\n` +

      `• <b>Mã thẻ:</b> ` +
      `<code>${escapeHtml(uid)}</code>\n` +

      `• <b>Phí đỗ xe:</b> ` +
      `<b>${feeText}</b>\n` +

      `• <b>Thời gian:</b> ` +
      `${formattedTime}\n` +

      `• <b>Trạng thái:</b> ${statusText}`;

  }


  else {

    console.warn(
      `⚠️ Event Telegram không hợp lệ: ${event}`
    );

    return false;
  }


  try {

    await sendTelegramMessage(
      chatId,
      message
    );

    return true;

  } catch (error) {

    console.error(
      "❌ Lỗi sendNotification:",
      error.message
    );

    return false;
  }
}


// ==========================================================
// 7. EXPORT
// ==========================================================

module.exports = {

  // Hàm gửi thấp nhất
  sendTelegramMessage,

  // User
  sendUserNotification,

  // Admin
  sendAdminNotification,

  // Gửi cả user + admin
  notifyParkingTooLong,

  // Hàm cũ để tương thích backend hiện tại
  sendNotification,

  // Helper nếu cần dùng bên ngoài
  formatTime,
  formatMoney,
  formatDuration,
};
