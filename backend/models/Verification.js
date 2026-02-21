const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    enum: ['sms', 'qr'],
    required: true
  },
  result: {
    type: String,
    enum: ['success', 'invalid', 'duplicate', 'error'],
    required: true
  },
  phoneNumber: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String
  },
  location: {
    country: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for analytics queries
verificationSchema.index({ timestamp: -1 });
verificationSchema.index({ method: 1, result: 1 });
verificationSchema.index({ code: 1, timestamp: -1 });

module.exports = mongoose.model('Verification', verificationSchema);
