const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    // index: true,  // REMOVED – we define unique index separately
  },
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professor',
    required: true,
    index: true // keep this for fast queries by professor
  },
  content: {
    type: String,
    required: [true, 'Syllabus content is required'],
    trim: true
  },
  attachments: [{
    type: String,
    trim: true
  }],
  version: {
    type: Number,
    default: 1
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professor'
  }
}, {
  timestamps: true
});

// Unique index on subject to ensure only one syllabus per subject
syllabusSchema.index({ subject: 1 }, { unique: true });

// Optionally add other indexes for performance
syllabusSchema.index({ professor: 1, createdAt: -1 });

module.exports = mongoose.model('Syllabus', syllabusSchema);