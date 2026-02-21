const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true
  },
  manufacturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  productCategory: {
    type: String,
    enum: ['medicine', 'food', 'beverage', 'cosmetics', 'other'],
    required: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: 1
  },
  codesGenerated: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'archived'],
    default: 'pending'
  },
  description: {
    type: String,
    trim: true
  },
  manufacturingDate: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
batchSchema.index({ manufacturer: 1, createdAt: -1 });
batchSchema.index({ batchId: 1 });

module.exports = mongoose.model('Batch', batchSchema);
