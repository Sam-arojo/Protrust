const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: [true, 'Batch ID is required'],
    unique: true,
    trim: true
  },
  manufacturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  productDescription: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  codesGenerated: {
    type: Number,
    default: 0
  },
  codesVerified: {
    type: Number,
    default: 0
  },
  codesFlagged: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  manufacturingDate: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  metadata: {
    type: Map,
    of: String
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

// Update timestamp on save
batchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
batchSchema.index({ manufacturerId: 1, createdAt: -1 });
batchSchema.index({ batchId: 1 });

const Batch = mongoose.model('Batch', batchSchema);

module.exports = Batch;
