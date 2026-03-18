// routes/student.routes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Student = require("../models/Student");
const Semester = require("../models/Semester");
const Department = require("../models/Department");

// GET student profile by enrollment number
router.get('/student/profile/:enrollmentNum', async (req, res) => {
  try {
    const { enrollmentNum } = req.params;
    
    console.log('🔍 Fetching profile for enrollment:', enrollmentNum);
    
    // Student find karo aur semester populate karo
    const student = await Student.findOne({ enrollmentNum: enrollmentNum })
      .select('-password')  
      .populate({
        path: 'semesterID',
        model: Semester,
        select: 'semesterName academicYear isActive'
      })
        .populate({
      path: 'department',
      model: 'Department',           // or require the Department model
      select: 'name code'             // only fetch what you need
    });
      
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Student data ko object mein convert karo
    const studentData = student.toObject();
    
    // Semester data ko format karo
    if (studentData.semesterID) {
      // Populated data hai to
      studentData.semesterName = studentData.semesterID.semesterName;
      studentData.academicYear = studentData.semesterID.academicYear;
      studentData.currentSemester = studentData.semesterID.semesterName;  
      
    } else {
      studentData.currentSemester = 'Not Assigned';
      studentData.semesterName = 'Not Assigned';
    }
    
    console.log(' Student found:', {
      name: studentData.name,
      enrollment: studentData.enrollmentNum,
      semester: studentData.currentSemester
    });
    
    res.json({
      success: true,
      data: studentData
    });
    
  } catch (error) {
    console.error('❌ Profile API error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;