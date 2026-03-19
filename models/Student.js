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
      sparse: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
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

    // ========== Parent / Guardian Information ==========
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
      trim: true,
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

    // ========== Academic Details ==========
    admissionYear: {
      type: Number,
    },
    batch: {
      type: String,
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
      type: Number,
      min: 1,
      max: 3,
    },

    // ========== 10th Qualification Details ==========
    tenthBoard: {
      type: String,
      trim: true,
      default: '',
    },
    tenthAdmitNumber: {
      type: String,
      trim: true,
      default: '',
    },
    tenthPassingYear: {
      type: Number,
      default: null,
    },
    tenthMarksObtained: {
      type: Number,
      default: null,
    },

    // ========== 12th Qualification Details ==========
    twelfthBoard: {
      type: String,
      trim: true,
      default: '',
    },
    twelfthAdmitNumber: {
      type: String,
      trim: true,
      default: '',
    },
    twelfthPassingYear: {
      type: Number,
      default: null,
    },
    twelfthMarksObtained: {
      type: Number,
      default: null,
    },
    twelfthTotalMarks: {
      type: Number,
      default: null,
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