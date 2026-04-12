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
    const { page = 1, limit = 50, search, department, semester } = req.query;
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

// ========== Auto‑generate a unique 12‑digit enrollment number ==========
// @route   GET /api/admin/students/next-enrollment
// @access  Private (Admin only)
router.get('/students/next-enrollment', protect, authorize('admin'), async (req, res) => {
  try {
    const { year, department } = req.query;
    if (!year || !department) {
      return res.status(400).json({ success: false, message: 'Year and department are required' });
    }

    // 1. Get department and its 2‑digit code
    const Department = require('../models/Department');
    const dept = await Department.findById(department);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Define a mapping from department name → 2‑digit code
    // You can also store a 'code' field directly in the Department model – more flexible.
    const deptCodeMap = {
      'BCA': '01', 'BBA': '02', 'BCOM': '03',
      'MCA': '04', 'MBA': '05', 'MCOM': '06'
    };
    const deptName = dept.name.toUpperCase().replace(/[\s.]/g, '');
    let deptCode = deptCodeMap[deptName];
    if (!deptCode) {
      // Fallback: first two letters + '0' (e.g., "CS0")
      deptCode = (deptName.substring(0, 2) + '0').toUpperCase();
    }

    // 2. Determine the middle part (e.g., "21" from "2021")
    //    In your examples: 202401210315 → middle "21" (batch start year last 2 digits)
    //                       202501010001 → middle "01" (??)
    // We'll assume the middle part is the last two digits of the admission year.
    // If you need a different logic (batch year), adjust here.
    const middlePart = year.slice(-2);   // "2024" → "24", "2025" → "25"
    // Or if you want the batch start year (e.g., for 3‑year course, admission 2024 → batch 2021):
    // const duration = (deptName.includes('BCA') || deptName.includes('BBA')) ? 3 : 2;
    // const batchYear = parseInt(year) - (duration === 3 ? 3 : 2);
    // const middlePart = String(batchYear).slice(-2);

    // 3. Build the prefix: YYYY + deptCode + middlePart (total 8 digits)
    const prefix = `${year}${deptCode}${middlePart}`;   // e.g., "20240124" for 2024 admission

    // 4. Find the highest existing enrollment number with this prefix
    const lastStudent = await Student.findOne({
      enrollmentNum: { $regex: `^${prefix}` }
    }).sort({ enrollmentNum: -1 });

    let nextSeq = 1;
    if (lastStudent) {
      const lastNum = lastStudent.enrollmentNum;
      // Last 4 digits are the sequence number (because total length = 12)
      const seqPart = lastNum.slice(-4);
      nextSeq = parseInt(seqPart, 10) + 1;
    }

    // 5. Build the full 12‑digit enrollment number
    const enrollmentNum = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    // 6. Final safety check – ensure it's really unique (in case of race condition)
    const exists = await Student.findOne({ enrollmentNum });
    if (exists) {
      // Very rare, but if it happens, retry once
      const fallback = await Student.findOne({ enrollmentNum: { $regex: `^${prefix}` } }).sort({ enrollmentNum: -1 });
      const newSeq = fallback ? parseInt(fallback.enrollmentNum.slice(-4), 10) + 1 : nextSeq + 1;
      const finalNum = `${prefix}${String(newSeq).padStart(4, '0')}`;
      return res.json({ success: true, enrollmentNum: finalNum });
    }

    res.json({ success: true, enrollmentNum });
  } catch (error) {
    console.error('Enrollment generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate enrollment number' });
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