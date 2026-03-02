const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { generateVerificationToken, sendVerificationEmail } = require('./utils/email');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// List of free email providers to block
const FREE_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'
];

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, password, companyName, companyDomain } = JSON.parse(event.body);

    // Validate required fields
    if (!email || !password || !companyName || !companyDomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'All fields are required' })
      };
    }

    // Extract domain from email
    const emailDomain = email.split('@')[1]?.toLowerCase();

    // Check if it's a free email provider
    if (FREE_EMAIL_PROVIDERS.includes(emailDomain)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Free email providers not allowed. Use your company email.' 
        })
      };
    }

    // Check if email domain matches company domain
    if (emailDomain !== companyDomain.toLowerCase()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Email domain must match company domain' 
        })
      };
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email already registered' })
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Expires in 24 hours

    // Create user with verification token
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email: email.toLowerCase(),
        password: hashedPassword,
        company_name: companyName,
        company_domain: companyDomain.toLowerCase(),
        role: 'manufacturer',
        email_verified: false,
        verification_token: verificationToken,
        verification_token_expires: tokenExpiry.toISOString(),
        is_approved: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Registration failed' })
      };
    }

    // Get base URL for verification link
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';
    
    // Send verification email
    console.log('Sending verification email to:', newUser.email);
    const emailSent = await sendVerificationEmail(newUser.email, verificationToken, baseUrl);
    
    if (!emailSent) {
      console.warn('Failed to send verification email, but user was created');
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        data: {
          email: newUser.email,
          companyName: newUser.company_name,
          emailSent: emailSent
        }
      })
    };

  } catch (error) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Server error during registration' })
    };
  }
};
