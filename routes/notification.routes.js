const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Notification = require('../models/Notification');
const NotificationRead = require('../models/NotificationRead');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth.middleware');
const { sendEmail } = require('../utils/email'); // your email utility
const { createCloudinaryStorage } = require('../utils/cloudinary');

// Multer config for file uploads
const storage = createCloudinaryStorage('notifications');
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.post('/create-order', protect, authorize('student'), async (req, res) => {
  try {
    let fee = await Fee.findOne({ student: req.user._id });
    if (!fee) {
      fee = new Fee({
        student: req.user._id,
        amount: 50000, // ₹500
        paid: false,
      });
      await fee.save();
    }
    if (fee.paid) {
      return res.status(400).json({ success: false, message: 'Fee already paid' });
    }
    const options = {
      amount: fee.amount,
      currency: 'INR',
      receipt: `receipt_${fee._id}`,
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);
    fee.orderId = order.id;
    await fee.save();
    res.json({ success: true, orderId: order.id, amount: fee.amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all notifications (student gets only his department, with read status)
router.get('/', protect, async (req, res) => {
  try {
    let notifications;
    if (req.userRole === 'student') {
      const studentId = req.user._id;
      notifications = await Notification.aggregate([
        { $match: { department: req.user.department, isActive: true } },
        { $lookup: {
            from: 'notificationreads',
            let: { notifId: '$_id' },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$notification', '$$notifId'] },
                      { $eq: ['$student', studentId] }
                    ]
                  }
                }
              }
            ],
            as: 'readInfo'
          }
        },
        { $addFields: {
            isRead: { $ifNull: [{ $arrayElemAt: ['$readInfo.isRead', 0] }, false] }
          }
        },
        { $project: { readInfo: 0 } }
      ]).sort('-createdAt');
    } else if (req.userRole === 'admin') {
      const filter = {};
      if (req.user.role === 'DepartmentAdmin') {
        filter.department = req.user.department;
      } else if (req.query.department) {
        filter.department = req.query.department;
      }
      notifications = await Notification.find(filter)
        .populate('department', 'name code')
        .populate('createdBy', 'firstName lastName email')
        .sort('-createdAt');
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET unread count for student
router.get('/unread-count', protect, async (req, res) => {
  try {
    if (req.userRole !== 'student') {
      return res.json({ success: true, count: 0 });
    }
    const count = await NotificationRead.countDocuments({
      student: req.user._id,
      isRead: false,
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create notification (admin only)
router.post('/', protect, authorize('admin'), upload.array('attachments', 5), async (req, res) => {
  try {
    let { title, content, department } = req.body;
    
    // RBAC: Normal Admin can only send notifications to their own department
    if (req.userRole === 'admin' && req.user.role === 'DepartmentAdmin') {
      department = req.user.department;
    }

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
          url: file.path,
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

    // Create read entries for all students in the department
    const students = await Student.find({ department: department, isActive: true }).select('_id');
    const readEntries = students.map(s => ({
      notification: notification._id,
      student: s._id,
      isRead: false,
    }));
    if (readEntries.length) {
      await NotificationRead.insertMany(readEntries, { ordered: false });
    }

    // -----------------------------------------------------------------
    // EMAIL SENDING – with inline images and attachments, NO LINK
    // -----------------------------------------------------------------
    const backendBaseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

    const studentsWithEmails = await Student.find(
      { department: department, isActive: true },
      { email: 1, name: 1 }
    );

    setImmediate(() => {
      studentsWithEmails.forEach(async (student) => {
        // Prepare attachments for the email (inline images + regular files)
        const emailAttachments = [];
        let imageCids = {}; // store cid per image filename

        for (const att of attachments) {
          // Extract the actual filename on disk
          const diskFilename = att.url.split('/').pop();
          const filePath = path.join(__dirname, '..', 'uploads', 'notifications', diskFilename);

          // Skip if file doesn't exist
          if (!fs.existsSync(filePath)) continue;

          const isImage = att.fileType === 'image';
          const cid = isImage ? `img_${Date.now()}_${Math.random().toString(36).substr(2, 8)}` : null;

          emailAttachments.push({
            filename: att.filename,
            path: filePath,
            cid: isImage ? cid : undefined,
            contentDisposition: isImage ? 'inline' : 'attachment',
          });

          if (isImage) {
            imageCids[att.filename] = cid;
          }
        }

        // Build HTML with inline images and attachment list
        let imageHtml = '';
        for (const att of attachments) {
          if (att.fileType === 'image') {
            const cid = imageCids[att.filename];
            if (cid) {
              imageHtml += `<p><img src="cid:${cid}" alt="${att.filename}" style="max-width: 100%;"></p>`;
            }
          }
        }

        const nonImageAttachments = attachments.filter(att => att.fileType !== 'image');
        const attachmentListHtml = nonImageAttachments.length
          ? `<p><strong>Attachments:</strong><br>${nonImageAttachments.map(att => `📎 ${att.filename}`).join('<br>')}</p>`
          : '';

        // Email HTML without any <a> tag
        const emailHtml = `
          <h2>Title : ${title}</h2>
          <p>${content}</p>
          ${attachmentListHtml}
          ${imageHtml}
          <hr />
          <p>This is an automated message. Please do not reply.</p>
        `;

        try {
          await sendEmail(student.email, `[Campus Flow] ${title}`, emailHtml, emailAttachments);
        } catch (err) {
          console.error(`Failed to send email to ${student.email}:`, err.message);
        }
      });
    });

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT mark notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const studentId = req.user._id;
    const readRecord = await NotificationRead.findOneAndUpdate(
      { notification: notificationId, student: studentId },
      { $set: { isRead: true, readAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: readRecord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE notification (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    // Skip local file deletion since attachments are in Cloudinary.
    // In production, use cloudinary.uploader.destroy(public_id) if required.
    
    // Delete read records
    await NotificationRead.deleteMany({ notification: notification._id });
    await notification.deleteOne();
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;