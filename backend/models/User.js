const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    parkingStatus: {
      type: String,
      enum: ["IN", "OUT"],
      default: "OUT",
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    telegram: {
      chatId: { type: String, default: null },
      linkedAt: { type: Date, default: null },
      notificationsEnabled: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index(
  { "telegram.chatId": 1 },
  { unique: true, partialFilterExpression: { "telegram.chatId": { $type: "string" } } },
);

// Require either phone or email
userSchema.pre('validate', function() {
  if (!this.phone && !this.email) {
    throw new Error('User must have either a phone number or an email address.');
  }
});

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
