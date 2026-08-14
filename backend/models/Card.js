const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true
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
    default: null
  },
  plate: {
    type: String,
    default: null,
    trim: true
  }
}, { timestamps: true, versionKey: false });

cardSchema.index(
  { owner: 1 },
  { unique: true, partialFilterExpression: { owner: { $type: "objectId" } } },
);

module.exports = mongoose.model('Card', cardSchema);
