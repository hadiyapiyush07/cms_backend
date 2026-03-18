// controllers/auth.controller.js
const Student = require("../models/Student");
const Professor = require("../models/Professor");
const Admin = require("../models/Admin");
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const PasswordReset = require('../models/PasswordReset');
const { sendOtpEmail } = require('../services/emailService');
const jwt = require("jsonwebtoken");

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || "campusflow_secret_key",
    { expiresIn: "7d" }
  );
};

const studentLogin = async (req, res) => {
  try {
    console.log(" Student login attempt received");
    console.log("Request body:", req.body);
    
    const { enrollmentId, password } = req.body;

    if (!enrollmentId || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide enrollment ID and password"
      });
    }

    // Find student by enrollment number
    // const student = await Student.findOne({ enrollmentNum: enrollmentId });

    const student = await Student.findOne({ enrollmentNum: enrollmentId })
  .select("+password");

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Invalid enrollment number or password"
      });
    }

    console.log(` Student found: ${student.name}`);

    // Direct plain text comparison
    // const isPasswordValid = student.comparePassword(password);
    const isPasswordValid = await student.comparePassword(password);
    console.log(" Password match result:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid enrollment number or password"
      });
    }

    // Update last login
    student.lastLogin = new Date();
    await student.save();

    const token = generateToken(student._id, "student");

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
          id: student._id,
          enrollmentNum: student.enrollmentNum,
          name: student.name,
          email: student.email,
          role: "student",
          dob: student.dob,
          contactNumber: student.contactNumber,
          semesterID: student.semesterID,
          lastLogin: student.lastLogin,
          profilePicture: student.profilePicture,
          batch: student.batch,
          department: student.department,      
          category: student.category,
          caste: student.caste,
          subcaste: student.subcaste,
          gender: student.gender,
          address: student.address,
          city: student.city,
          state: student.state,
          pincode: student.pincode,
          isActive: student.isActive,
        },
    });

  } catch (error) {
    console.error(" Student login error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again."
    });
  }
};


// @desc    Professor Login
// @route   POST /api/auth/professor/login
// @access  Public
const professorLogin = async (req, res) => {
  try {
    console.log(" Professor login attempt received");
    console.log("Request body:", req.body);
    
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    // Find professor by email
    const professor = await Professor.findOne({ email: email.toLowerCase() })
      .select("+password");

    if (!professor) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    console.log(` Professor found: ${professor.name}`);

    // Check if account is active
    if (!professor.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact administration."
      });
    }

    // Verify password
    const isPasswordValid = await professor.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Update last login
    professor.lastLogin = new Date();
    await professor.save();

    // Generate token
    const token = generateToken(professor._id, "professor");

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: professor._id,
        email: professor.email,
        name: professor.name,
        department: professor.department,
        designation: professor.designation,
        contactNumber: professor.contactNumber,
        lastLogin: professor.lastLogin,
        profilePicture: professor.profilePicture,
        isActive: professor.isActive,
        contactNumber: professor.contactNumber,
        joiningDate: professor.joiningDate,
        role: "professor"
      }
    });

  } catch (error) {
    console.error(" Professor login error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again."
    });
  }
};

// @desc    Admin Login
// @route   POST /api/auth/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    console.log(" Admin login attempt received");
    console.log("Request body:", req.body);
    
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password");
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    console.log(` Admin found: ${admin.name}`);

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Generate token
    const token = generateToken(admin._id, "admin");

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          lastLogin: admin.lastLogin,
          isActive: admin.isActive,
          createdAt: admin.createdAt
        }
    });

  } catch (error) {
    console.error(" Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again."
    });
  }
};

// @desc    Request password reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Search user across all three collections
    let user = await Student.findOne({ email: email.toLowerCase() });
    let role = user ? 'student' : null;
    if (!user) {
      user = await Professor.findOne({ email: email.toLowerCase() });
      role = user ? 'professor' : null;
    }
    if (!user) {
      user = await Admin.findOne({ email: email.toLowerCase() });
      role = user ? 'admin' : null;
    }

    // Always return generic message
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, an OTP has been sent.'
      });
    }

    // Generate OTP and hash
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Remove any existing OTP records for this email
    await PasswordReset.deleteMany({ email: email.toLowerCase() });

    // Save new OTP record with userId
    await PasswordReset.create({
      email: email.toLowerCase(),
      role,
      userId: user._id,
      otpHash,
      expiresAt
    });

    // Send email (catch error silently)
    try {
      await sendOtpEmail(email, otp);
      console.log(`OTP for ${email}: ${otp}`); // for development only
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, an OTP has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Verify OTP and issue reset token
// @route   POST /api/auth/verify-otp
// @access  Public

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    const record = await PasswordReset.findOne({
      email: email.toLowerCase(),
      expiresAt: { $gt: new Date() }
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
    }

    // Limit attempts
    if (record.attempts >= 5) {
      await PasswordReset.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'Too many attempts. Request new OTP.' });
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (!isValid) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Generate reset token (valid 15 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    record.resetToken = resetToken;
    record.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes ( 1000 -> milliseconds )
    record.attempts = 0;
    await record.save();

    res.json({ success: true, message: 'OTP verified', resetToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public

const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const record = await PasswordReset.findOne({
      email: email.toLowerCase(),
      resetToken,
      resetTokenExpires: { $gt: new Date() }
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    // Find user by ID and role
    let Model;
    if (record.role === 'student') Model = Student;
    else if (record.role === 'professor') Model = Professor;
    else if (record.role === 'admin') Model = Admin;

    const user = await Model.findById(record.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Delete all reset records for this email
    await PasswordReset.deleteMany({ email: email.toLowerCase() });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error during logout"
    });
  }
};


// @desc    Change Password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;  // from protect middleware
    const role = req.userRole;     // from protect middleware

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current password and new password"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long"
      });
    }

    // Select model based on role
    let Model;
    if (role === "student") {
      Model = Student;
    } else if (role === "professor") {
      Model = Professor;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid user role"
      });
    }

    // Find user and include password field
    const user = await Model.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error(" Change password error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again."
    });
  }
};

module.exports = {
  studentLogin,
  professorLogin,
  adminLogin,
  forgotPassword,
  verifyOtp,
  resetPassword,
  logout,
  changePassword,
};