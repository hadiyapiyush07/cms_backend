const express = require("express");
const router = express.Router();
const Subject = require("../models/Subject");
const mongoose = require("mongoose");
const { protect } = require('../middleware/auth.middleware');

// ✅ Get subjects by department - FIXED VERSION
router.get("/", protect, async (req, res) => {
  try {
    const { department } = req.query;

    console.log("=".repeat(50));
    console.log("🔍 SUBJECT FETCH DEBUG");
    console.log("=".repeat(50));
    console.log("Requested department ID:", department);
    
    if (!department) {
      return res.status(400).json({ 
        success: false,
        message: "Department ID is required" 
      });
    }

    // Convert department ID to string for comparison
    const deptIdString = department.toString();
    
    // Method 1: Query with string comparison (MOST RELIABLE)
    // This will find subjects regardless of whether department is stored as String or ObjectId
    const subjects = await Subject.find({
      $expr: {
        $eq: [
          { $toString: "$department" },
          deptIdString
        ]
      }
    }).populate('department', 'name code').lean();

    console.log(`✅ Found ${subjects.length} subjects using string comparison`);
    
    // If no subjects found with string comparison, try ObjectId comparison
    if (subjects.length === 0 && mongoose.Types.ObjectId.isValid(deptIdString)) {
      const objectId = new mongoose.Types.ObjectId(deptIdString);
      const subjects2 = await Subject.find({ department: objectId })
        .populate('department', 'name code')
        .lean();
      
      console.log(`Found ${subjects2.length} subjects using ObjectId comparison`);
      
      if (subjects2.length > 0) {
        return res.json({
          success: true,
          data: subjects2,
          count: subjects2.length,
          department: department
        });
      }
    }
    
    res.json({
      success: true,
      data: subjects,
      count: subjects.length,
      department: department
    });
    
  } catch (err) {
    console.error("❌ Error fetching subjects:", err);
    res.status(500).json({ 
      success: false,
      message: err.message
    });
  }
});

// ✅ Debug endpoint to see all subjects
router.get("/debug/all", protect, async (req, res) => {
  try {
    console.log("🔍 Debug endpoint called");
    
    // Get all subjects with department populated
    const subjects = await Subject.find()
      .populate('department', 'name code')
      .lean();
    
    // Get all departments
    const Department = mongoose.model('Department');
    const departments = await Department.find().lean();
    
    // Get counts
    const totalSubjects = await Subject.countDocuments();
    const totalDepartments = await Department.countDocuments();
    
    // Format subjects for easier viewing
    const formattedSubjects = subjects.map(s => ({
      id: s._id,
      name: s.name,
      code: s.code,
      semester: s.semester,
      departmentId: s.department?._id || s.department,
      departmentName: s.department?.name || 'Unknown',
      departmentIdType: typeof (s.department?._id || s.department)
    }));
    
    console.log(`Debug: Found ${totalSubjects} subjects and ${totalDepartments} departments`);
    
    res.json({
      success: true,
      stats: {
        totalSubjects,
        totalDepartments
      },
      subjects: formattedSubjects,
      departments: departments.map(d => ({
        id: d._id,
        name: d.name,
        code: d.code
      }))
    });
  } catch (err) {
    console.error("Debug endpoint error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// ✅ Check specific department with detailed debugging
router.get("/debug/check/:deptId", protect, async (req, res) => {
  try {
    const { deptId } = req.params;
    
    console.log("🔍 Checking department:", deptId);
    
    // Get all subjects
    const allSubjects = await Subject.find().lean();
    
    // Method 1: String comparison
    const deptIdString = deptId.toString();
    const stringMatch = allSubjects.filter(subject => {
      const subjectDept = subject.department ? subject.department.toString() : '';
      return subjectDept === deptIdString;
    });
    
    // Method 2: ObjectId comparison
    let objectIdMatch = [];
    if (mongoose.Types.ObjectId.isValid(deptIdString)) {
      const objectId = new mongoose.Types.ObjectId(deptIdString);
      objectIdMatch = allSubjects.filter(subject => {
        const subjectDept = subject.department ? subject.department.toString() : '';
        return subjectDept === objectId.toString();
      });
    }
    
    // Get sample of what's in the database
    const sampleSubjects = allSubjects.slice(0, 5).map(s => ({
      name: s.name,
      code: s.code,
      department: s.department,
      departmentType: typeof s.department,
      departmentString: s.department ? s.department.toString() : null
    }));
    
    res.json({
      success: true,
      departmentId: deptId,
      departmentIdString: deptIdString,
      counts: {
        asString: stringMatch.length,
        asObjectId: objectIdMatch.length
      },
      sampleSubjects: sampleSubjects,
      allSubjectsCount: allSubjects.length,
      note: "If counts are 0 but subjects exist, check the department ID format in your subjects collection"
    });
  } catch (err) {
    console.error("Check endpoint error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;