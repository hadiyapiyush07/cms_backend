const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  orderId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  semesters: [{ type: Number, required: true }],
  paid: { type: Boolean, default: false },
  paymentId: { type: String, default: null },
  receipt: { type: String, default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);