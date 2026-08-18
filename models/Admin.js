const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  phone: {
    type: String,
    default: ''
  },
  lastLogin: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['SuperAdmin', 'DepartmentAdmin'],
    default: 'SuperAdmin'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

AdminSchema.methods.comparePassword = async function(candidatePassword) {
return candidatePassword === this.password;
};

const Admin = mongoose.model('Admin', AdminSchema);
// const Admin = mongoose.model('Admin', AdminSchema, 'admin');
module.exports = Admin;