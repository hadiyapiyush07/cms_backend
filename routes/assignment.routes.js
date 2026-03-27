const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const Subject = require('../models/Subject');
const Professor = require('../models/Professor');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth.middleware');

// Configure multer storage for assignments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/assignments';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Helper to determine file type
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  return 'document';
};

// ---------- Professor routes ----------

// GET all subjects taught by the professor (for assignment creation)
router.get('/subjects', protect, authorize('professor'), async (req, res) => {
  try {
    const professor = await Professor.findById(req.user._id).populate({
      path: 'coursesTaught',
      populate: { path: 'semester', select: 'semesterName' }
    });
    if (!professor) return res.status(404).json({ success: false, message: 'Professor not found' });
    res.json({ success: true, data: professor.coursesTaught });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create a new assignment (professor)
router.post('/', protect, authorize('professor'), upload.array('attachments', 5), async (req, res) => {
  try {
    const { title, description, subjectId, dueDate } = req.body;
    if (!title || !description || !subjectId || !dueDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Verify professor teaches this subject
    const professor = await Professor.findById(req.user._id);
    if (!professor.coursesTaught.includes(subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }

    // Process attachments
    const attachments = [];
    if (req.files && req.files.length) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          fileType: getFileType(file.mimetype),
          url: `${req.protocol}://${req.get('host')}/uploads/assignments/${file.filename}`,
          size: file.size,
        });
      });
    }

    const assignment = new Assignment({
      title,
      description,
      subject: subjectId,
      dueDate: new Date(dueDate),
      attachments,
      createdBy: req.user._id,
    });
    await assignment.save();

    const populated = await Assignment.findById(assignment._id)
      .populate('subject', 'name code')
      .populate('createdBy', 'name email');

    res.status(201).json({ success: true, data: populated, message: 'Assignment created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update an assignment (professor)
router.put('/:id', protect, authorize('professor'), upload.array('newAttachments', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, attachmentsToKeep } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Update basic fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = new Date(dueDate);

    // Handle attachments: keep only those listed in attachmentsToKeep
    let keepIds = [];
    if (attachmentsToKeep) {
      keepIds = JSON.parse(attachmentsToKeep); // array of attachment _ids to keep
    }
    const toRemove = assignment.attachments.filter(att => !keepIds.includes(att._id.toString()));
    // Delete files from disk
    for (const att of toRemove) {
      const filePath = path.join(__dirname, '..', att.url.replace(`${req.protocol}://${req.get('host')}/`, ''));
      fs.unlink(filePath, (err) => { if (err) console.error(err); });
    }
    // Keep only the ones we want
    assignment.attachments = assignment.attachments.filter(att => keepIds.includes(att._id.toString()));

    // Add new attachments
    if (req.files && req.files.length) {
      req.files.forEach(file => {
        assignment.attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          fileType: getFileType(file.mimetype),
          url: `${req.protocol}://${req.get('host')}/uploads/assignments/${file.filename}`,
          size: file.size,
        });
      });
    }

    await assignment.save();
    const populated = await Assignment.findById(assignment._id)
      .populate('subject', 'name code')
      .populate('createdBy', 'name email');

    res.json({ success: true, data: populated, message: 'Assignment updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET assignments created by this professor (with optional subject filter)
router.get('/professor', protect, authorize('professor'), async (req, res) => {
  try {
    const { subjectId } = req.query;
    const query = { createdBy: req.user._id };
    if (subjectId) query.subject = subjectId;
    const assignments = await Assignment.find(query)
      .populate('subject', 'name code')
      .sort({ dueDate: -1, createdAt: -1 });
    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE assignment (professor)
router.delete('/:id', protect, authorize('professor'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    // Delete associated files from disk
    if (assignment.attachments.length) {
      assignment.attachments.forEach(att => {
        const filePath = path.join(__dirname, '..', att.url.replace(`${req.protocol}://${req.get('host')}/`, ''));
        fs.unlink(filePath, (err) => { if (err) console.error(err); });
      });
    }
    await assignment.deleteOne();
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- Student routes ----------

// GET assignments for the student (based on their department and semester)
router.get('/student', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findById(req.user._id).populate('department semesterID');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Find subjects that belong to the student's department and semester
    const subjects = await Subject.find({
      department: student.department._id,
      semester: student.semesterID._id,
      isActive: true,
    }).select('_id');

    const subjectIds = subjects.map(s => s._id);
    const assignments = await Assignment.find({
      subject: { $in: subjectIds },
      isActive: true,
    })
      .populate('subject', 'name code')
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1, createdAt: -1 });

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;