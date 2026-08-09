const https = require("https");

/**
 * Gửi thông báo đến điện thoại qua Telegram Bot API (ID 4)
 * @param {Object} param0
 * @param {string} param0.uid - Mã thẻ RFID
 * @param {string} param0.event - 'entry' hoặc 'exit'
 * @param {string} param0.cardType - 'VIP' hoặc 'GUEST'
 * @param {number} param0.fee - Phí đỗ xe (nếu có)
 * @param {Date} param0.time - Thời gian sự kiện
 */
function sendNotification({ uid, event, cardType, fee = 0, time = new Date() }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "⚠️ Telegram Bot chưa được cấu hình (Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong file .env)"
    );
    return;
  }

  const formatTime = new Date(time).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

  let message = "";
  if (event === "entry") {
    message = `🚗 <b>[BÃI XE THÔNG MINH - NHÓM 17] XE VÀO BÃI</b>\n` +
              `• <b>Mã thẻ (UID):</b> <code>${uid}</code>\n` +
              `• <b>Loại thẻ:</b> ${cardType}\n` +
              `• <b>Thời gian vào:</b> ${formatTime}\n` +
              `• <b>Trạng thái:</b> Cổng vào đã mở`;
  } else {
    const feeText = cardType === "VIP" ? "Miễn phí (VIP)" : `${fee} PHP`;
    const statusText = cardType === "VIP" ? "Cổng ra đã mở" : "Chờ thanh toán";
    message = `🚙 <b>[BÃI XE THÔNG MINH - NHÓM 17] XE YÊU CẦU RA</b>\n` +
              `• <b>Mã thẻ (UID):</b> <code>${uid}</code>\n` +
              `• <b>Loại thẻ:</b> ${cardType}\n` +
              `• <b>Phí đỗ xe:</b> <b>${feeText}</b>\n` +
              `• <b>Thời gian ra:</b> ${formatTime}\n` +
              `• <b>Trạng thái:</b> ${statusText}`;
  }

  const data = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
  });

  const options = {
    hostname: "api.telegram.org",
    port: 443,
    path: `/bot${token}/sendMessage`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
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
          console.log(`Telegram Bot: Đã gửi thông báo sự kiện '${event}' thành công!`);
        } else {
          console.error("Telegram Bot trả về lỗi:", response.description);
        }
      } catch (e) {
        console.error("Lỗi parse phản hồi từ Telegram:", e.message);
      }
    });
  });

  req.on("error", (error) => {
    console.error("Lỗi gửi tin nhắn HTTP tới Telegram:", error.message);
  });

  req.write(data);
  req.end();
}

module.exports = {
  sendNotification,
};
