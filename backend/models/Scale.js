const mongoose = require('mongoose');

const scaleSchema = new mongoose.Schema({
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
  scaleId: {
    type: String,
    required: true
  },
  scaleName: {
    type: String,
    required: true
  },
  answers: [{
    questionId: String,
    answer: mongoose.Schema.Types.Mixed
  }],
  totalScore: {
    type: Number
  },
  resultAnalysis: {
    type: String
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Scale', scaleSchema);