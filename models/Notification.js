const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: String,
  fileType: String, // e.g., 'image', 'pdf'
  url: String,
  size: Number,
});

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  attachments: [attachmentSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Notification', notificationSchema);