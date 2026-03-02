const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * STEP 1: Extract token from request headers
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * STEP 2: Verify JWT token
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * STEP 3: Look up user from token payload
 */
async function getUserFromToken(userId) {
  try {
    const user = await User.findById(userId).select('-password');
    return user;
  } catch (error) {
    console.error('User lookup error:', error);
    return null;
  }
}

/**
 * MAIN AUTHENTICATION MIDDLEWARE
 * Protects routes that require authentication
 */
const authenticate = async (req, res, next) => {
  try {
    // Step 1: Extract token from header
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }
    
    // Step 2: Verify token
    const verification = verifyToken(token);
    
    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
    // Step 3: Get user from database
    const user = await getUserFromToken(verification.decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Step 4: Check if user is verified and approved
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email address'
      });
    }
    
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        error: 'Your account is pending approval'
      });
    }
    
    // Attach user to request object
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * ROLE-BASED ACCESS MIDDLEWARE
 * Restricts access to specific roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.'
      });
    }
    
    next();
  };
};

/**
 * Generate JWT token for user
 */
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
}

module.exports = {
  authenticate,
  authorize,
  generateToken,
  extractToken,
  verifyToken,
  getUserFromToken
};
