const express = require('express');
const router = express.Router();
const { verifyPublic, getVerificationPage } = require('../controllers/publicController');
const rateLimiter = require('../middleware/rateLimiter');

// Public verification endpoint (JSON API)
router.get('/verify', rateLimiter.qrVerification, verifyPublic);

// Public verification page (HTML for browsers)
router.get('/verify-page', rateLimiter.qrVerification, getVerificationPage);

module.exports = router;
