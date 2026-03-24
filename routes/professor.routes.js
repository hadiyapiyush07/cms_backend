// routes/professor.routes.js
const express = require("express");
const router = express.Router();
const Professor = require("../models/Professor");
const mongoose = require("mongoose");

// ===== ADDED FOR ATTENDANCE SYSTEM =====
const { protect, authorize } = require("../middleware/auth.middleware");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Semester = require("../models/Semester");
// =======================================

// ➕ CREATE PROFESSOR
router.post("/", async (req, res) => {
  try {
    console.log("📝 Creating professor with data:", req.body);
    
    const { name, email, contactNumber, password, department, coursesTaught, qualification, experience, specialization, joiningDate } = req.body;
    
    // Validate required fields
    if (!name || !email || !contactNumber || !password || !department) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, email, contactNumber, password, department"
      });
    }

    // Check if professor already exists
    const existingProfessor = await Professor.findOne({ 
      $or: [{ email }, { contactNumber }] 
    });
    
    if (existingProfessor) {
      return res.status(400).json({
        success: false,
        message: "Professor with this email or contact number already exists"
      });
    }

    // Validate department ObjectId
    if (!mongoose.Types.ObjectId.isValid(department)) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID format"
      });
    }

    // Create professor
    const professor = await Professor.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      contactNumber: contactNumber.trim(),
      password: password,
      department,
      coursesTaught: coursesTaught || [],
      qualification: qualification || "",
      experience: experience ? parseInt(experience) : 0,
      specialization: specialization || "",
      joiningDate: joiningDate || new Date(),
      isActive: true
    });

    const populatedProfessor = await Professor.findById(professor._id)
      .populate('department', 'name code')
      .populate('coursesTaught', 'name code');

    res.status(201).json({
      success: true,
      data: populatedProfessor,
      message: "Professor created successfully"
    });
    
  } catch (err) {
    console.error("❌ Error creating professor:", err);
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`
      });
    }
    
    res.status(500).json({
      success: false,
      message: err.message || "Error creating professor"
    });
  }
});

// 📥 GET ALL PROFESSORS (with filters)
router.get("/", async (req, res) => {
  try {
    const { department, search, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (department && mongoose.Types.ObjectId.isValid(department)) {
      query.department = department;
    }
    
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [professors, total] = await Promise.all([
      Professor.find(query)
        .populate('department', 'name code')
        .populate('coursesTaught', 'name code')
        .select('-password')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Professor.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: professors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Error fetching professors:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// 📥 GET PROFESSOR BY ID
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid professor ID"
      });
    }
    
    const professor = await Professor.findById(req.params.id)
      .populate('department', 'name code')
      .populate('coursesTaught', 'name code')
      .select('-password');
    
    if (!professor) {
      return res.status(404).json({
        success: false,
        message: "Professor not found"
      });
    }
    
    res.json({
      success: true,
      data: professor
    });
  } catch (err) {
    console.error("Error fetching professor:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✏️ UPDATE PROFESSOR - FIXED: Don't require password for updates
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid professor ID"
      });
    }
    
    const { name, email, contactNumber, department, coursesTaught, qualification, experience, specialization, joiningDate, isActive, password } = req.body;
    
    // Build update object with only provided fields
    const updateData = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber.trim();
    if (department !== undefined) updateData.department = department;
    if (coursesTaught !== undefined) updateData.coursesTaught = coursesTaught;
    if (qualification !== undefined) updateData.qualification = qualification;
    if (experience !== undefined) updateData.experience = parseInt(experience) || 0;
    if (specialization !== undefined) updateData.specialization = specialization;
    if (joiningDate !== undefined) updateData.joiningDate = joiningDate;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Only update password if provided (not empty)
    if (password && password.trim() !== '') {
      updateData.password = password;
    }
    
    console.log("Updating professor with data:", updateData);
    
    const professor = await Professor.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('department', 'name code')
      .populate('coursesTaught', 'name code')
      .select('-password');
    
    if (!professor) {
      return res.status(404).json({
        success: false,
        message: "Professor not found"
      });
    }
    
    res.json({
      success: true,
      data: professor,
      message: "Professor updated successfully"
    });
  } catch (err) {
    console.error("Error updating professor:", err);
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`
      });
    }
    
    res.status(500).json({
      success: false,
      message: err.message || "Error updating professor"
    });
  }
});

// 🗑️ DELETE PROFESSOR
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid professor ID"
      });
    }
    
    const professor = await Professor.findByIdAndDelete(req.params.id);
    
    if (!professor) {
      return res.status(404).json({
        success: false,
        message: "Professor not found"
      });
    }
    
    res.json({
      success: true,
      message: "Professor deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting professor:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// 👤 GET PROFESSOR PROFILE BY EMAIL
router.get('/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('🔍 BACKEND: Fetching professor with email:', email);
    
    const professor = await Professor.findOne({ email })
      .select('-password')
      .populate('department', 'name code description')
      .populate('coursesTaught', 'name code credits semester description');
    
    if (!professor) {
      return res.status(404).json({
        success: false,
        message: 'Professor not found'
      });
    }
    
    res.json({
      success: true,
      data: professor
    });
    
  } catch (error) {
    console.error('❌ BACKEND: Profile API error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ========== UPDATED ROUTES =========

// POST mark attendance for a specific subject on a given date
router.post('/attendance/mark', protect, authorize('professor'), async (req, res) => {
  try {
    const { subjectId, date, attendance } = req.body;
    if (!subjectId || !date || !attendance || !attendance.length) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const professor = await Professor.findById(req.user._id);
    if (!professor.coursesTaught.includes(subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }
    const dateStr = date; // already YYYY-MM-DD
    const operations = attendance.map(entry => ({
      updateOne: {
        filter: { date: dateStr, subject: subjectId, student: entry.studentId },
        update: { $set: { status: entry.status, recordedBy: req.user._id } },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(operations);
    res.json({ success: true, message: 'Attendance saved successfully' });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET attendance statistics for a semester in a given month/year
router.get('/attendance/statistics', protect, authorize('professor'), async (req, res) => {
  try {
    const { semesterId, year, month } = req.query;
    if (!semesterId || !year || !month) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }
    const professorId = req.user._id;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    // Get the semester document to find its number
    const semesterDoc = await Semester.findById(semesterId);
    if (!semesterDoc) {
      return res.json({ success: true, data: { totalSessions: 0, students: [] } });
    }
    const match = semesterDoc.semesterName.match(/\d+/);
    if (!match) return res.json({ success: true, data: { totalSessions: 0, students: [] } });
    const semNum = parseInt(match[0]);

    // Get subjects taught by professor in this semester (by number)
    const professor = await Professor.findById(professorId).populate('coursesTaught');
    const subjects = professor.coursesTaught.filter(s => s.semester === semNum);
    const subjectIds = subjects.map(s => s._id);
    if (subjectIds.length === 0) {
      return res.json({ success: true, data: { totalSessions: 0, students: [] } });
    }

    // Total sessions: distinct (date, subject) where attendance exists
    const sessions = await Attendance.aggregate([
      { $match: { subject: { $in: subjectIds }, date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { date: '$date', subject: '$subject' } } },
      { $group: { _id: null, totalSessions: { $sum: 1 } } },
    ]);
    const totalSessions = sessions.length > 0 ? sessions[0].totalSessions : 0;

    // Get unique departments from the subjects
    const departments = [...new Set(subjects.map(s => s.department.toString()))];
    // Get all students in those departments and the given semester
    const students = await Student.find({
      department: { $in: departments },
      semesterID: semesterId,
    }).select('name enrollmentNum email');

    // Count present days per student
    const attendanceStats = await Attendance.aggregate([
      { $match: { subject: { $in: subjectIds }, date: { $gte: startDate, $lte: endDate }, status: 'present' } },
      { $group: { _id: '$student', attended: { $sum: 1 } } },
    ]);
    const statsMap = new Map();
    attendanceStats.forEach(stat => {
      statsMap.set(stat._id.toString(), stat.attended);
    });

    const studentStats = students.map(student => ({
      _id: student._id,
      name: student.name,
      enrollmentNum: student.enrollmentNum,
      email: student.email,
      attended: statsMap.get(student._id.toString()) || 0,
      percentage: totalSessions === 0 ? 0 : ((statsMap.get(student._id.toString()) || 0) / totalSessions) * 100,
    }));
    res.json({
      success: true,
      data: { totalSessions, students: studentStats },
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/attendance/subjects/:subjectId/students', protect, authorize('professor'), async (req, res) => {
  try {
    const { subjectId } = req.params;
    const subject = await Subject.findById(subjectId).populate('department semester');
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    // Verify professor teaches this subject
    const professor = await Professor.findById(req.user._id);
    if (!professor.coursesTaught.includes(subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }
    // Use the semester ObjectId directly (since Subject model stores semester as ObjectId)
    const semesterId = subject.semester?._id || subject.semester;
    if (!semesterId) {
      return res.json({ success: true, data: [] });
    }
    const students = await Student.find({
      department: subject.department._id,
      semesterID: semesterId,
    }).select('name enrollmentNum email');
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET attendance for a subject on a specific date (professor report)
router.get('/attendance/subject/:subjectId/date/:date', protect, authorize('professor'), async (req, res) => {
  try {
    const { subjectId, date } = req.params;
    const subject = await Subject.findById(subjectId).populate('department semester');
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    // Verify professor teaches this subject
    const professor = await Professor.findById(req.user._id);
    if (!professor.coursesTaught.includes(subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }
    // Get all students in the subject's department and semester
    const students = await Student.find({
      department: subject.department._id,
      semesterID: subject.semester._id,
    }).select('name enrollmentNum email');
    // Fetch attendance records for this subject and date
    const attendanceRecords = await Attendance.find({
      subject: subjectId,
      date: date, // assuming date is stored as string YYYY-MM-DD
      student: { $in: students.map(s => s._id) }
    });
    // Map status to each student
    const attendanceMap = new Map();
    attendanceRecords.forEach(rec => {
      attendanceMap.set(rec.student.toString(), rec.status);
    });
    const result = students.map(student => ({
      _id: student._id,
      name: student.name,
      enrollmentNum: student.enrollmentNum,
      status: attendanceMap.get(student._id.toString()) || 'absent'
    }));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// NEW: GET all subjects taught by the professor (for direct subject listing)
router.get('/attendance/subjects', protect, authorize('professor'), async (req, res) => {
  try {
    const professorId = req.user._id;
    const professor = await Professor.findById(professorId).populate({
      path: 'coursesTaught',
      populate: { path: 'department semester', select: 'name code semesterName' }
    });
    if (!professor) {
      return res.status(404).json({ success: false, message: 'Professor not found' });
    }
    res.json({ success: true, data: professor.coursesTaught });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;