const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Professor = require('../models/Professor'); // if needed
const { protect, authorize, authorizeSuperAdmin } = require('../middleware/auth.middleware');

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
    const isSuper = req.user.role === 'SuperAdmin';
    const deptFilter = isSuper ? {} : { department: req.user.department };

    const totalStudents = await Student.countDocuments(deptFilter);
    const activeStudents = await Student.countDocuments({ ...deptFilter, isActive: true });
    const totalProfessors = await Professor.countDocuments(deptFilter);

    // Line Chart Data (e.g., student admissions per month)
    // Both Super Admin and Normal Admin will see this. 
    // In the future, this will dynamically aggregate Student.createdAt with deptFilter applied.
    const lineChartData = [
      { month: 'Jan', students: 120 },
      { month: 'Feb', students: 150 },
      { month: 'Mar', students: 180 },
      { month: 'Apr', students: 220 },
      { month: 'May', students: 250 },
      { month: 'Jun', students: 300 }
    ];

    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        totalProfessors,
        lineChartData
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
    const { page = 1, limit = 50, search, department, semester, division } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { enrollmentNum: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const isSuper = req.user.role === 'SuperAdmin';
    if (!isSuper) {
      query.department = req.user.department;
    } else if (department) {
      query.department = department;
    }
    
    if (division) {
      if (division === 'A') {
        query.$and = query.$and || [];
        query.$and.push({ $or: [{ division: 'A' }, { division: { $exists: false } }, { division: null }] });
      } else {
        query.division = division;
      }
    }

    if (semester === 'completed') {
      query.isActive = false;
    } else if (semester) {
      query.semesterID = semester;
      if (!search) query.isActive = true; // only show active if no search term
    } else {
      if (!search) query.isActive = true; // default to active unless searching
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

// @desc    Upgrade all active students to next semester
// @route   POST /api/admin/semester/upgrade
// @access  Private (Admin only)
router.post('/semester/upgrade', protect, authorize('admin'), async (req, res) => {
  try {
    const Semester = require('../models/Semester');
    
    const isSuper = req.user.role === 'SuperAdmin';
    const deptFilter = isSuper ? { isActive: true } : { isActive: true, department: req.user.department };

    // Get all active students populated with their current semester and department
    const students = await Student.find(deptFilter)
      .populate('semesterID')
      .populate('department');

    const allSemesters = await Semester.find({});
    
    // Create a map to easily find next semester by name
    const semesterMap = {};
    allSemesters.forEach(s => {
      semesterMap[s.semesterName] = s._id;
    });

    const bachelorDepts = ['BCA', 'BBA', 'BCOM'];
    const masterDepts = ['MCA', 'MBA', 'MCOM'];

    let upgraded = 0;
    let graduated = 0;
    let errors = 0;

    for (const student of students) {
      try {
        if (!student.semesterID || !student.department) continue;
        
        const currentSemStr = student.semesterID.semesterName; // e.g. "Semester 1"
        const currentSemNum = parseInt(currentSemStr.replace('Semester ', ''), 10);
        const deptName = student.department.name.toUpperCase().replace(/[\s.]/g, '');

        let isGraduating = false;
        if (bachelorDepts.some(d => deptName.includes(d)) && currentSemNum === 6) {
          isGraduating = true;
        } else if (masterDepts.some(d => deptName.includes(d)) && currentSemNum === 4) {
          isGraduating = true;
        }

        if (isGraduating) {
          const Fee = require('../models/Fee');
          const { sendEmail } = require('../utils/email');

          // Check if there are any unpaid fees for this student
          const unpaidFees = await Fee.countDocuments({ student: student._id, paid: false });

          if (unpaidFees > 0) {
            student.degreeStatus = 'Pending Dues';
            student.isActive = false;
            
            // Send email
            try {
              await sendEmail(
                student.email,
                `[Campus Flow] Action Required: Degree Pending Dues`,
                `<h2>Hello ${student.name},</h2>
                 <p>Congratulations on completing your final semester!</p>
                 <p>However, you currently have unpaid semester fees. Your degree status is marked as <strong>Pending Dues</strong>.</p>
                 <p>Please clear your pending dues to officially complete your graduation process.</p>`
              );
            } catch (err) { console.error('Email send failed:', err.message); }

          } else {
            student.degreeStatus = 'Completed';
            student.isActive = false;

            // Send email
            try {
              await sendEmail(
                student.email,
                `[Campus Flow] Congratulations on Graduating!`,
                `<h2>Hello ${student.name},</h2>
                 <p>Congratulations! You have successfully completed your degree program with all dues cleared.</p>
                 <p>Your status has been updated to <strong>Completed (Alumni)</strong>. We wish you the best for your future endeavors!</p>`
              );
            } catch (err) { console.error('Email send failed:', err.message); }
          }

          await student.save();
          graduated++;
        } else {
          // Upgrade to next semester
          const nextSemNum = currentSemNum + 1;
          const nextSemName = `Semester ${nextSemNum}`;
          const nextSemId = semesterMap[nextSemName];
          
          if (nextSemId) {
            student.semesterID = nextSemId;
            await student.save();
            upgraded++;
          } else {
            console.warn(`Next semester ${nextSemName} not found in DB for student ${student.enrollmentNum}`);
          }
        }
      } catch (err) {
        console.error(`Error upgrading student ${student._id}:`, err);
        errors++;
      }
    }

    res.json({
      success: true,
      message: 'Semester upgrade complete',
      data: { upgraded, graduated, errors }
    });

  } catch (error) {
    console.error('Semester upgrade error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get dashboard analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin only)
router.get('/analytics', protect, authorize('admin'), async (req, res) => {
  try {
    const Department = require('../models/Department');
    
    // RBAC: Scope filter
    const isSuper = req.user.role === 'SuperAdmin';
    const deptFilter = isSuper ? {} : { department: req.user.department };

    // 1. Total active students
    const totalActive = await Student.countDocuments({ ...deptFilter, isActive: true });
    
    // 2. Admissions per year
    const yearlyAdmissions = await Student.aggregate([
      { $match: { admissionYear: { $exists: true, $ne: null }, ...deptFilter } },
      { $group: { _id: '$admissionYear', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const admissionsData = yearlyAdmissions.map(y => ({ year: y._id.toString(), count: y.count }));

    // 3. Students per department
    const deptAdmissions = await Student.aggregate([
      { $match: { isActive: true, ...deptFilter } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    
    // 3b. Professors per department
    const deptProfessors = await Professor.aggregate([
      { $match: { isActive: true, ...deptFilter } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    
    const depts = await Department.find();
    
    const deptData = deptAdmissions.map(d => {
      const dept = depts.find(dp => dp._id.toString() === d._id.toString());
      return { department: dept ? dept.name : 'Unknown', count: d.count };
    });
    
    const profDeptData = deptProfessors.map(d => {
      const dept = depts.find(dp => dp._id.toString() === d._id.toString());
      return { department: dept ? dept.name : 'Unknown', count: d.count };
    });

    // 4. Graduated/Inactive students
    const totalInactive = await Student.countDocuments({ ...deptFilter, isActive: false });

    res.json({
      success: true,
      data: {
        totalActive,
        totalInactive,
        admissionsData,
        deptData,
        profDeptData
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const { generateEnrollmentNumber } = require('../utils/enrollmentGenerator');

// ========== Auto‑generate a unique 12‑digit enrollment number ==========
// @route   GET /api/admin/students/next-enrollment
// @access  Private (Admin only)
router.get('/students/next-enrollment', protect, authorize('admin'), async (req, res) => {
  try {
    const { year, department } = req.query;
    if (!year || !department) {
      return res.status(400).json({ success: false, message: 'Year and department are required' });
    }

    const enrollmentNum = await generateEnrollmentNumber(year, department);
    res.json({ success: true, enrollmentNum });
  } catch (error) {
    console.error('Enrollment generation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate enrollment number' });
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

// @desc    Bulk create students
// @route   POST /api/admin/students/bulk
// @access  Private (Admin only)
router.post('/students/bulk', protect, authorize('admin'), async (req, res) => {
  try {
    const studentsData = req.body.students; // Expecting an array of student objects
    if (!studentsData || !Array.isArray(studentsData)) {
      return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of students.' });
    }

    const results = {
      total: studentsData.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < studentsData.length; i++) {
      let data = studentsData[i];
      try {
        // Validation: email and contact are minimum required to check
        if (!data.email || !data.name || !data.department || !data.semesterID || !data.admissionYear) {
           throw new Error('Missing required fields: email, name, department, semesterID, or admissionYear');
        }

        // Check if student with same email or aadhar exists
        const query = [{ email: data.email }];
        if (data.aadharNumber) query.push({ aadharNumber: data.aadharNumber });
        
        const existingStudent = await Student.findOne({ $or: query });
        if (existingStudent) {
          throw new Error(`Student with email ${data.email} or Aadhar already exists.`);
        }

        // Auto-generate enrollment number if not provided
        if (!data.enrollmentNum) {
          data.enrollmentNum = await generateEnrollmentNumber(data.admissionYear.toString(), data.department);
        }

        // Default password if not provided
        if (!data.password) {
           // First 4 letters of the name (uppercase) + Birth Year
           const namePrefix = data.name.replace(/\s+/g, '').substring(0, 4).toUpperCase();
           const birthYear = data.dob ? data.dob.split('-')[0] : new Date().getFullYear().toString();
           data.password = `${namePrefix}${birthYear}`;
        }

        // Auto-assign division based on count (max 60 per division)
        if (!data.division) {
          const currentCount = await Student.countDocuments({
            department: data.department,
            semesterID: data.semesterID,
            isActive: true
          });
          if (currentCount < 60) data.division = 'A';
          else if (currentCount < 120) data.division = 'B';
          else data.division = 'C';
        }

        const student = new Student(data);
        await student.save();
        results.success += 1;

      } catch (err) {
        results.failed += 1;
        results.errors.push({ row: i + 1, email: data.email, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `Bulk upload complete. Success: ${results.success}, Failed: ${results.failed}`,
      results
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
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
      // Bachelor qualification fields
      bachelorDegree,
      bachelorSpecialization,
      bachelorBoard,
      bachelorAdmitNumber,
      bachelorPassingYear,
      bachelorCGPA,
      bachelorGrade,
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
    let finalPassword = password;
    if (!finalPassword) {
      const namePrefix = name.replace(/\s+/g, '').substring(0, 4).toUpperCase();
      const birthYear = dob ? dob.split('-')[0] : new Date().getFullYear().toString();
      finalPassword = `${namePrefix}${birthYear}`;
    }
  
    // Create student
    const student = new Student({
      division: req.body.division || 'A',
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
      password: finalPassword,
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
      // Bachelor
      bachelorDegree,
      bachelorSpecialization,
      bachelorBoard,
      bachelorAdmitNumber,
      bachelorPassingYear,
      bachelorCGPA,
      bachelorGrade,
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

// ========== Admin Management (SuperAdmin Only) ==========

// @desc    Get all admins
// @route   GET /api/admin/admins
// @access  Private (SuperAdmin only)
router.get('/admins', protect, authorizeSuperAdmin, async (req, res) => {
  try {
    const admins = await Admin.find().populate('department', 'name code').select('-password');
    res.json({ success: true, data: admins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a new admin
// @route   POST /api/admin/admins
// @access  Private (SuperAdmin only)
router.post('/admins', protect, authorizeSuperAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, department } = req.body;
    
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) return res.status(400).json({ success: false, message: 'Admin email already exists' });

    const newAdmin = await Admin.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role: role || 'DepartmentAdmin',
      department: department || null
    });

    res.json({ success: true, message: 'Admin created successfully', data: newAdmin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;