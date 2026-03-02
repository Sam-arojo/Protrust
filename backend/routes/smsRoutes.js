const express = require('express');
const router = express.Router();
const { handleIncomingSMS } = require('../controllers/smsController');
const { smsVerificationLimiter } = require('../middleware/rateLimiter');

// Twilio webhook endpoint
router.post('/webhook', express.urlencoded({ extended: false }), smsVerificationLimiter, handleIncomingSMS);

module.exports = router;
