// routes/professor.routes.js
const express = require("express");
const router = express.Router();
const Professor = require("../models/Professor");
const mongoose = require("mongoose");

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

module.exports = router;