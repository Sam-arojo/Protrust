const Batch = require('../models/Batch');
const Code = require('../models/Code');
const { executeCodeGenerationWorkflow } = require('../workflows/codeGenerationWorkflow');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Create new batch and generate codes
 * @route   POST /api/batches
 * @access  Private
 */
const createBatch = async (req, res) => {
  try {
    const { 
      productName, 
      productCategory, 
      quantity, 
      description,
      manufacturingDate,
      expiryDate
    } = req.body;
    
    // Step 1: Validate input
    if (!productName || !productCategory || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Please provide product name, category, and quantity'
      });
    }
    
    if (quantity < 1 || quantity > 100000) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be between 1 and 100,000'
      });
    }
    
    // Step 2: Prepare batch data
    const batchData = {
      productName,
      productCategory,
      quantity: parseInt(quantity),
      description,
      manufacturingDate,
      expiryDate
    };
    
    // Step 3: Execute code generation workflow
    console.log('🚀 Starting code generation workflow...');
    const result = await executeCodeGenerationWorkflow(batchData, req.user._id);
    
    // Step 4: Return success response
    res.status(201).json({
      success: true,
      message: `Successfully generated ${result.codesGenerated} verification codes`,
      data: {
        batch: result.batch,
        codesGenerated: result.codesGenerated
      }
    });
    
  } catch (error) {
    console.error('Batch creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create batch. Please try again.'
    });
  }
};

/**
 * @desc    Get all batches for current user
 * @route   GET /api/batches
 * @access  Private
 */
const getBatches = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = { manufacturer: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    // Execute query with pagination
    const batches = await Batch.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Batch.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: batches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
    
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve batches'
    });
  }
};

/**
 * @desc    Get single batch by ID
 * @route   GET /api/batches/:id
 * @access  Private
 */
const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.id,
      manufacturer: req.user._id
    });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    // Get verification statistics
    const totalCodes = await Code.countDocuments({ batch: batch._id });
    const verifiedCodes = await Code.countDocuments({ 
      batch: batch._id, 
      status: 'verified' 
    });
    const flaggedCodes = await Code.countDocuments({ 
      batch: batch._id, 
      status: 'flagged' 
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...batch.toObject(),
        stats: {
          totalCodes,
          verifiedCodes,
          flaggedCodes,
          activeC: totalCodes - verifiedCodes - flaggedCodes
        }
      }
    });
    
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve batch'
    });
  }
};

/**
 * @desc    Get codes for a batch
 * @route   GET /api/batches/:id/codes
 * @access  Private
 */
const getBatchCodes = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    
    // Verify batch belongs to user
    const batch = await Batch.findOne({
      _id: req.params.id,
      manufacturer: req.user._id
    });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    // Build query
    const query = { batch: batch._id };
    if (status) {
      query.status = status;
    }
    
    // Get codes
    const codes = await Code.find(query)
      .select('code qrCodeUrl status verifiedAt verificationMethod')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Code.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: codes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
    
  } catch (error) {
    console.error('Get batch codes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve codes'
    });
  }
};

/**
 * @desc    Export batch codes as PDF/ZIP
 * @route   GET /api/batches/:id/export
 * @access  Private
 */
const exportBatchCodes = async (req, res) => {
  try {
    const { format = 'pdf' } = req.query;
    
    // Verify batch belongs to user
    const batch = await Batch.findOne({
      _id: req.params.id,
      manufacturer: req.user._id
    });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    // Get all codes for this batch
    const codes = await Code.find({ batch: batch._id })
      .select('code qrCodeUrl status');
    
    if (format === 'pdf') {
      // Generate PDF with codes and QR codes
      await generatePDFExport(res, batch, codes);
    } else if (format === 'zip') {
      // Generate ZIP with QR code images
      await generateZIPExport(res, batch, codes);
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid export format. Use pdf or zip'
      });
    }
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export codes'
    });
  }
};

/**
 * @desc    Archive a batch
 * @route   PATCH /api/batches/:id/archive
 * @access  Private
 */
const archiveBatch = async (req, res) => {
  try {
    const batch = await Batch.findOneAndUpdate(
      { _id: req.params.id, manufacturer: req.user._id },
      { status: 'archived' },
      { new: true }
    );
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: batch
    });
    
  } catch (error) {
    console.error('Archive batch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive batch'
    });
  }
};

/**
 * HELPER: Generate PDF export
 */
async function generatePDFExport(res, batch, codes) {
  const doc = new PDFDocument({ margin: 50 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${batch.batchId}.pdf"`);
  
  doc.pipe(res);
  
  // Title
  doc.fontSize(20).text(`QualityChek Verification Codes`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Batch: ${batch.batchId}`);
  doc.text(`Product: ${batch.productName}`);
  doc.text(`Total Codes: ${codes.length}`);
  doc.text(`Generated: ${batch.createdAt.toLocaleDateString()}`);
  doc.moveDown(2);
  
  // Codes table
  codes.forEach((code, index) => {
    if (index > 0 && index % 20 === 0) {
      doc.addPage();
    }
    
    doc.fontSize(10).text(`${index + 1}. ${code.code}`, { continued: true });
    doc.text(`   Status: ${code.status}`, { align: 'right' });
  });
  
  doc.end();
}

/**
 * HELPER: Generate ZIP export with QR codes
 */
async function generateZIPExport(res, batch, codes) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${batch.batchId}-qrcodes.zip"`);
  
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  
  // Add QR code files
  for (const code of codes) {
    if (code.qrCodeUrl) {
      const filepath = path.join(__dirname, '../public', code.qrCodeUrl);
      if (fs.existsSync(filepath)) {
        archive.file(filepath, { name: `${code.code}.png` });
      }
    }
  }
  
  await archive.finalize();
}

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
  getBatchCodes,
  exportBatchCodes,
  archiveBatch
};
