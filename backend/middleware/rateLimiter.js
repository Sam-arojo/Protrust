const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Authentication rate limiter
 * 5 login attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes'
  }
});

/**
 * SMS verification rate limiter
 * 5 verifications per hour per phone number
 * This is enforced in the SMS controller with Redis for phone-based tracking
 */
const smsVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Per IP
  message: {
    success: false,
    error: 'Too many SMS verification requests from this IP'
  }
});

/**
 * QR verification rate limiter
 * 10 verifications per hour per IP
 */
const qrVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: 'Too many verification attempts. Please try again later.'
  }
});

/**
 * Code generation rate limiter
 * Prevent abuse of code generation
 */
const codeGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 batch generations per hour
  message: {
    success: false,
    error: 'Code generation limit reached. Please try again later.'
  }
});

/**
 * Registration rate limiter
 * 3 registration attempts per hour per IP
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: 'Too many registration attempts. Please try again later.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  smsVerificationLimiter,
  qrVerificationLimiter,
  codeGenerationLimiter,
  registrationLimiter
};
