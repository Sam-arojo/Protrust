const Code = require('../models/Code');
const Batch = require('../models/Batch');
const Verification = require('../models/Verification');

/**
 * Core verification logic - used by both SMS and QR verification
 * This follows the exact workflow you specified in your requirements
 * @param {string} code - The verification code to check
 * @param {string} method - 'sms' or 'qr'
 * @param {Object} metadata - Additional data (phone, IP, etc.)
 * @returns {Object} - Verification result
 */
async function verifyCode(code, method, metadata = {}) {
  console.log(`Verifying code: ${code} via ${method}`);
  
  // Step 1: Validate input
  if (!code || code.length < 8) {
    const result = {
      status: 'error',
      result: 'invalid',
      message: 'Invalid code format',
      isAuthentic: false
    };
    
    await logVerification(code, null, method, 'invalid', metadata, result.message);
    return result;
  }
  
  // Step 2: Query database for the code
  const codeRecord = await Code.findOne({ code })
    .populate('batchId', 'productName batchId manufacturerId')
    .populate('manufacturerId', 'companyName');
  
  // Step 3: Check if code exists
  if (!codeRecord) {
    const result = {
      status: 'error',
      result: 'invalid',
      message: 'Invalid code - not found in our system. Please contact the manufacturer.',
      isAuthentic: false
    };
    
    await logVerification(code, null, method, 'invalid', metadata, result.message);
    return result;
  }
  
  // Step 4: Check if code has already been verified (DUPLICATE)
  if (codeRecord.status === 'verified') {
    const result = {
      status: 'warning',
      result: 'duplicate',
      message: 'WARNING: This product has already been verified. This may be a counterfeit or reused label.',
      isAuthentic: false,
      previousVerification: {
        verifiedAt: codeRecord.verifiedAt,
        method: codeRecord.verificationMethod
      },
      product: {
        name: codeRecord.batchId.productName,
        batchId: codeRecord.batchId.batchId
      }
    };
    
    // Increment verification count and flag as suspicious
    await Code.findByIdAndUpdate(codeRecord._id, {
      verificationCount: codeRecord.verificationCount + 1,
      lastVerificationAttempt: Date.now(),
      status: 'flagged'
    });
    
    // Update batch flagged count
    await Batch.findByIdAndUpdate(codeRecord.batchId._id, {
      $inc: { codesFlagged: 1 }
    });
    
    await logVerification(
      code, 
      codeRecord._id, 
      method, 
      'duplicate', 
      metadata, 
      result.message,
      codeRecord.batchId._id,
      codeRecord.manufacturerId._id
    );
    
    return result;
  }
  
  // Step 5: Check if code is flagged
  if (codeRecord.status === 'flagged') {
    const result = {
      status: 'warning',
      result: 'duplicate',
      message: 'WARNING: This code has been flagged due to multiple verification attempts. Possible counterfeit.',
      isAuthentic: false,
      product: {
        name: codeRecord.batchId.productName,
        batchId: codeRecord.batchId.batchId
      }
    };
    
    await logVerification(
      code, 
      codeRecord._id, 
      method, 
      'duplicate', 
      metadata, 
      result.message,
      codeRecord.batchId._id,
      codeRecord.manufacturerId._id
    );
    
    return result;
  }
  
  // Step 6: Code is ACTIVE and VALID - Mark as verified
  await Code.findByIdAndUpdate(codeRecord._id, {
    status: 'verified',
    verifiedAt: Date.now(),
    verificationMethod: method,
    verificationCount: 1,
    lastVerificationAttempt: Date.now()
  });
  
  // Step 7: Update batch verified count
  await Batch.findByIdAndUpdate(codeRecord.batchId._id, {
    $inc: { codesVerified: 1 }
  });
  
  // Step 8: Log successful verification
  const result = {
    status: 'success',
    result: 'success',
    message: '✓ AUTHENTIC PRODUCT VERIFIED',
    isAuthentic: true,
    product: {
      name: codeRecord.batchId.productName,
      batchId: codeRecord.batchId.batchId,
      manufacturer: codeRecord.manufacturerId.companyName
    },
    verifiedAt: new Date()
  };
  
  await logVerification(
    code, 
    codeRecord._id, 
    method, 
    'success', 
    metadata, 
    result.message,
    codeRecord.batchId._id,
    codeRecord.manufacturerId._id
  );
  
  console.log(`✅ Code ${code} verified successfully via ${method}`);
  
  return result;
}

/**
 * Log verification attempt to database for analytics
 * @param {string} code - The code that was verified
 * @param {ObjectId} codeId - MongoDB ID of the code
 * @param {string} method - 'sms' or 'qr'
 * @param {string} result - 'success', 'duplicate', 'invalid'
 * @param {Object} metadata - Additional data
 * @param {string} responseMessage - Message sent to user
 * @param {ObjectId} batchId - Batch ID
 * @param {ObjectId} manufacturerId - Manufacturer ID
 */
async function logVerification(code, codeId, method, result, metadata, responseMessage, batchId = null, manufacturerId = null) {
  try {
    const verificationLog = {
      code,
      codeId,
      batchId,
      manufacturerId,
      method,
      result,
      responseMessage,
      timestamp: Date.now()
    };
    
    // Add method-specific metadata
    if (method === 'sms') {
      verificationLog.senderPhone = metadata.phone;
      verificationLog.smsMessageId = metadata.messageId;
    } else if (method === 'qr') {
      verificationLog.ipAddress = metadata.ip;
      verificationLog.userAgent = metadata.userAgent;
    }
    
    await Verification.create(verificationLog);
  } catch (error) {
    console.error('Error logging verification:', error.message);
  }
}

/**
 * SMS-specific verification handler
 * @param {string} code - Code from SMS
 * @param {string} phone - Sender's phone number
 * @param {string} messageId - SMS message ID
 * @returns {Object} - Verification result with SMS response
 */
async function verifySMS(code, phone, messageId) {
  const metadata = { phone, messageId };
  const result = await verifyCode(code, 'sms', metadata);
  
  // Format SMS response message
  let smsResponse = '';
  
  if (result.status === 'success') {
    smsResponse = `✓ AUTHENTIC: ${result.product.name} verified. Manufacturer: ${result.product.manufacturer}. Thank you for choosing genuine products!`;
  } else if (result.status === 'warning') {
    smsResponse = `⚠ WARNING: Product already verified on ${result.previousVerification?.verifiedAt?.toLocaleDateString() || 'unknown date'}. This may be counterfeit. Contact manufacturer immediately.`;
  } else {
    smsResponse = `✗ INVALID CODE: Not found in our system. This may be a fake product. Contact manufacturer for verification.`;
  }
  
  return {
    ...result,
    smsResponse
  };
}

/**
 * QR-specific verification handler
 * @param {string} code - Code from QR scan
 * @param {string} ip - User's IP address
 * @param {string} userAgent - User's browser agent
 * @returns {Object} - Verification result for web display
 */
async function verifyQR(code, ip, userAgent) {
  const metadata = { ip, userAgent };
  return await verifyCode(code, 'qr', metadata);
}

module.exports = {
  verifyCode,
  verifySMS,
  verifyQR,
  logVerification
};
