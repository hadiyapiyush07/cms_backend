const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    // ========== Core Identification ==========
    enrollmentNum: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    aadharNumber: {
      type: String,
      sparse: true,                     // allow null/undefined but enforce uniqueness if present
      unique: true,
      trim: true,
    },
    password: { 
      type: String, 
      required: true 
    },
    
    // ========== Personal Details ==========
    name: {
      type: String,
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      default: null,
    },
    nationality: {
      type: String,
      default: 'Indian',
    },
    religion: {
      type: String,
      trim: true,
    },
    // ========== Reservation / Category ==========
    category: {
      type: String,
      required: true,
      // enum: ['GEN', 'OBC', 'SC', 'ST', 'EWS'],
    },
    caste: {
      type: String,
      default: '',
    },
    subcaste: {
      type: String,
      default: '',
    },
    // ========== Contact & Address ==========
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    alternateContact: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    // ========== Parent / Guardian Information (Embedded) ==========
    fatherName: {
      type: String,
      trim: true,
    },
    motherName: {
      type: String,
      trim: true,
    },
    guardianName: {
      type: String,
      trim: true,                        // if different from parents
    },
    parentContact: {
      type: String,
      trim: true,
    },
    parentEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    parentOccupation: {
      type: String,
      trim: true,
    },
    // ========== Academic Details =========
    admissionYear: {
      type: Number,                       // e.g., 2024 – can be derived from enrollmentNum
    },
    batch: {
      type: String,                        // e.g., "2024-2027"
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    semesterID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
    },
    currentYear: {
      type: Number,                        // 1,2,3,4 (if program has years)
      min: 1,
      max: 3,
    },
    
    // ========== System Fields ==========
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    // ========== References to Other Collections ==========
    // Documents – stored in separate collection (see below)
    // Education History – stored in separate collection
    // Fee Records – stored in separate collection
    // etc.
  },
  {
    timestamps: true,
  }
);

// Plain password comparison (direct string match – consider hashing in production!)
studentSchema.methods.comparePassword = function (candidate) {
  return candidate === this.password;
};

const Student = mongoose.model('Student', studentSchema);
module.exports = Student;