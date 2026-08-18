const express = require("express");
const router = express.Router();
const Subject = require("../models/Subject");
const Semester = require("../models/Semester");
const Department = require("../models/Department");
const { protect, authorize } = require('../middleware/auth.middleware');

// Helper: numeric semester → semesterName
const getSemesterName = (num) => `Semester ${num}`;

// ---------------------------------------------------------------------
// GET subjects by department & optional semester
// ---------------------------------------------------------------------
router.get("/", protect, async (req, res) => {
  try {
    let { department, semester } = req.query;
    
    // RBAC: If Normal Admin, force their department
    if (req.userRole === 'admin' && req.user.role === 'DepartmentAdmin') {
      department = req.user.department;
    }

    if (!department) {
      return res.status(400).json({ success: false, message: "Department ID required" });
    }

    const deptIdString = department.toString();
    let filter = {
      $expr: { $eq: [{ $toString: "$department" }, deptIdString] }
    };

    if (semester) {
      const semNum = parseInt(semester);
      const semesterDoc = await Semester.findOne({ semesterName: getSemesterName(semNum) });
      if (!semesterDoc) {
        return res.json({ success: true, data: [], count: 0 });
      }
      filter.semester = semesterDoc._id;
    }

    let subjects = await Subject.find(filter)
      .populate('department', 'name code')
      .populate('semester', 'semesterName')
      .lean();

    subjects = subjects.map(sub => ({
      ...sub,
      semester: sub.semester ? parseInt(sub.semester.semesterName.split(' ')[1]) : null
    }));

    res.json({ success: true, data: subjects, count: subjects.length });
  } catch (err) {
    console.error("GET subjects error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------
// GET next available subject code (e.g., BCA-101T)
// ---------------------------------------------------------------------
router.get("/next-code", protect, authorize("admin"), async (req, res) => {
  try {
    const { department, semester, type } = req.query;
    if (!department || !semester || !type) {
      return res.status(400).json({ success: false, message: "Missing parameters" });
    }

    // Get department code (e.g., "BCA")
    const deptDoc = await Department.findById(department);
    if (!deptDoc) {
      return res.status(400).json({ success: false, message: "Invalid department" });
    }
    const deptCode = deptDoc.code;

    // Convert numeric semester (1-6) to semester name and get the semester document
    const semNum = parseInt(semester);
    const semesterDoc = await Semester.findOne({ semesterName: getSemesterName(semNum) });
    if (!semesterDoc) {
      return res.status(400).json({ success: false, message: "Invalid semester" });
    }

    const suffix = type === "theory" ? "T" : "P";
    // Pattern: ^BCA-1\d{2}T$  (hyphen included)
    const pattern = `^${deptCode}-${semNum}\\d{2}${suffix}$`;
    const regex = new RegExp(pattern);

    const subjects = await Subject.find({ code: { $regex: regex } }).lean();
    let maxSeq = 0;
    subjects.forEach(sub => {
      const match = sub.code.match(new RegExp(`${deptCode}-${semNum}(\\d{2})${suffix}`));
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });

    const nextSeq = maxSeq + 1;
    const nextCode = `${deptCode}-${semNum}${nextSeq.toString().padStart(2, "0")}${suffix}`;

    res.json({ success: true, code: nextCode });
  } catch (err) {
    console.error("Next-code error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------
// ADD subject (admin only)
// ---------------------------------------------------------------------
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, code, department, semester } = req.body;

    if (!name || !code || !department || !semester) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const semNum = parseInt(semester);
    const semesterDoc = await Semester.findOne({ semesterName: getSemesterName(semNum) });
    if (!semesterDoc) {
      return res.status(400).json({ success: false, message: `Semester ${semNum} does not exist` });
    }

    // Check duplicates
    const existing = await Subject.findOne({ $or: [{ name }, { code }] });
    if (existing) {
      const field = existing.name === name ? 'name' : 'code';
      return res.status(400).json({ success: false, message: `${field} already exists` });
    }

    const newSubject = new Subject({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      department,
      semester: semesterDoc._id
    });

    await newSubject.save();

    const populated = await Subject.findById(newSubject._id)
      .populate('department', 'name code')
      .populate('semester', 'semesterName')
      .lean();

    populated.semester = populated.semester ? parseInt(populated.semester.semesterName.split(' ')[1]) : null;

    res.status(201).json({ success: true, data: populated, message: "Subject added" });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ success: false, message: `${field} already exists` });
    }
    console.error("POST subject error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------
// DELETE subject (admin only)
// ---------------------------------------------------------------------
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const deleted = await Subject.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Subject not found" });
    res.json({ success: true, message: "Subject deleted" });
  } catch (err) {
    console.error("DELETE subject error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;