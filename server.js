const dns = require('dns');
// Force Node.js to use Google's DNS to bypass local ISP blocking the Atlas SRV query!
dns.setServers(['8.8.8.8', '8.8.4.4']);

// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

//  CORS configuration
//  CORS configuration (development)
app.use(cors({
  origin: true, // Allows any origin (useful for development)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/campusflow")
  .then(() => console.log(" MongoDB Connected Successfully"))
  .catch(err => console.log(" MongoDB Connection Error:", err));

// ✅ Import models
require("./models/Student");
require("./models/Professor");
require("./models/Admin");     
require("./models/PasswordReset");  
require("./models/Department");  
require('./models/Fee'); 
require('./models/PaymentOrder');
const Semester = require("./models/Semester");

//  Import routes
const authRoutes = require("./routes/auth.routes");
const studentRoutes = require("./routes/student.routes");
const professorRoutes = require("./routes/professor.routes");
const adminRoutes = require("./routes/admin.routes");
const uploadRoutes = require("./routes/upload.routes");
const eventsRoutes = require("./routes/events.routes");
const semesterRoutes = require("./routes/semester.routes");
const SubjectRoutes = require("./routes/subject.routes");
const departmentRoutes = require("./routes/department.routes");
const notificationRoutes = require('./routes/notification.routes');
const syllabusRoutes = require('./routes/syllabus.routes');
const assignmentRoutes = require('./routes/assignment.routes');
const path = require('path');
const subjectRoutes = require("./routes/subject.routes");
const feeRoutes = require('./routes/fee.routes');

//  Test route
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running correctly",
    timestamp: new Date().toISOString()
  });
});

//  Base route
app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "Campus Flow API is running",
    endpoints: {
      studentLogin: "/api/auth/student/login",
      professorLogin: "/api/auth/professor/login",
      adminLogin: "/api/auth/admin/login",           
      studentProfile: "/api/student/profile/:enrollmentNum",  
      professorProfile: "/api/professor/profile/:email",
      adminDashboard: "/api/admin/dashboard",        
      test: "/api/test"
    }
  });
});

//  Debug middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

//  Use routes
app.use("/api/auth", authRoutes);
app.use("/api", studentRoutes);
app.use("/api/professor", professorRoutes);
app.use("/api/admin", adminRoutes);                   
app.use("/api/upload", uploadRoutes);
app.use("/api/events", eventsRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use("/api/subjects",SubjectRoutes);
app.use('/api/fees', feeRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static('uploads'));
app.use('/api/subjects',subjectRoutes);



// Error handling middleware
app.use((err, req, res, next) => {
  console.error(" Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.toString() : {}
  });
});

// 404 handler
app.use((req, res) => {
  console.log(` 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.url} not found`,
    availableRoutes: {
      studentLogin: "POST /api/auth/student/login",
      professorLogin: "POST /api/auth/professor/login",
      adminLogin: "POST /api/auth/admin/login",
      studentProfile: "GET /api/student/profile/:enrollmentNum",  
      professorProfile: "GET /api/professor/profile/:email",
      adminDashboard: "GET /api/admin/dashboard",
      test: "GET /api/test"
    }
  });
});

const { startCronJobs } = require('./utils/cronJobs');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server Running on port ${PORT}`);
  startCronJobs();
  console.log(` Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(` Student Login: http://localhost:${PORT}/api/auth/student/login`);
  console.log(` Professor Login: http://localhost:${PORT}/api/auth/professor/login`);
  console.log(` Admin Login: http://localhost:${PORT}/api/auth/admin/login`);
  console.log(` Student Profile: http://localhost:${PORT}/api/student/profile/202400200001`);
  console.log(` Professor Profile: http://localhost:${PORT}/api/professor/profile/rajesh.kumar@college.edu`);
  console.log(` Admin Dashboard: http://localhost:${PORT}/api/admin/dashboard`);
});