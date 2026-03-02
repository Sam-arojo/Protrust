const twilio = require('twilio');
const { executeVerificationWorkflow } = require('../workflows/verificationWorkflow');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * @desc    Handle incoming SMS from Twilio webhook
 * @route   POST /api/sms/webhook
 * @access  Public (Twilio webhook)
 */
const handleIncomingSMS = async (req, res) => {
  try {
    // Step 1: Validate Twilio signature (security)
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      req.body
    );
    
    if (!isValid && process.env.NODE_ENV === 'production') {
      console.error('Invalid Twilio signature');
      return res.status(403).send('Forbidden');
    }
    
    // Step 2: Extract SMS data
    const { From: phoneNumber, Body: messageBody } = req.body;
    
    console.log(`📱 SMS received from ${phoneNumber}: ${messageBody}`);
    
    // Step 3: Extract code from message body
    const code = extractCodeFromMessage(messageBody);
    
    if (!code) {
      return sendSMSResponse(res, phoneNumber, 
        'Invalid format. Please send only the verification code.');
    }
    
    // Step 4: Check rate limiting for this phone number
    const canVerify = await checkPhoneRateLimit(phoneNumber);
    
    if (!canVerify) {
      return sendSMSResponse(res, phoneNumber,
        'Too many verification attempts. Please try again later.');
    }
    
    // Step 5: Execute verification workflow
    const metadata = {
      phoneNumber: anonymizePhoneNumber(phoneNumber)
    };
    
    const result = await executeVerificationWorkflow(code, 'sms', metadata);
    
    // Step 6: Format and send response
    const responseMessage = formatSMSResponse(result);
    return sendSMSResponse(res, phoneNumber, responseMessage);
    
  } catch (error) {
    console.error('SMS handling error:', error);
    return sendSMSResponse(res, null, 
      'System error. Please try again later.');
  }
};

/**
 * HELPER: Extract code from SMS message body
 */
function extractCodeFromMessage(message) {
  if (!message) return null;
  
  // Remove whitespace and convert to uppercase
  const cleaned = message.trim().toUpperCase();
  
  // Extract alphanumeric code (8-16 characters)
  const codeMatch = cleaned.match(/[A-Z0-9]{8,16}/);
  
  return codeMatch ? codeMatch[0] : null;
}

/**
 * HELPER: Check rate limiting for phone number
 * Using in-memory store (in production, use Redis)
 */
const phoneRateLimits = new Map();

async function checkPhoneRateLimit(phoneNumber) {
  const now = Date.now();
  const hourAgo = now - 3600000;
  
  if (!phoneRateLimits.has(phoneNumber)) {
    phoneRateLimits.set(phoneNumber, []);
  }
  
  const attempts = phoneRateLimits.get(phoneNumber);
  
  // Remove attempts older than 1 hour
  const recentAttempts = attempts.filter(time => time > hourAgo);
  
  // Check limit (5 per hour)
  if (recentAttempts.length >= 5) {
    return false;
  }
  
  // Add current attempt
  recentAttempts.push(now);
  phoneRateLimits.set(phoneNumber, recentAttempts);
  
  return true;
}

/**
 * HELPER: Anonymize phone number for logging
 */
function anonymizePhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber.length < 6) return 'UNKNOWN';
  
  return phoneNumber.slice(0, -4) + 'XXXX';
}

/**
 * HELPER: Format verification result for SMS response
 */
function formatSMSResponse(result) {
  switch (result.status) {
    case 'success':
      return `✓ AUTHENTIC: Product verified successfully!\n${result.productInfo?.productName || ''}\nManufactured by ${result.productInfo?.manufacturer || 'N/A'}`;
      
    case 'duplicate':
      return `⚠ WARNING: This product was already verified on ${result.productInfo?.firstVerifiedAt ? new Date(result.productInfo.firstVerifiedAt).toLocaleDateString() : 'earlier'}. Possible FAKE or reused item. Contact manufacturer.`;
      
    case 'invalid':
      return `✗ INVALID CODE: Not found in our system. This may be a counterfeit product. Contact the manufacturer.`;
      
    case 'flagged':
      return `⚠ FLAGGED: This code has been reported. Contact manufacturer immediately.`;
      
    default:
      return 'System error. Please try again or contact support.';
  }
}

/**
 * HELPER: Send SMS response using Twilio
 */
function sendSMSResponse(res, to, message) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);
  
  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * @desc    Send SMS to a phone number (for notifications)
 * @access  Private (internal use)
 */
async function sendSMS(to, message) {
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  handleIncomingSMS,
  sendSMS
};
