const express = require('express');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth.middleware');
const { createCloudinaryStorage } = require('../utils/cloudinary');

const router = express.Router();

// ── Cloudinary storage for StudentPhoto ───────────────────────────────────
const studentPhotoStorage = createCloudinaryStorage('StudentPhoto');
 
const studentPhotoUpload = multer({
  storage: studentPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});
 
// ── POST /api/upload/StudentPhoto ────────────────────────────────────────────
// Protected: only logged-in admin can upload
router.post(
  '/StudentPhoto',
  protect,
  authorize('admin'),
  studentPhotoUpload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
 
    // req.file.path contains the secure Cloudinary URL
    return res.json({
      success: true,
      url: req.file.path,
      filename: req.file.filename,
    });
  }
);
 
// ── Cloudinary storage for Syllabus/Documents ────────────────────────────────
const syllabusStorage = createCloudinaryStorage('syllabus');

const upload = multer({
  storage: syllabusStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

// POST /api/upload – single file upload (admin & professor)
router.post('/', protect, authorize('admin', 'professor'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  res.json({ success: true, url: req.file.path });
});

// Optional: multiple file upload (admin/professor)
router.post('/multiple', protect, authorize('admin', 'professor'), upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }
  const urls = req.files.map((file) => file.path);
  res.json({ success: true, urls });
});

// ── Error handler for multer ───────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

module.exports = router;