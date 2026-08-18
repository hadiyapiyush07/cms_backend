// models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['present', 'absent'], default: 'absent' },
  timeSlot: { type: String, required: true, default: '09:00 - 10:00' }, // e.g., '09:00 - 10:00'
  division: { type: String, enum: ['A', 'B', 'C'], required: true, default: 'A' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Professor', required: true },
}, { timestamps: true });

// Unique index: one attendance per student per subject per date per timeSlot
attendanceSchema.index({ date: 1, subject: 1, timeSlot: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);