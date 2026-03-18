// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const {
  studentLogin,
  professorLogin,
  adminLogin,
  forgotPassword,
  verifyOtp,
  resetPassword,
  logout,
  changePassword
} = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

// Debug middleware for this router
router.use((req, res, next) => {
  console.log(` Auth Route: ${req.method} ${req.originalUrl}`);
  next();
});

// Test route to check if auth routes are working
router.get("/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Auth routes are working",
    timestamp: new Date().toISOString()
  });
});

// Public routes
router.post("/student/login", studentLogin);
router.post("/professor/login", professorLogin);
router.post("/admin/login", adminLogin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
router.post("/change-password", protect, changePassword);

module.exports = router;