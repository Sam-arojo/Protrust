const Code = require('../models/Code');
const Verification = require('../models/Verification');
const Batch = require('../models/Batch');

/**
 * STEP 1: Validate code format
 */
function validateCodeFormat(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Code is required' };
  }
  
  const trimmedCode = code.trim().toUpperCase();
  
  if (trimmedCode.length < 8 || trimmedCode.length > 16) {
    return { valid: false, error: 'Invalid code format' };
  }
  
  return { valid: true, code: trimmedCode };
}

/**
 * STEP 2: Look up code in database
 */
async function lookupCode(code) {
  try {
    const codeRecord = await Code.findOne({ code })
      .populate('batch')
      .populate('manufacturer', 'companyName');
    
    return codeRecord;
  } catch (error) {
    console.error('Database lookup error:', error);
    throw new Error('Database error during code lookup');
  }
}

/**
 * STEP 3: Check code status and determine result
 */
function checkCodeStatus(codeRecord) {
  // Code doesn't exist
  if (!codeRecord) {
    return {
      status: 'invalid',
      message: 'Invalid code - not found in our system. Contact manufacturer.',
      shouldUpdate: false
    };
  }
  
  // Code already verified
  if (codeRecord.status === 'verified') {
    return {
      status: 'duplicate',
      message: 'WARNING: This product was already verified. Possible fake or reused item.',
      shouldUpdate: false,
      productInfo: {
        productName: codeRecord.batch?.productName,
        manufacturer: codeRecord.manufacturer?.companyName,
        firstVerifiedAt: codeRecord.verifiedAt
      }
    };
  }
  
  // Code is flagged
  if (codeRecord.status === 'flagged') {
    return {
      status: 'flagged',
      message: 'This code has been flagged. Contact manufacturer immediately.',
      shouldUpdate: false,
      productInfo: {
        productName: codeRecord.batch?.productName,
        manufacturer: codeRecord.manufacturer?.companyName
      }
    };
  }
  
  // Code is active - first verification
  return {
    status: 'success',
    message: 'Authentic product verified successfully!',
    shouldUpdate: true,
    productInfo: {
      productName: codeRecord.batch?.productName,
      manufacturer: codeRecord.manufacturer?.companyName,
      batchId: codeRecord.batch?.batchId,
      manufacturingDate: codeRecord.batch?.manufacturingDate
    }
  };
}

/**
 * STEP 4: Update code status to verified
 */
async function markCodeAsVerified(code, method) {
  try {
    const updateResult = await Code.findOneAndUpdate(
      { code, status: 'active' },
      {
        status: 'verified',
        verifiedAt: new Date(),
        verificationMethod: method,
        $inc: { verificationCount: 1 }
      },
      { new: true }
    );
    
    return updateResult !== null;
  } catch (error) {
    console.error('Code update error:', error);
    throw new Error('Failed to update code status');
  }
}

/**
 * STEP 5: Log verification attempt
 */
async function logVerification(code, method, result, metadata = {}) {
  try {
    await Verification.create({
      code,
      method,
      result,
      phoneNumber: metadata.phoneNumber || null,
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
      location: metadata.location || null,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Logging error:', error);
    // Don't throw - logging failure shouldn't break verification
  }
}

/**
 * MAIN VERIFICATION WORKFLOW
 * Handles both SMS and QR code verifications
 */
async function executeVerificationWorkflow(inputCode, method, metadata = {}) {
  try {
    // Step 1: Validate code format
    console.log(`⏳ Step 1: Validating code format...`);
    const validation = validateCodeFormat(inputCode);
    
    if (!validation.valid) {
      await logVerification(inputCode, method, 'error', metadata);
      return {
        success: false,
        status: 'error',
        message: validation.error
      };
    }
    
    const code = validation.code;
    console.log(`✅ Step 1: Code format valid`);
    
    // Step 2: Look up code in database
    console.log(`⏳ Step 2: Looking up code in database...`);
    const codeRecord = await lookupCode(code);
    console.log(`✅ Step 2: Database lookup complete`);
    
    // Step 3: Check code status
    console.log(`⏳ Step 3: Checking code status...`);
    const statusCheck = checkCodeStatus(codeRecord);
    console.log(`✅ Step 3: Status check complete - ${statusCheck.status}`);
    
    // Step 4: Update code if needed (first verification)
    if (statusCheck.shouldUpdate) {
      console.log(`⏳ Step 4: Marking code as verified...`);
      const updated = await markCodeAsVerified(code, method);
      
      if (!updated) {
        console.log(`⚠️ Step 4: Code already verified by another request`);
        statusCheck.status = 'duplicate';
        statusCheck.message = 'Code was just verified by another request';
        statusCheck.shouldUpdate = false;
      } else {
        console.log(`✅ Step 4: Code marked as verified`);
      }
    } else {
      console.log(`⏭️ Step 4: Skipped - code already processed`);
    }
    
    // Step 5: Log verification attempt
    console.log(`⏳ Step 5: Logging verification...`);
    await logVerification(code, method, statusCheck.status, metadata);
    console.log(`✅ Step 5: Verification logged`);
    
    // Return final result
    return {
      success: statusCheck.status === 'success',
      status: statusCheck.status,
      message: statusCheck.message,
      productInfo: statusCheck.productInfo || null,
      verificationTime: new Date()
    };
    
  } catch (error) {
    console.error('❌ Verification workflow failed:', error);
    
    // Log error
    await logVerification(inputCode, method, 'error', metadata);
    
    return {
      success: false,
      status: 'error',
      message: 'System error during verification. Please try again.'
    };
  }
}

/**
 * Get verification statistics for a code
 */
async function getCodeVerificationStats(code) {
  try {
    const verifications = await Verification.find({ code })
      .sort({ timestamp: -1 })
      .limit(10);
    
    return {
      totalAttempts: verifications.length,
      recentAttempts: verifications
    };
  } catch (error) {
    console.error('Stats retrieval error:', error);
    return { totalAttempts: 0, recentAttempts: [] };
  }
}

module.exports = {
  validateCodeFormat,
  lookupCode,
  checkCodeStatus,
  markCodeAsVerified,
  logVerification,
  executeVerificationWorkflow,
  getCodeVerificationStats
};
