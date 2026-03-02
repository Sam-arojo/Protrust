// Email utility for sending verification emails
// Supports multiple email providers: Resend (recommended), SendGrid, or SMTP

const crypto = require('crypto');

/**
 * Generate a secure random verification token
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Send verification email
 * @param {string} email - User's email address
 * @param {string} token - Verification token
 * @param {string} baseUrl - Base URL of the application
 * @returns {Promise<boolean>} - Success status
 */
async function sendVerificationEmail(email, token, baseUrl) {
  const verificationLink = `${baseUrl}/verify-email?token=${token}`;
  
  // Choose email provider based on environment variable
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  
  const emailData = {
    to: email,
    subject: 'Verify Your QualityChek Account',
    html: generateEmailHTML(verificationLink),
    text: generateEmailText(verificationLink)
  };
  
  try {
    switch (provider.toLowerCase()) {
      case 'resend':
        return await sendWithResend(emailData);
      case 'sendgrid':
        return await sendWithSendGrid(emailData);
      case 'smtp':
        return await sendWithSMTP(emailData);
      default:
        console.error('Unknown email provider:', provider);
        return false;
    }
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

/**
 * Send email using Resend (recommended)
 * Requires: RESEND_API_KEY environment variable
 */
async function sendWithResend(emailData) {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'QualityChek <noreply@qualitychek.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    })
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('Resend error:', result);
    return false;
  }
  
  console.log('Email sent via Resend:', result.id);
  return true;
}

/**
 * Send email using SendGrid
 * Requires: SENDGRID_API_KEY environment variable
 */
async function sendWithSendGrid(emailData) {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return false;
  }
  
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: emailData.to }]
      }],
      from: {
        email: process.env.EMAIL_FROM || 'noreply@qualitychek.app',
        name: 'QualityChek'
      },
      subject: emailData.subject,
      content: [
        {
          type: 'text/plain',
          value: emailData.text
        },
        {
          type: 'text/html',
          value: emailData.html
        }
      ]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('SendGrid error:', error);
    return false;
  }
  
  console.log('Email sent via SendGrid');
  return true;
}

/**
 * Send email using SMTP (Nodemailer)
 * Requires: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 */
async function sendWithSMTP(emailData) {
  // Note: This requires nodemailer to be installed
  // npm install nodemailer
  
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"QualityChek" <noreply@qualitychek.app>',
    to: emailData.to,
    subject: emailData.subject,
    text: emailData.text,
    html: emailData.html
  });
  
  console.log('Email sent via SMTP');
  return true;
}

/**
 * Generate HTML email template
 */
function generateEmailHTML(verificationLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - QualityChek</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">QualityChek</h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px;">Anti-Counterfeit Verification System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 24px; font-weight: 600;">Welcome to QualityChek!</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for registering with QualityChek. To complete your account setup and start protecting your products, please verify your email address.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Click the button below to verify your email:
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 30px 0;">
                    <a href="${verificationLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 30px 0; color: #2563eb; font-size: 14px; word-break: break-all;">
                ${verificationLink}
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                  <strong>Security Notice:</strong> This link will expire in 24 hours for your security.
                </p>
                
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                  If you didn't create a QualityChek account, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                © ${new Date().getFullYear()} QualityChek. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Anti-Counterfeit Verification System
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email
 */
function generateEmailText(verificationLink) {
  return `
Welcome to QualityChek!

Thank you for registering with QualityChek. To complete your account setup and start protecting your products, please verify your email address.

Click the link below to verify your email:
${verificationLink}

This link will expire in 24 hours for your security.

If you didn't create a QualityChek account, you can safely ignore this email.

---
© ${new Date().getFullYear()} QualityChek - Anti-Counterfeit Verification System
  `.trim();
}

module.exports = {
  generateVerificationToken,
  sendVerificationEmail
};
