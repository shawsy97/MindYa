const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
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
  gender: {
    type: String,
    enum: ['男生', '女生', '其他']
  },
  age: {
    type: String
  },
  grade: {
    type: String,
    enum: ['小学', '初中', '高中']
  },
  scaleResult: {
    type: String
  },
  modelResult: {
    type: String
  },
  gameResult: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Profile', profileSchema);