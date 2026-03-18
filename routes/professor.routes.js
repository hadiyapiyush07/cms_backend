// routes/professor.routes.js
const express = require("express");
const router = express.Router();
const Professor = require("../models/Professor");
const Department = require("../models/Department");


// GET professor profile by email
router.get('/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('🔍 BACKEND: Fetching professor with email:', email);
    
    const professor = await Professor.findOne({ email })
      .select('-password') // Exclude password
      .populate('department', 'name code'); 
    
    if (!professor) {
      return res.status(404).json({
        success: false,
        message: 'Professor not found'
      });
    }
    
    console.log(' BACKEND: Professor found:', professor.name);
    console.log(' BACKEND: Full data being sent:', {
      _id: professor._id,
      name: professor.name,
      email: professor.email,
      department: professor.department,
      contactNumber: professor.contactNumber,
      joiningDate: professor.joiningDate,
      isActive: professor.isActive,
      lastLogin: professor.lastLogin,
      profilePicture: professor.profilePicture
    });
    
    res.json({
      success: true,
      data: professor  // Send the whole mongoose document
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