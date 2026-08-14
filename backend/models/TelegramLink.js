const mongoose = require("mongoose");

const telegramLinkSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("TelegramLink", telegramLinkSchema);
