const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  action: {
    type: String,
    required: true
  },
  detail: {
    type: mongoose.Schema.Types.Mixed
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 添加索引以提高查询性能
logSchema.index({ createdAt: -1 });
logSchema.index({ userId: 1, createdAt: -1 });
logSchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model('Log', logSchema);