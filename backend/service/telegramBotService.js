const crypto = require("crypto");
const https = require("https");
const TelegramLink = require("../models/TelegramLink");
const User = require("../models/User");
const { sendTelegramMessage } = require("./telegramService");

let updateOffset = 0;
let pollTimer = null;
let polling = false;
let cachedBotUsername = process.env.TELEGRAM_BOT_USERNAME || null;

function telegramApi(method, payload = {}) {
  return new Promise((resolve, reject) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return reject(new Error("Thiếu TELEGRAM_BOT_TOKEN"));
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 10000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) return reject(new Error(parsed.description || "Telegram API error"));
          resolve(parsed.result);
        } catch (error) { reject(error); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Telegram timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

async function getBotUsername() {
  if (cachedBotUsername) return cachedBotUsername;
  const bot = await telegramApi("getMe");
  cachedBotUsername = bot.username;
  return cachedBotUsername;
}

async function processUpdate(update) {
  const message = update.message;
  const text = String(message?.text || "").trim();
  const chatId = message?.chat?.id;
  if (!chatId || !text.startsWith("/start")) return;

  const match = text.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+([A-F0-9]{8})$/i);
  if (!match) {
    await sendTelegramMessage(
      chatId,
      "👋 <b>Chào mừng đến Parking Bot</b>\n\n" +
      "Để liên kết tài khoản, hãy mở trang User → Thông báo → Liên kết Telegram, " +
      "sau đó gửi lệnh <code>/start MÃ_LIÊN_KẾT</code>.",
    );
    return;
  }

  const link = await TelegramLink.findOne({
    code: match[1].toUpperCase(),
    expiresAt: { $gt: new Date() },
  });
  if (!link) {
    await sendTelegramMessage(chatId, "❌ <b>LIÊN KẾT THẤT BẠI</b>\n\nMã liên kết không hợp lệ, đã được sử dụng hoặc đã hết hạn.");
    return;
  }

  const linkedToAnotherUser = await User.exists({
    _id: { $ne: link.user },
    "telegram.chatId": String(chatId),
  });
  if (linkedToAnotherUser) {
    await sendTelegramMessage(chatId, "❌ <b>LIÊN KẾT THẤT BẠI</b>\n\nTài khoản Telegram này đã liên kết với một User khác.");
    return;
  }

  const user = await User.findByIdAndUpdate(link.user, {
    $set: {
      "telegram.chatId": String(chatId),
      "telegram.linkedAt": new Date(),
      "telegram.notificationsEnabled": true,
    },
  }, { returnDocument: "after" });
  if (!user) {
    await sendTelegramMessage(chatId, "❌ <b>LIÊN KẾT THẤT BẠI</b>\n\nKhông tìm thấy tài khoản User cần liên kết.");
    return;
  }

  await TelegramLink.deleteOne({ _id: link._id });
  await sendTelegramMessage(
    chatId,
    `✅ <b>LIÊN KẾT THÀNH CÔNG</b>\n\n` +
    `Xin chào <b>${String(user.fullName).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</b>.\n` +
    `Bạn sẽ nhận thông báo khi xe vào, xe ra và khi số dư không đủ.`,
  );
}

async function pollTelegram() {
  if (polling) return;
  polling = true;
  try {
    const updates = await telegramApi("getUpdates", { offset: updateOffset, timeout: 0, allowed_updates: ["message"] });
    for (const update of updates) {
      updateOffset = update.update_id + 1;
      try {
        await processUpdate(update);
      } catch (error) {
        const chatId = update.message?.chat?.id;
        console.error("Xử lý liên kết Telegram:", error.message);
        if (chatId) {
          try {
            await sendTelegramMessage(chatId, "❌ <b>LIÊN KẾT THẤT BẠI</b>\n\nHệ thống đang gặp lỗi, vui lòng thử lại sau.");
          } catch (_) {
            // Lỗi gửi đã được ghi trong telegramService.
          }
        }
      }
    }
  } catch (error) {
    console.error("Telegram polling:", error.message);
  } finally {
    polling = false;
  }
}

function startTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN || pollTimer) return;
  void pollTelegram();
  pollTimer = setInterval(() => void pollTelegram(), 5000);
}

function createLinkCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

module.exports = { startTelegramBot, getBotUsername, createLinkCode };
