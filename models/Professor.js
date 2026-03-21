const mongoose = require('mongoose');

const professorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },

  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    unique: true,
    match: [/^[0-9]{10}$/, 'Contact number must be 10 digits']
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },

  // ✅ FOREIGN KEY (Department)
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: [true, 'Department is required']
  },

  qualification: {
    type: String,
    trim: true
  },

  experience: {
    type: Number,
    default: 0,
    min: [0, 'Experience cannot be negative']
  },

  specialization: {
    type: String,
    trim: true
  },

  joiningDate: {
    type: Date,
    default: Date.now
  },

  // ✅ FOREIGN KEY (Subjects)
  coursesTaught: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject"
  }],

  profilePicture: {
    type: String,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  },

  lastLogin: {
    type: Date,
    default: null
  }

}, { 
  timestamps: true 
});

// ✅ Virtual for full profile info
professorSchema.virtual('fullProfile').get(function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    department: this.department,
    qualification: this.qualification,
    specialization: this.specialization,
    experience: this.experience
  };
});

// ✅ Method to compare password (consider using bcrypt in production)
professorSchema.methods.comparePassword = function(candidatePassword) {
  // In production, use bcrypt.compare()
  return candidatePassword === this.password;
};

// ✅ Method to sanitize professor data (remove sensitive info)
professorSchema.methods.toJSON = function() {
  const professor = this.toObject();
  delete professor.password;
  return professor;
};

// ✅ Static method to find professors by department
professorSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId })
    .populate('department', 'name')
    .populate('coursesTaught', 'name code');
};

// ✅ Static method to find active professors
professorSchema.statics.findActive = function() {
  return this.find({ isActive: true })
    .populate('department', 'name')
    .populate('coursesTaught', 'name code');
};

module.exports = mongoose.model('Professor', professorSchema);