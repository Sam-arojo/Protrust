const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { validateCorporateEmail } = require('../utils/domainValidator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * @desc    Register new manufacturer
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { email, password, companyName, companyDomain } = req.body;
    
    // Step 1: Validate required fields
    if (!email || !password || !companyName || !companyDomain) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields'
      });
    }
    
    // Step 2: Validate corporate email
    const emailValidation = validateCorporateEmail(email, companyDomain);
    
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        error: emailValidation.errors.join(', ')
      });
    }
    
    // Step 3: Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }
    
    // Step 4: Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Step 5: Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      companyName,
      companyDomain: companyDomain.toLowerCase(),
      verificationToken,
      role: 'manufacturer'
    });
    
    // Step 6: Send verification email
    await sendVerificationEmail(user.email, verificationToken);
    
    // Step 7: Return success response
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        email: user.email,
        companyName: user.companyName
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Step 1: Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }
    
    // Step 2: Find user and include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Step 3: Check password
    const isPasswordMatch = await user.comparePassword(password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Step 4: Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in'
      });
    }
    
    // Step 5: Check if account is approved
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        error: 'Your account is pending admin approval'
      });
    }
    
    // Step 6: Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Step 7: Generate token
    const token = generateToken(user._id);
    
    // Step 8: Return response
    res.status(200).json({
      success: true,
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
      error: 'Login failed. Please try again.'
    });
  }
};

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Step 1: Find user with verification token
    const user = await User.findOne({ verificationToken: token });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
    }
    
    // Step 2: Mark user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    
    // Step 3: Return success
    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Your account is pending admin approval.'
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
};

/**
 * @desc    Request password reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if email exists
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Send reset email
    await sendPasswordResetEmail(user.email, resetToken);
    
    res.status(200).json({
      success: true,
      message: 'Password reset email sent'
    });
    
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request'
    });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }
    
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
    
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Password reset failed'
    });
  }
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getCurrentUser = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
};

/**
 * Helper: Send verification email
 */
async function sendVerificationEmail(email, token) {
  // Configure email transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;
  
  await transporter.sendMail({
    from: `QualityChek <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your QualityChek Account',
    html: `
      <h2>Welcome to QualityChek!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>This link expires in 24 hours.</p>
    `
  });
}

/**
 * Helper: Send password reset email
 */
async function sendPasswordResetEmail(email, token) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
  
  await transporter.sendMail({
    from: `QualityChek <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset. Click the link below:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  });
}

module.exports = {
  register,
  login,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  getCurrentUser
};
