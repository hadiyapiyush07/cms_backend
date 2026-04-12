const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

const STUDENT_PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'StudentPhoto');
if (!fs.existsSync(STUDENT_PHOTO_DIR)) {
  fs.mkdirSync(STUDENT_PHOTO_DIR, { recursive: true });
}
 
// ── Multer storage config for StudentPhoto ───────────────────────────────────
const studentPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STUDENT_PHOTO_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
 
const studentPhotoUpload = multer({
  storage: studentPhotoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext     = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime    = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only JPG, PNG, WEBP images are allowed for student photos'));
  },
});
 
// ── POST /api/upload/StudentPhoto ────────────────────────────────────────────
// Protected: only logged-in admin can upload
router.post(
  '/StudentPhoto',
  protect,
  authorize('admin'),
  studentPhotoUpload.single('file'),   // field name must be 'file' — matches frontend FormData
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
 
    // Build the public URL — adjust the base URL to match your server setup
    const fileUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/StudentPhoto/${req.file.filename}`;
 
    return res.json({
      success: true,
      url:     fileUrl,
      filename: req.file.filename,
    });
  }
);
 
// ── Error handler for multer (oversized file, wrong type etc.) ───────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

// Destination: uploads/syllabus
const uploadDir = path.join(__dirname, '../uploads/syllabus');


// Create directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp + random + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// File filter: allow images, PDF, Word, PowerPoint
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: images, PDF, Word, PowerPoint'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

// POST /api/upload – single file upload (admin & professor)
router.post('/', protect, authorize('admin', 'professor'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  // Construct URL: /uploads/syllabus/filename
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/syllabus/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Optional: multiple file upload (admin/professor)
router.post('/multiple', protect, authorize('admin', 'professor'), upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }
  const urls = req.files.map(
    (file) => `${req.protocol}://${req.get('host')}/uploads/syllabus/${file.filename}`
  );
  res.json({ success: true, urls });
});

module.exports = router;