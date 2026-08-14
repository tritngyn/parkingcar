const Card = require("../models/Card");
const { sendTelegramMessage, formatTime, formatMoney } = require("./telegramService");

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

async function notifyUserByUid(uid, type, data = {}) {
  try {
    const card = await Card.findOne({ uid }).populate("owner", "fullName telegram balance");
    const user = card?.owner;
    if (!user?.telegram?.chatId || user.telegram.notificationsEnabled === false) return false;

    let message;
    if (type === "ENTRY") {
      message = `🚗 <b>XE ĐÃ VÀO BÃI</b>\n\n` +
        `• <b>Chủ xe:</b> ${escapeHtml(user.fullName)}\n` +
        `• <b>UID:</b> <code>${escapeHtml(uid)}</code>\n` +
        `• <b>Biển số:</b> ${escapeHtml(card.plate || "Chưa cập nhật")}\n` +
        `• <b>Thời gian:</b> ${formatTime(data.time)}`;
    } else if (type === "EXIT") {
      message = `✅ <b>XE ĐÃ RA KHỎI BÃI</b>\n\n` +
        `• <b>UID:</b> <code>${escapeHtml(uid)}</code>\n` +
        `• <b>Phí:</b> ${formatMoney(data.fee)}\n` +
        `• <b>Số dư còn lại:</b> ${formatMoney(data.balance)}\n` +
        `• <b>Thời gian:</b> ${formatTime(data.time)}`;
    } else if (type === "LOW_BALANCE") {
      message = `⚠️ <b>KHÔNG ĐỦ SỐ DƯ</b>\n\n` +
        `• <b>UID:</b> <code>${escapeHtml(uid)}</code>\n` +
        `• <b>Phí cần trả:</b> ${formatMoney(data.fee)}\n` +
        `• <b>Số dư hiện tại:</b> ${formatMoney(data.balance)}\n\n` +
        `Vui lòng nạp thêm tiền để mở cổng ra.`;
    } else if (type === "PAYMENT_SUCCESS") {
      message = `✅ <b>THANH TOÁN THÀNH CÔNG</b>\n\n` +
        `• <b>UID:</b> <code>${escapeHtml(uid)}</code>\n` +
        `• <b>Phí:</b> ${formatMoney(data.fee)}\n` +
        `• <b>Số dư còn lại:</b> ${formatMoney(data.balance)}\n` +
        `• <b>Thời gian:</b> ${formatTime(data.time)}`;
    } else {
      return false;
    }

    await sendTelegramMessage(user.telegram.chatId, message);
    return true;
  } catch (error) {
    console.error(`Thông báo Telegram user ${type}:`, error.message);
    return false;
  }
}

module.exports = { notifyUserByUid };
