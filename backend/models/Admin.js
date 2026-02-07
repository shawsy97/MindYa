const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['teacher', 'admin', 'super_admin'],
    default: 'teacher'
  },
  permissions: [{
    type: String
  }],
  school: {
    type: String
  },
  department: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Admin', adminSchema);