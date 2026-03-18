const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { protect, authorize } = require('../middleware/auth.middleware');

// GET all departments – accessible only by admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const departments = await Department.find().sort('name');
    res.json({
      success: true,
      data: departments,
    });
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// (Optional) POST a new department – if needed later
// router.post('/', protect, authorize('admin'), async (req, res) => { ... });

module.exports = router;