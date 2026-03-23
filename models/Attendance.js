const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['present', 'absent'], default: 'absent' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Professor', required: true },
}, { timestamps: true });

// Unique index: one attendance per student per subject per date
attendanceSchema.index({ date: 1, subject: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);