const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth.middleware');

// Configure multer for file uploads (similar to upload.routes)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/notifications/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// GET /api/notifications?department=:deptId (for students) or all (admin)
router.get('/', protect, async (req, res) => {
  try {
    let query = { isActive: true };
    // If student, filter by their department
    if (req.userRole === 'student') {
      query.department = req.user.department; // student's department
    } else if (req.userRole === 'admin') {
      // Admin can optionally filter by department
      if (req.query.department) {
        query.department = req.query.department;
      }
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const notifications = await Notification.find(query)
      .populate('department', 'name code')
      .populate('createdBy', 'firstName lastName email')
      .sort('-createdAt');
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notifications (admin only) with file uploads
router.post('/', protect, authorize('admin'), upload.array('attachments', 5), async (req, res) => {
  try {
    const { title, content, department } = req.body;
    if (!title || !content || !department) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Process uploaded files
    const attachments = [];
    if (req.files && req.files.length) {
      req.files.forEach(file => {
        const fileType = file.mimetype.startsWith('image/') ? 'image' : 'pdf';
        attachments.push({
          filename: file.originalname,
          fileType,
          url: `${req.protocol}://${req.get('host')}/uploads/notifications/${file.filename}`,
          size: file.size,
        });
      });
    }

    const notification = new Notification({
      title,
      content,
      department,
      attachments,
      createdBy: req.user._id,
    });
    await notification.save();

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/notifications/:id (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    // Optionally delete attached files from disk
    const fs = require('fs');
    notification.attachments.forEach(att => {
      const filePath = path.join(__dirname, '..', att.url.replace(`${req.protocol}://${req.get('host')}/`, ''));
      fs.unlink(filePath, (err) => { if (err) console.error(err); });
    });
    await notification.deleteOne();
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;