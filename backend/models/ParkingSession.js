const mongoose = require("mongoose");

const parkingSessionSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "pending_payment", "completed"],
      default: "active",
      index: true,
    },

    entryTime: {
      type: Date,
      required: true,
      default: Date.now,
    },

    exitTime: {
      type: Date,
      default: null,
    },

    device: {
      type: String,
      default: null,
      trim: true,
    },

    direction: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
      default: "IN",
    },

    fee: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model(
  "ParkingSession",
  parkingSessionSchema
);
