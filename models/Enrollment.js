const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
  enrollmentDate: { type: Date, default: Date.now },
}, { timestamps: true });

// Ensure a student is enrolled only once per subject
enrollmentSchema.index({ student: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);