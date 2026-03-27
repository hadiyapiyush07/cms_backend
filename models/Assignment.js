const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  fileType: { type: String, enum: ['image', 'pdf', 'document'], required: true },
  url: { type: String, required: true },
  size: { type: Number, required: true },
});

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  dueDate: { type: Date, required: true },
  attachments: [attachmentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Professor', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Index for efficient queries
assignmentSchema.index({ subject: 1, dueDate: -1 });
assignmentSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);