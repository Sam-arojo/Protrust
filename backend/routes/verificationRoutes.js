const express = require('express');
const router = express.Router();
const { verifyCode, getVerificationPage } = require('../controllers/verificationController');
const { qrVerificationLimiter } = require('../middleware/rateLimiter');

// Public verification endpoint for QR codes
router.get('/', qrVerificationLimiter, verifyCode);
router.post('/', qrVerificationLimiter, verifyCode);

module.exports = router;
