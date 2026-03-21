const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Professor = require('../models/Professor'); // if needed
const { protect, authorize } = require('../middleware/auth.middleware');

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private (Admin only)
router.get('/profile', protect, authorize('admin'), (req, res) => {
  // req.user is already attached by the protect middleware
  res.json({
    success: true,
    data: req.user
  });
});

// ========== Dashboard ==========
// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', protect, authorize('admin'), async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const activeStudents = await Student.countDocuments({ isActive: true });
    const totalProfessors = await Professor.countDocuments(); // if you have Professor model
    // Add more stats as needed

    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        totalProfessors,
        // ... other stats
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== Student Management ==========

// @desc    Get all students (with pagination, search & filters)
// @route   GET /api/admin/students
// @access  Private (Admin only)
router.get('/students', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, department, semester } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { enrollmentNum: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (department) {
      query.department = department;
    }

    if (semester) {
      query.semesterID = semester;
    }

    const students = await Student.find(query)
      .populate('department', 'name code')
      .populate('semesterID', 'semesterName academicYear')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort('-createdAt');

    const total = await Student.countDocuments(query);

    res.json({
      success: true,
      data: students,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get single student by ID
// @route   GET /api/admin/students/:id
// @access  Private (Admin only)
router.get('/students/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('department', 'name code')
      .populate('semesterID', 'semesterName academicYear');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a new student
// @route   POST /api/admin/students
// @access  Private (Admin only)
router.post('/students', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      enrollmentNum,
      aadharNumber,
      name,
      dob,
      gender,
      bloodGroup,
      nationality,
      religion,
      category,
      caste,
      subcaste,
      email,
      contactNumber,
      alternateContact,
      address,
      city,
      state,
      pincode,
      fatherName,
      motherName,
      guardianName,
      parentContact,
      parentEmail,
      parentOccupation,
      admissionYear,
      batch,
      department,
      semesterID,
      currentYear,
      password,
      isActive,
      profilePicture,
      // 10th qualification fields
      tenthBoard,
      tenthAdmitNumber,
      tenthPassingYear,
      tenthMarksObtained,
      // 12th qualification fields
      twelfthBoard,
      twelfthAdmitNumber,
      twelfthPassingYear,
      twelfthMarksObtained,
      twelfthTotalMarks,
    } = req.body;

    // Check for existing student
    const existingStudent = await Student.findOne({
      $or: [{ enrollmentNum }, { email }, { aadharNumber }],
    });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this enrollment number, email, or Aadhar number already exists',
      });
    }
  
    // Create student
    const student = new Student({
      enrollmentNum,
      aadharNumber,
      name,
      dob,
      gender,
      bloodGroup,
      nationality,
      religion,
      category,
      caste,
      subcaste,
      email,
      contactNumber,
      alternateContact,
      address,
      city,
      state,
      pincode,
      fatherName,
      motherName,
      guardianName,
      parentContact,
      parentEmail,
      parentOccupation,
      admissionYear,
      batch,
      department,
      semesterID,
      currentYear,
      password,
      isActive: isActive !== undefined ? isActive : true,
      profilePicture,
      // 10th
      tenthBoard,
      tenthAdmitNumber,
      tenthPassingYear,
      tenthMarksObtained,
      // 12th
      twelfthBoard,
      twelfthAdmitNumber,
      twelfthPassingYear,
      twelfthMarksObtained,
      twelfthTotalMarks,
    });

    await student.save();

    const studentResponse = student.toObject();
    delete studentResponse.password;

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      data: studentResponse,
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update a student
// @route   PUT /api/admin/students/:id
// @access  Private (Admin only)
router.put('/students/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const updates = req.body;

    // If password is empty or not provided, remove it from updates so it doesn't get overwritten
    if (!updates.password || updates.password.trim() === '') {
      delete updates.password;
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('department semesterID');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({ success: true, message: 'Student updated successfully', data: student });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete a student (hard delete – adjust as needed)
// @route   DELETE /api/admin/students/:id
// @access  Private (Admin only)
router.delete('/students/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;