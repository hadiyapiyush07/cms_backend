const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth.middleware');

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
      password,               // plain text password
      isActive,
      profilePicture,
    } = req.body;

    // Check for existing student
    const existingStudent = await Student.findOne({
      $or: [{ enrollmentNum }, { email }],
    });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this enrollment number or email already exists',
      });
    }

    // Create student with plain password
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
      password,            // stored as plain text
      isActive: isActive !== undefined ? isActive : true,
      profilePicture,
    });

    await student.save();

    // Remove password from response
    const studentResponse = student.toObject();
    delete studentResponse.password;

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      data: studentResponse,
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;