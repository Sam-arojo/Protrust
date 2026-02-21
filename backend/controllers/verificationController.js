const { executeVerificationWorkflow } = require('../workflows/verificationWorkflow');
const axios = require('axios');

/**
 * @desc    Verify code (QR or manual entry)
 * @route   GET/POST /api/verify
 * @access  Public
 */
const verifyCode = async (req, res) => {
  try {
    // Step 1: Extract code from query or body
    const code = req.query.code || req.body.code;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required'
      });
    }
    
    // Step 2: Verify reCAPTCHA (if provided in POST request)
    if (req.method === 'POST') {
      const recaptchaToken = req.body.recaptchaToken;
      
      if (!recaptchaToken) {
        return res.status(400).json({
          success: false,
          error: 'reCAPTCHA verification required'
        });
      }
      
      const isHuman = await verifyRecaptcha(recaptchaToken);
      
      if (!isHuman) {
        return res.status(400).json({
          success: false,
          error: 'reCAPTCHA verification failed'
        });
      }
    }
    
    // Step 3: Collect metadata
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    
    // Step 4: Execute verification workflow
    const result = await executeVerificationWorkflow(code, 'qr', metadata);
    
    // Step 5: Return result
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed. Please try again.'
    });
  }
};

/**
 * Helper: Verify reCAPTCHA token
 */
async function verifyRecaptcha(token) {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.warn('reCAPTCHA secret key not configured');
      return true; // Allow if not configured (for development)
    }
    
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token
        }
      }
    );
    
    return response.data.success && response.data.score > 0.5;
    
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

module.exports = {
  verifyCode
};
