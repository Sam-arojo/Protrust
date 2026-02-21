const crypto = require('crypto');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const Code = require('../models/Code');
const Batch = require('../models/Batch');

/**
 * Generate a unique, cryptographically secure verification code
 * @param {number} length - Length of the code (default: 12)
 * @returns {string} - Unique alphanumeric code
 */
async function generateUniqueCode(length = 12) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  
  // Step 1: Generate random code
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += characters[bytes[i] % characters.length];
  }
  
  // Step 2: Check if code already exists in database
  const existingCode = await Code.findOne({ code });
  
  // Step 3: If exists, recursively generate new code
  if (existingCode) {
    return generateUniqueCode(length);
  }
  
  return code;
}

/**
 * Generate QR code image for a verification code
 * @param {string} code - The verification code
 * @param {string} batchId - Batch ID for organizing files
 * @returns {string} - Path to the QR code image
 */
async function generateQRCode(code, batchId) {
  // Step 1: Create verification URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const verificationUrl = `${baseUrl}/api/public/verify?code=${code}`;
  
  // Step 2: Create directory for QR codes if it doesn't exist
  const qrDir = path.join(__dirname, '../../public/qrcodes', batchId);
  await fs.mkdir(qrDir, { recursive: true });
  
  // Step 3: Generate QR code filename
  const filename = `${code}.png`;
  const filepath = path.join(qrDir, filename);
  
  // Step 4: Generate QR code image
  await QRCode.toFile(filepath, verificationUrl, {
    errorCorrectionLevel: 'H',
    type: 'png',
    quality: 0.95,
    margin: 1,
    width: 300
  });
  
  // Step 5: Return relative URL path
  return `/public/qrcodes/${batchId}/${filename}`;
}

/**
 * Main workflow: Generate codes and QR codes for a batch
 * @param {Object} batchData - Batch information
 * @param {string} batchData.batchId - MongoDB ObjectId of the batch
 * @param {string} batchData.manufacturerId - MongoDB ObjectId of manufacturer
 * @param {number} batchData.quantity - Number of codes to generate
 * @returns {Object} - Generation results
 */
async function generateCodesForBatch(batchData) {
  const { batchId, manufacturerId, quantity } = batchData;
  
  console.log(`Starting code generation for batch ${batchId}...`);
  
  const generatedCodes = [];
  const errors = [];
  
  // Step 1: Validate batch exists
  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }
  
  // Step 2: Generate codes one by one (procedural approach)
  for (let i = 0; i < quantity; i++) {
    try {
      // Step 2a: Generate unique code
      const code = await generateUniqueCode(12);
      
      // Step 2b: Generate QR code
      const qrCodeUrl = await generateQRCode(code, batch.batchId);
      
      // Step 2c: Create code record in database
      const codeRecord = await Code.create({
        code,
        batchId,
        manufacturerId,
        qrCodeUrl,
        status: 'active'
      });
      
      generatedCodes.push({
        code: codeRecord.code,
        qrCodeUrl: codeRecord.qrCodeUrl
      });
      
      // Log progress every 100 codes
      if ((i + 1) % 100 === 0) {
        console.log(`Generated ${i + 1}/${quantity} codes...`);
      }
      
    } catch (error) {
      console.error(`Error generating code ${i + 1}:`, error.message);
      errors.push({ index: i + 1, error: error.message });
    }
  }
  
  // Step 3: Update batch with generation stats
  await Batch.findByIdAndUpdate(batchId, {
    codesGenerated: generatedCodes.length,
    updatedAt: Date.now()
  });
  
  console.log(`✅ Successfully generated ${generatedCodes.length} codes for batch ${batchId}`);
  
  // Step 4: Return results
  return {
    success: true,
    batchId: batch.batchId,
    totalRequested: quantity,
    totalGenerated: generatedCodes.length,
    codes: generatedCodes,
    errors: errors.length > 0 ? errors : null
  };
}

/**
 * Export codes to CSV format
 * @param {string} batchId - MongoDB ObjectId of the batch
 * @returns {string} - CSV content
 */
async function exportCodesToCSV(batchId) {
  // Step 1: Fetch batch information
  const batch = await Batch.findById(batchId).populate('manufacturerId', 'companyName');
  if (!batch) {
    throw new Error('Batch not found');
  }
  
  // Step 2: Fetch all codes for this batch
  const codes = await Code.find({ batchId }).select('code qrCodeUrl status createdAt');
  
  // Step 3: Build CSV header
  let csv = 'Code,QR Code URL,Status,Generated Date,Product,Batch ID\n';
  
  // Step 4: Add each code as a row
  for (const codeRecord of codes) {
    const row = [
      codeRecord.code,
      `${process.env.BASE_URL || 'http://localhost:5000'}${codeRecord.qrCodeUrl}`,
      codeRecord.status,
      codeRecord.createdAt.toISOString(),
      batch.productName,
      batch.batchId
    ].join(',');
    
    csv += row + '\n';
  }
  
  return csv;
}

module.exports = {
  generateUniqueCode,
  generateQRCode,
  generateCodesForBatch,
  exportCodesToCSV
};
