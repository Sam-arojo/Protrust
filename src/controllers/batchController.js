const Batch = require('../models/Batch');
const { generateCodesForBatch, exportCodesToCSV } = require('../workflows/codeGenerationWorkflow');

/**
 * Create new batch
 * POST /api/batches
 */
async function createBatch(req, res) {
  try {
    const { batchId, productName, productDescription, quantity, manufacturingDate, expiryDate } = req.body;
    
    // Step 1: Validate required fields
    if (!batchId || !productName || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide batchId, productName, and quantity'
      });
    }
    
    // Step 2: Check if batch ID already exists for this manufacturer
    const existingBatch = await Batch.findOne({ 
      batchId, 
      manufacturerId: req.user._id 
    });
    
    if (existingBatch) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID already exists'
      });
    }
    
    // Step 3: Create batch
    const batch = await Batch.create({
      batchId,
      manufacturerId: req.user._id,
      productName,
      productDescription,
      quantity,
      manufacturingDate,
      expiryDate
    });
    
    // Step 4: Generate codes asynchronously (don't wait)
    generateCodesForBatch({
      batchId: batch._id,
      manufacturerId: req.user._id,
      quantity
    }).catch(err => {
      console.error('Error in background code generation:', err);
    });
    
    res.status(201).json({
      success: true,
      message: 'Batch created successfully. Codes are being generated in the background.',
      batch: {
        id: batch._id,
        batchId: batch.batchId,
        productName: batch.productName,
        quantity: batch.quantity,
        status: batch.status
      }
    });
    
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating batch',
      error: error.message
    });
  }
}

/**
 * Get all batches for logged-in manufacturer
 * GET /api/batches
 */
async function getBatches(req, res) {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    // Step 1: Build query
    const query = { manufacturerId: req.user._id };
    if (status) {
      query.status = status;
    }
    
    // Step 2: Execute query with pagination
    const batches = await Batch.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Step 3: Get total count
    const count = await Batch.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: batches.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      batches
    });
    
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching batches'
    });
  }
}

/**
 * Get single batch by ID
 * GET /api/batches/:id
 */
async function getBatch(req, res) {
  try {
    const batch = await Batch.findOne({
      _id: req.params.id,
      manufacturerId: req.user._id
    });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }
    
    res.status(200).json({
      success: true,
      batch
    });
    
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching batch'
    });
  }
}

/**
 * Export batch codes as CSV
 * GET /api/batches/:id/export
 */
async function exportBatch(req, res) {
  try {
    // Step 1: Verify batch belongs to user
    const batch = await Batch.findOne({
      _id: req.params.id,
      manufacturerId: req.user._id
    });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }
    
    // Step 2: Generate CSV
    const csv = await exportCodesToCSV(batch._id);
    
    // Step 3: Send CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=batch_${batch.batchId}_codes.csv`);
    res.status(200).send(csv);
    
  } catch (error) {
    console.error('Export batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting batch'
    });
  }
}

/**
 * Update batch status
 * PATCH /api/batches/:id
 */
async function updateBatch(req, res) {
  try {
    const { status } = req.body;
    
    const batch = await Batch.findOneAndUpdate(
      { _id: req.params.id, manufacturerId: req.user._id },
      { status, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Batch updated successfully',
      batch
    });
    
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating batch'
    });
  }
}

module.exports = {
  createBatch,
  getBatches,
  getBatch,
  exportBatch,
  updateBatch
};
