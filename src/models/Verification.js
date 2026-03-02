const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    index: true
  },
  codeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Code'
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  manufacturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  method: {
    type: String,
    enum: ['sms', 'qr'],
    required: true,
    index: true
  },
  result: {
    type: String,
    enum: ['success', 'duplicate', 'invalid', 'expired'],
    required: true,
    index: true
  },
  // SMS-specific fields
  senderPhone: {
    type: String,
    select: false // Anonymized, only for admin
  },
  smsMessageId: {
    type: String
  },
  // QR-specific fields
  ipAddress: {
    type: String,
    select: false // Anonymized, only for admin
  },
  userAgent: {
    type: String
  },
  // Geolocation (if available)
  location: {
    country: String,
    region: String,
    city: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  responseMessage: {
    type: String
  }
});

// Compound indexes for analytics
verificationSchema.index({ timestamp: -1, result: 1 });
verificationSchema.index({ batchId: 1, timestamp: -1 });
verificationSchema.index({ manufacturerId: 1, timestamp: -1 });
verificationSchema.index({ method: 1, timestamp: -1 });

const Verification = mongoose.model('Verification', verificationSchema);

module.exports = Verification;
