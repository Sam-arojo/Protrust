const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  manufacturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  qrCodeUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'verified', 'flagged'],
    default: 'active',
    index: true
  },
  verifiedAt: {
    type: Date
  },
  verificationMethod: {
    type: String,
    enum: ['sms', 'qr'],
    default: null
  },
  verificationCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
codeSchema.index({ batch: 1, status: 1 });
codeSchema.index({ manufacturer: 1, createdAt: -1 });

module.exports = mongoose.model('Code', codeSchema);
