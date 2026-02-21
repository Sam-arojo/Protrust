const express = require('express');
const router = express.Router();
const { handleIncomingSMS } = require('../controllers/smsController');
const rateLimiter = require('../middleware/rateLimiter');

// Twilio webhook endpoint
router.post('/', rateLimiter.smsVerification, handleIncomingSMS);

module.exports = router;
