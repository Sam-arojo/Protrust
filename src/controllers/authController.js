const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

/**
 * Register new manufacturer
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { email, password, companyName, companyDomain } = req.body;
    
    // Step 1: Validate required fields
    if (!email || !password || !companyName || !companyDomain) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    
    // Step 2: Check if email domain is blocked (free providers)
    if (User.isBlockedDomain(email)) {
      return res.status(400).json({
        success: false,
        message: 'Free email providers not allowed. Please use your company email address.'
      });
    }
    
    // Step 3: Verify email domain matches company domain
    const emailDomain = email.split('@')[1].toLowerCase();
    if (emailDomain !== companyDomain.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Email domain must match your company domain'
      });
    }
    
    // Step 4: Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Step 5: Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    // Step 6: Create user
    const user = await User.create({
      email,
      password,
      companyName,
      companyDomain: emailDomain,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    });
    
    // Step 7: Send verification email
    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`;
    
    try {
      await sendEmail({
        to: email,
        subject: 'Verify Your QualityChek Account',
        html: `
          <h2>Welcome to QualityChek!</h2>
          <p>Thank you for registering your company: <strong>${companyName}</strong></p>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create this account, please ignore this email.</p>
        `
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
    }
    
    // Step 8: Return success response (without password)
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        isEmailVerified: user.isEmailVerified
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during registration',
      error: error.message
    });
  }
}

/**
 * Verify email address
 * GET /api/auth/verify-email/:token
 */
async function verifyEmail(req, res) {
  try {
    const { token } = req.params;
    
    // Step 1: Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    // Step 2: Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    // Step 3: Return success
    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email'
    });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    // Step 1: Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Step 2: Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Step 3: Check password
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Step 4: Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email address before logging in'
      });
    }
    
    // Step 5: Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }
    
    // Step 6: Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Step 7: Generate JWT token
    const token = generateToken(user._id);
    
    // Step 8: Return user data and token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login'
    });
  }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id);
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        companyName: user.companyName,
        companyDomain: user.companyDomain,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
}

module.exports = {
  register,
  verifyEmail,
  login,
  getMe
};
