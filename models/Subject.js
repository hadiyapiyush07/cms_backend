const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Subject name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Subject code cannot exceed 10 characters'],
    match: [/^[A-Z0-9-.,]+$/, 'Subject code can only contain uppercase letters and numbers']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required'],
    index: true
  },
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',     
    required: [true, 'Semester is required'],
    index: true
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, { 
  timestamps: true 
});

// Additional compound indexes for common queries
subjectSchema.index({ department: 1, semester: 1 });
subjectSchema.index({ department: 1, isActive: 1 });
subjectSchema.index({ name: 'text', code: 'text' });

// Static methods
subjectSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId, isActive: true })
    .sort({ semester: 1, name: 1 });
};

subjectSchema.statics.findByDepartmentAndSemester = function(departmentId, semester) {
  return this.find({ department: departmentId, semester, isActive: true })
    .sort({ name: 1 });
    
};

// Instance methods
subjectSchema.methods.getFullInfo = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    semester: this.semester,
    credits: this.credits
  };
};

module.exports = mongoose.model('Subject', subjectSchema);