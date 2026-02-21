const crypto = require('crypto');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const Code = require('../models/Code');
const Batch = require('../models/Batch');

/**
 * STEP 1: Generate a single unique verification code
 * Uses cryptographically secure random generation
 */
function generateSingleCode(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  const bytes = crypto.randomBytes(length);
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  
  return code;
}

/**
 * STEP 2: Check if code already exists in database
 */
async function isCodeUnique(code) {
  const existingCode = await Code.findOne({ code });
  return !existingCode;
}

/**
 * STEP 3: Generate unique codes for a batch
 * Ensures no duplicates
 */
async function generateUniqueCodes(quantity, length = 12) {
  const codes = [];
  const maxAttempts = quantity * 10; // Safety limit
  let attempts = 0;
  
  while (codes.length < quantity && attempts < maxAttempts) {
    const code = generateSingleCode(length);
    
    // Check uniqueness against both array and database
    if (!codes.includes(code) && await isCodeUnique(code)) {
      codes.push(code);
    }
    
    attempts++;
  }
  
  if (codes.length < quantity) {
    throw new Error('Failed to generate required number of unique codes');
  }
  
  return codes;
}

/**
 * STEP 4: Generate QR code image for a verification code
 */
async function generateQRCodeImage(code) {
  try {
    // Ensure public/qrcodes directory exists
    const qrDir = path.join(__dirname, '../public/qrcodes');
    await fs.mkdir(qrDir, { recursive: true });
    
    // Create verification URL
    const verifyUrl = `${process.env.CLIENT_URL}/verify?code=${code}`;
    
    // Generate QR code filename
    const filename = `${code}.png`;
    const filepath = path.join(qrDir, filename);
    
    // Generate QR code image
    await QRCode.toFile(filepath, verifyUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Return URL path
    return `/qrcodes/${filename}`;
  } catch (error) {
    console.error('QR generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * STEP 5: Save codes to database
 */
async function saveCodesToDatabase(codes, batchId, manufacturerId) {
  const codeDocuments = [];
  
  for (const code of codes) {
    // Generate QR code for each code
    const qrCodeUrl = await generateQRCodeImage(code);
    
    codeDocuments.push({
      code,
      batch: batchId,
      manufacturer: manufacturerId,
      qrCodeUrl,
      status: 'active'
    });
  }
  
  // Bulk insert for efficiency
  const savedCodes = await Code.insertMany(codeDocuments);
  
  return savedCodes;
}

/**
 * STEP 6: Update batch with generated codes count
 */
async function updateBatchStatus(batchId, codesGenerated) {
  await Batch.findByIdAndUpdate(batchId, {
    codesGenerated,
    status: 'active'
  });
}

/**
 * MAIN WORKFLOW: Complete code generation process
 * Orchestrates all steps in sequence
 */
async function executeCodeGenerationWorkflow(batchData, manufacturerId) {
  try {
    // Step 1: Create batch record
    const batch = await Batch.create({
      ...batchData,
      manufacturer: manufacturerId,
      batchId: `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    });
    
    console.log(`✅ Step 1: Batch created - ${batch.batchId}`);
    
    // Step 2: Generate unique codes
    console.log(`⏳ Step 2: Generating ${batchData.quantity} unique codes...`);
    const codes = await generateUniqueCodes(batchData.quantity);
    console.log(`✅ Step 2: ${codes.length} unique codes generated`);
    
    // Step 3: Generate QR codes and save to database
    console.log(`⏳ Step 3: Generating QR codes and saving to database...`);
    const savedCodes = await saveCodesToDatabase(codes, batch._id, manufacturerId);
    console.log(`✅ Step 3: ${savedCodes.length} codes saved with QR codes`);
    
    // Step 4: Update batch status
    await updateBatchStatus(batch._id, savedCodes.length);
    console.log(`✅ Step 4: Batch status updated`);
    
    // Return result
    return {
      success: true,
      batch: batch,
      codesGenerated: savedCodes.length,
      codes: savedCodes
    };
    
  } catch (error) {
    console.error('❌ Code generation workflow failed:', error);
    throw error;
  }
}

module.exports = {
  generateSingleCode,
  isCodeUnique,
  generateUniqueCodes,
  generateQRCodeImage,
  saveCodesToDatabase,
  updateBatchStatus,
  executeCodeGenerationWorkflow
};
