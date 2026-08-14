const mongoose = require("mongoose");

const deviceLogSchema = new mongoose.Schema(
  {
    component: {
      type: String,
      required: true,
      enum: ["device", "mqtt", "rfid"],
      index: true,
    },
    status: {
      type: String,
      enum: ["online", "offline", "connected", "disconnected", "reconnecting", "error", "card_received"],
      required: true,
      index: true,
    },
    deviceId: { type: String, default: null, index: true },
    bootId: { type: String, default: null, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

deviceLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("DeviceLog", deviceLogSchema);
