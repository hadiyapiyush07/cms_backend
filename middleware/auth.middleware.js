const jwt = require("jsonwebtoken"); // Import JWT library for token verification
const Student = require("../models/Student"); // Student model
const Professor = require("../models/Professor"); // Professor model
const Admin = require("../models/Admin"); // Admin model

const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

     // If no token → user is not logged in
    if (!token) {
      console.log("❌ No token provided");
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route"
      });
    }

      // Verify token using secret key → decode payload (id, role)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "campusflow_secret_key");
    console.log("✅ Decoded token:", decoded); // Log role and id for debugging

    // Get user based on role
    // Find user based on role from decoded token
    let user;
    if (decoded.role === "student") {
      user = await Student.findById(decoded.id);
    } else if (decoded.role === "professor") {
      user = await Professor.findById(decoded.id);
    } else if (decoded.role === "admin") {
      user = await Admin.findById(decoded.id).select("-password");
    }

    // If user not found in DB → invalid token or deleted user
    if (!user) {
      console.log(` User not found for role ${decoded.role} with id ${decoded.id}`);
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Check isActive only if the field exists and is explicitly false
    // Check if account is deactivated
    // For students, isActive: false means they are Alumni/Graduated, so they should still have access.
    // For professors/admins, isActive: false might mean they are banned/deactivated.
    if (decoded.role !== 'student' && user.isActive !== undefined && user.isActive === false) {
      console.log(`❌ Account deactivated for user ${user.email}`);
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated"
      });
    }

    req.user = user;   // Attach user data to request
    req.userRole = decoded.role;  // Attach user data to request
    next(); // Move to next middleware or route

  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }
    next(error);  // Pass other errors to global handler
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user is authenticated (protect must run first)
    if (!req.userRole) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    if (!roles.includes(req.userRole)) {
      console.log(`❌ Unauthorized role: ${req.userRole}, required: ${roles.join(", ")}`);
      return res.status(403).json({
        success: false,
        message: `User role ${req.userRole} is not authorized to access this route`
      });
    }
    next();
  };
};

// SuperAdmin specific authorization
const authorizeSuperAdmin = (req, res, next) => {
  if (!req.userRole || req.userRole !== 'admin') {
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  }
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({
      success: false,
      message: `SuperAdmin role required to access this route`
    });
  }
  next();
};

module.exports = { protect, authorize, authorizeSuperAdmin };  // Export middlewares