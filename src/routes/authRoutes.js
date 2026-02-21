const express = require('express');
const router = express.Router();
const { register, verifyEmail, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Public routes
router.post('/register', rateLimiter.auth, register);
router.get('/verify-email/:token', verifyEmail);
router.post('/login', rateLimiter.auth, login);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;
