const express = require('express');
const router = express.Router();
const Semester = require('../models/Semester');
const { protect, authorize } = require('../middleware/auth.middleware');

// GET all semesters – accessible only by admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const semesters = await Semester.find().sort('academicYear semesterName');
    res.json({
      success: true,
      data: semesters,
    });
  } catch (err) {
    console.error('Error fetching semesters:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// (Optional) POST a new semester – if needed later
// router.post('/', protect, authorize('admin'), async (req, res) => { ... });

module.exports = router;