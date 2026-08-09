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
      enum: ["active", "completed"],
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

    entryDeviceId: {
      type: String,
      default: null,
    },

    exitDeviceId: {
      type: String,
      default: null,
    },

    entryEventId: {
      type: String,
      default: null,
    },

    exitEventId: {
      type: String,
      default: null,
    },

    fee: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ParkingSession",
  parkingSessionSchema
);