const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  role: { type: String, enum: ['student', 'professor', 'admin'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'role' },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  attempts: { type: Number, default: 0 }
}, { timestamps: true });

// Auto-delete expired records
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);