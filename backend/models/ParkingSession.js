const mongoose = require("mongoose");

/**
 * Định dạng ngày giờ theo múi giờ Việt Nam (UTC+7): MM/DD/YYYY HH:mm
 * @param {Date|string} date
 * @returns {string|null}
 */
function formatDateTime(date) {
  if (!date) return null;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  // Luôn lấy giờ Việt Nam, không phụ thuộc múi giờ của máy đang chạy Node.js.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsedDate);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.month}/${values.day}/${values.year} ${values.hour}:${values.minute}`;
}

const parkingSessionSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    direction: {
      type: String,
      enum: ["IN", "OUT"],
      default: "IN",
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

    fee: {
      type: Number,
      default: 0,
    },

    longParkingNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

// Virtual: hiển thị entryTime theo định dạng MM/DD/YYYY HH:mm
parkingSessionSchema.virtual("entryTimeFormatted").get(function () {
  return formatDateTime(this.entryTime);
});

// Virtual: hiển thị exitTime theo định dạng MM/DD/YYYY HH:mm
parkingSessionSchema.virtual("exitTimeFormatted").get(function () {
  return formatDateTime(this.exitTime);
});

module.exports = mongoose.model("ParkingSession", parkingSessionSchema);
module.exports.formatDateTime = formatDateTime;
