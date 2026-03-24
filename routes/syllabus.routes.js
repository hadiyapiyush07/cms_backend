const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Syllabus = require('../models/Syllabus');
const Subject = require('../models/Subject');
const Professor = require('../models/Professor');
const Student = require('../models/Student');
const Semester = require('../models/Semester');
const { protect, authorize } = require('../middleware/auth.middleware');

// ---------- Professor endpoints ----------
router.post('/subject/:subjectId', protect, authorize('professor'), async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { content, attachments } = req.body;
    const professorId = req.user._id;

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const professor = await Professor.findById(professorId);
    if (!professor || !professor.coursesTaught.includes(subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }

    let syllabus = await Syllabus.findOne({ subject: subjectId });
    if (syllabus) {
      syllabus.content = content;
      syllabus.attachments = attachments || syllabus.attachments;
      syllabus.lastUpdatedBy = professorId;
      syllabus.version += 1;
    } else {
      syllabus = new Syllabus({
        subject: subjectId,
        professor: professorId,
        content,
        attachments: attachments || [],
        lastUpdatedBy: professorId,
      });
    }
    await syllabus.save();

    res.status(201).json({ success: true, data: syllabus });
  } catch (error) {
    console.error('Syllabus save error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.get('/subject/:subjectId', protect, authorize('professor'), async (req, res) => {
  try {
    const { subjectId } = req.params;
    const professorId = req.user._id;

    const professor = await Professor.findById(professorId);
    if (!professor || !professor.coursesTaught.includes(subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const syllabus = await Syllabus.findOne({ subject: subjectId })
      .populate('subject', 'name code')
      .populate('professor', 'name email')
      .populate('lastUpdatedBy', 'name');
    if (!syllabus) return res.status(404).json({ success: false, message: 'Syllabus not found' });
    res.json({ success: true, data: syllabus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE endpoint
router.delete('/subject/:subjectId', protect, authorize('professor'), async (req, res) => {
  try {
    const { subjectId } = req.params;
    const professorId = req.user._id;

    const professor = await Professor.findById(professorId);
    if (!professor || !professor.coursesTaught.includes(subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this syllabus' });
    }

    const syllabus = await Syllabus.findOneAndDelete({ subject: subjectId });
    if (!syllabus) {
      return res.status(404).json({ success: false, message: 'Syllabus not found' });
    }
    res.json({ success: true, message: 'Syllabus deleted successfully' });
  } catch (error) {
    console.error('Delete syllabus error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ---------- Student endpoints ----------
// GET /api/syllabus/student/semester/:semesterId - All subjects in a semester with their syllabus
router.get('/student/semester/:semesterId', protect, authorize('student'), async (req, res) => {
  try {
    const { semesterId } = req.params;
    const studentId = req.user._id;

    const student = await Student.findById(studentId).populate('department');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const subjects = await Subject.find({
      semester: semesterId,
      department: student.department._id,
      isActive: true,
    }).populate('semester', 'semesterName');

    const subjectIds = subjects.map(s => s._id);
    const syllabi = await Syllabus.find({ subject: { $in: subjectIds }, isPublished: true })
      .populate('subject', 'name code')
      .lean();

    const result = subjects.map(subject => {
      const syllabus = syllabi.find(s => s.subject._id.toString() === subject._id.toString());
      return {
        subject: {
          id: subject._id,
          name: subject.name,
          code: subject.code,
          semester: subject.semester,
        },
        syllabus: syllabus ? {
          content: syllabus.content,
          attachments: syllabus.attachments,
          version: syllabus.version,
          updatedAt: syllabus.updatedAt,
        } : null,
      };
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/syllabus/student/subject/:subjectId - Specific subject syllabus
router.get('/student/subject/:subjectId', protect, authorize('student'), async (req, res) => {
  try {
    const { subjectId } = req.params;
    const studentId = req.user._id;

    const student = await Student.findById(studentId).populate('department');
    const subject = await Subject.findById(subjectId);
    if (!student || !subject) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // Verify student is enrolled in this subject (by department and semester)
    if (subject.department.toString() !== student.department._id.toString() ||
        subject.semester.toString() !== student.semester.toString()) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this subject' });
    }

    const syllabus = await Syllabus.findOne({ subject: subjectId, isPublished: true })
      .populate('subject', 'name code')
      .populate('professor', 'name email');
    if (!syllabus) {
      return res.status(404).json({ success: false, message: 'Syllabus not available for this subject yet' });
    }
    res.json({ success: true, data: syllabus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/syllabus/student/semesters - List all active semesters
router.get('/student/semesters', protect, authorize('student'), async (req, res) => {
  try {
    const semesters = await Semester.find({ isActive: true }).sort({ semesterName: 1 });
    res.json({ success: true, data: semesters });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;