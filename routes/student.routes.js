// routes/student.routes.js
const { protect, authorize } = require('../middleware/auth.middleware');
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Student = require("../models/Student");
const Semester = require("../models/Semester");
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
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
  } `8`
});

// GET student attendance summary
// router.get('/student/attendance', protect, authorize('student'), async (req, res) => {
//   try {
//     const studentId = req.user._id;
//     const student = await Student.findById(studentId).populate('department semesterID');
//     if (!student) {
//       return res.status(404).json({ success: false, message: 'Student not found' });
//     }

//     // Get all subjects for the student's department and semester
//     const subjects = await Subject.find({
//       department: student.department._id,
//       semester: student.semesterID._id,
//       isActive: true
//     }).select('name code');

//     // Calculate attendance per subject
//     const subjectStats = await Promise.all(subjects.map(async (subject) => {
//       const totalSessions = await Attendance.distinct('date', { subject: subject._id }).then(dates => dates.length);
//       const attended = await Attendance.countDocuments({ subject: subject._id, student: studentId, status: 'present' });
//       return {
//         subject: subject.name,
//         code: subject.code,
//         totalSessions,
//         attended,
//         percentage: totalSessions === 0 ? 0 : (attended / totalSessions) * 100
//       };
//     }));

//     // Overall attendance (across all subjects)
//     const allSessions = await Attendance.aggregate([
//       { $match: { student: studentId } },
//       { $group: { _id: { date: '$date', subject: '$subject' } } },
//       { $count: 'total' }
//     ]);
//     const totalSessionsAll = allSessions.length ? allSessions[0].total : 0;
//     const attendedAll = await Attendance.countDocuments({ student: studentId, status: 'present' });
//     const overallPercentage = totalSessionsAll === 0 ? 0 : (attendedAll / totalSessionsAll) * 100;

//     res.json({
//       success: true,
//       data: {
//         subjects: subjectStats,
//         overall: {
//           totalSessions: totalSessionsAll,
//           attended: attendedAll,
//           percentage: overallPercentage
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching student attendance:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

router.get('/student/attendance', protect, authorize('student'), async (req, res) => {
  try {
    const studentId = req.user._id;
    const student = await Student.findById(studentId)
      .populate('department semesterID');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // 1. Get all subjects for the student's current semester and department
    const subjects = await Subject.find({
      department: student.department._id,
      semester: student.semesterID._id,
      isActive: true
    }).select('name code');

    const subjectIds = subjects.map(s => s._id);

    // 2. Calculate attendance per subject (only these subjects)
    const subjectStats = await Promise.all(subjects.map(async (subject) => {
      // Distinct dates for this subject (sessions)
      const totalSessions = await Attendance.distinct('date', {
        subject: subject._id
      }).then(dates => dates.length);
      
      const attended = await Attendance.countDocuments({
        subject: subject._id,
        student: studentId,
        status: 'present'
      });
      
      return {
        _id: subject._id,
        subject: subject.name,
        code: subject.code,
        totalSessions,
        attended,
        percentage: totalSessions === 0 ? 0 : (attended / totalSessions) * 100
      };
    }));

    // 3. Overall attendance – only for subjects in current semester
    let totalSessionsAll = 0;
    let attendedAll = 0;

    if (subjectIds.length > 0) {
      // Count distinct (date, subject) pairs for current semester subjects
      const allSessions = await Attendance.aggregate([
        {
          $match: {
            student: studentId,
            subject: { $in: subjectIds }
          }
        },
        {
          $group: {
            _id: { date: '$date', subject: '$subject' }
          }
        },
        { $count: 'total' }
      ]);
      totalSessionsAll = allSessions.length ? allSessions[0].total : 0;

      // Count present records for current semester subjects
      attendedAll = await Attendance.countDocuments({
        student: studentId,
        subject: { $in: subjectIds },
        status: 'present'
      });
    }

    const overallPercentage = totalSessionsAll === 0 ? 0 : (attendedAll / totalSessionsAll) * 100;

    res.json({
      success: true,
      data: {
        subjects: subjectStats,
        overall: {
          totalSessions: totalSessionsAll,
          attended: attendedAll,
          percentage: overallPercentage
        }
      }
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET day-by-day attendance for a student in a specific subject
router.get('/student/attendance/subject/:subjectId/detail', protect, authorize('student'), async (req, res) => {
  try {
    const studentId = req.user._id;
    const { subjectId } = req.params;

    // Fetch all attendance records for this student in this subject, sorted by date
    const records = await Attendance.find({
      subject: subjectId,
      student: studentId,
    }).select('date status').sort({ date: 1 });

    // Also get all distinct dates that had a session (to include dates student was absent but session existed)
    const allSessionDates = await Attendance.distinct('date', { subject: subjectId });
    allSessionDates.sort();

    // Build a map of student's records
    const recordMap = new Map();
    records.forEach(r => { recordMap.set(r.date, r.status); });

    // Return one entry per session date
    const detail = allSessionDates.map(date => ({
      date,
      status: recordMap.get(date) || 'absent',
    }));

    res.json({ success: true, data: detail });
  } catch (error) {
    console.error('Error fetching subject detail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;