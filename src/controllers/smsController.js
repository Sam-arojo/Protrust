const { verifySMS } = require('../workflows/verificationWorkflow');
const twilio = require('twilio');

/**
 * Handle incoming SMS from Twilio
 * POST /webhook/sms
 */
async function handleIncomingSMS(req, res) {
  try {
    // Step 1: Extract Twilio data
    const { From, Body, MessageSid } = req.body;
    
    console.log(`Incoming SMS from ${From}: ${Body}`);
    
    // Step 2: Extract verification code from message
    // Users should send just the code, e.g., "ABC123DEF456"
    const code = Body.trim().toUpperCase();
    
    // Step 3: Verify the code
    const result = await verifySMS(code, From, MessageSid);
    
    // Step 4: Send SMS response using Twilio
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(result.smsResponse);
    
    // Step 5: Return TwiML response
    res.type('text/xml');
    res.send(twiml.toString());
    
  } catch (error) {
    console.error('SMS webhook error:', error);
    
    // Send error message to user
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('Error processing your verification request. Please try again or contact support.');
    
    res.type('text/xml');
    res.send(twiml.toString());
  }
}

/**
 * Manually send verification response (for testing)
 * POST /api/sms/verify
 */
async function manualSMSVerify(req, res) {
  try {
    const { code, phone } = req.body;
    
    if (!code || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Code and phone number are required'
      });
    }
    
    const result = await verifySMS(code, phone, 'manual-' + Date.now());
    
    res.status(200).json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Manual SMS verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying code'
    });
  }
}

module.exports = {
  handleIncomingSMS,
  manualSMSVerify
};
