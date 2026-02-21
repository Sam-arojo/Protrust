const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    index: true
  },
  manufacturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  qrCodeUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'verified', 'flagged', 'expired'],
    default: 'active',
    index: true
  },
  verifiedAt: {
    type: Date
  },
  verificationMethod: {
    type: String,
    enum: ['sms', 'qr', null],
    default: null
  },
  verificationCount: {
    type: Number,
    default: 0
  },
  lastVerificationAttempt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient batch queries
codeSchema.index({ batchId: 1, status: 1 });
codeSchema.index({ manufacturerId: 1, status: 1 });

// Update timestamp on save
codeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Code = mongoose.model('Code', codeSchema);

module.exports = Code;
