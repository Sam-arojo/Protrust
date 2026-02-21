const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  verifyEmail, 
  requestPasswordReset,
  resetPassword,
  getCurrentUser
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', registrationLimiter, register);
router.post('/login', authLimiter, login);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.post('/reset-password/:token', authLimiter, resetPassword);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

module.exports = router;
