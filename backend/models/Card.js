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
  }
}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);
