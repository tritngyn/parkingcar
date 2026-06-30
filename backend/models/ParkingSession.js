const mongoose = require('mongoose');

const parkingSessionSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    index: true
  },
  time_in: {
    type: Date,
    required: true,
    default: Date.now
  },
  time_out: {
    type: Date
  },
  fee: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['IN', 'OUT', 'PENDING_PAYMENT'],
    required: true,
    default: 'IN'
  }
}, { timestamps: true });

module.exports = mongoose.model('ParkingSession', parkingSessionSchema);
