// models/Semester.js
const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema({
  semesterID: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  semesterName: {
    type: String,
    required: true,
    enum: [
      'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
      'Semester 5', 'Semester 6'
    ]
  },
  academicYear: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Semester = mongoose.model('Semester', semesterSchema);
module.exports = Semester;