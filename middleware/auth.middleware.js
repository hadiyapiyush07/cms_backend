const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Professor = require("../models/Professor");
const Admin = require("../models/Admin");

const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      console.log("❌ No token provided");
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route"
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "campusflow_secret_key");
    console.log("✅ Decoded token:", decoded); // Log role and id for debugging

    // Get user based on role
    let user;
    if (decoded.role === "student") {
      user = await Student.findById(decoded.id);
    } else if (decoded.role === "professor") {
      user = await Professor.findById(decoded.id);
    } else if (decoded.role === "admin") {
      user = await Admin.findById(decoded.id).select("-password");
    }

    if (!user) {
      console.log(`❌ User not found for role ${decoded.role} with id ${decoded.id}`);
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Check isActive only if the field exists and is explicitly false
    if (user.isActive !== undefined && user.isActive === false) {
      console.log(`❌ Account deactivated for user ${user.email}`);
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated"
      });
    }

    req.user = user;
    req.userRole = decoded.role;
    next();

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
    next(error);
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
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

module.exports = { protect, authorize };