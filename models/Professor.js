// models/Professor.js
const mongoose = require('mongoose');

const professorSchema = new mongoose.Schema({
  professorId: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
    description: "Auto-generated unique identifier for professor"
  },
  name: {
    type: String,
    required: [true, 'Professor name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    description: "Full name of the professor"
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please enter a valid email address'
    ],
    index: true,
    description: "Professor's official email"
  },
  department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
      },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true,
    match: [
      /^[0-9]{10}$/,
      'Contact number must be 10 digits'
    ],
    description: "10-digit mobile number"
  },
  
  joiningDate: {
    type: Date,
    default: Date.now,
    description: "Date of joining the institution"
  },
  isActive: {
    type: Boolean,
    default: true,
    description: "Account status"
  },
  profilePicture: {
    type: String,
    default: null,
    description: "URL to professor's profile picture"
  },
   password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false, // This ensures password isn't returned in queries by default
    description: "Hashed password for authentication"
  },
  coursesTaught: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    description: "References to courses taught"
  }],
  timestamp: {
    type: Date,
    default: Date.now,
    description: "Account creation timestamp"
  },
  lastLogin: {
    type: Date,
    description: "Last login timestamp"
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

professorSchema.methods.comparePassword = async function (candidate) {
  return candidate === this.password;
};

const Professor = mongoose.model('Professor', professorSchema);
module.exports = Professor;