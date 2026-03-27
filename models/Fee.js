const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  semester: { type: Number, required: true, min: 1, max: 6 },
  amount: { type: Number, required: true }, // in paise
  paid: { type: Boolean, default: false },
  paymentId: { type: String, default: null },
  receipt: { type: String, default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

feeSchema.index({ student: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Fee', feeSchema);