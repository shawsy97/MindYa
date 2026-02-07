const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  taskId: {
    type: String,
    required: true
  },
  taskName: {
    type: String,
    required: true
  },
  completionTime: {
    type: Number // 完成时间（秒）
  },
  performance: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);