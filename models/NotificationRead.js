const mongoose = require('mongoose');

const notificationReadSchema = new mongoose.Schema({
  notification: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

notificationReadSchema.index({ notification: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('NotificationRead', notificationReadSchema);