const rateLimit = require('express-rate-limit');

// Global rate limiter for all routes
const global = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication routes
const auth = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: {
    success: false,
    message: 'Too many login attempts, please try again after an hour.'
  },
  skipSuccessfulRequests: true,
});

// Rate limiter for SMS verification
const smsVerification = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 SMS verifications per phone per hour
  message: 'SMS rate limit exceeded. Maximum 5 verifications per hour.',
  keyGenerator: (req) => {
    // Use phone number as key if available
    return req.body.From || req.ip;
  }
});

// Rate limiter for QR verification
const qrVerification = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 QR verifications per IP per hour
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.'
  },
  standardHeaders: true,
});

// Rate limiter for code generation
const codeGeneration = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 batch generations per hour
  message: {
    success: false,
    message: 'Code generation rate limit exceeded. Please try again later.'
  }
});

module.exports = {
  global,
  auth,
  smsVerification,
  qrVerification,
  codeGeneration
};
