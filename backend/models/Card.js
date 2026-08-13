const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['VIP', 'GUEST'],
    required: true,
    default: 'GUEST'
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'ASSIGNED'],
    default: 'AVAILABLE',
    index: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  plate: {
    type: String,
    default: null,
    trim: true
  }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Card', cardSchema);
