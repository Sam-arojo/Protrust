const { verifyQR } = require('../workflows/verificationWorkflow');

/**
 * Public QR code verification endpoint
 * GET /api/public/verify?code=ABC123
 * This endpoint is accessed when users scan QR codes
 */
async function verifyPublic(req, res) {
  try {
    const { code } = req.query;
    
    // Step 1: Validate code parameter
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required',
        isAuthentic: false
      });
    }
    
    // Step 2: Get user IP and user agent for logging
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'Unknown';
    
    // Step 3: Verify the code
    const result = await verifyQR(code, ip, userAgent);
    
    // Step 4: Return result
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Public verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing verification',
      isAuthentic: false
    });
  }
}

/**
 * Get verification page HTML (for browsers)
 * This renders a mobile-friendly page when QR is scanned
 * GET /verify?code=ABC123
 */
async function getVerificationPage(req, res) {
  const { code } = req.query;
  
  if (!code) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QualityChek - Product Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 30px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
            text-align: center;
          }
          .error {
            background: #fee;
            border-left: 4px solid #f44;
            padding: 15px;
            border-radius: 5px;
            color: #c33;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️ Invalid Request</h1>
          <div class="error">
            <p><strong>No verification code provided.</strong></p>
            <p>Please scan a valid QualityChek QR code.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  
  // Get IP and user agent
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || 'Unknown';
  
  // Verify the code
  verifyQR(code, ip, userAgent).then(result => {
    // Render HTML based on result
    let html = '';
    
    if (result.status === 'success') {
      html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>✓ Authentic Product Verified</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 20px;
              padding: 30px;
              max-width: 500px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
            }
            .checkmark {
              font-size: 80px;
              color: #38ef7d;
              margin-bottom: 20px;
            }
            h1 {
              color: #11998e;
              margin-bottom: 10px;
            }
            .product-info {
              background: #f0fdf4;
              border-left: 4px solid #38ef7d;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
            }
            .product-info p {
              margin: 8px 0;
              color: #333;
            }
            .product-info strong {
              color: #11998e;
            }
            .footer {
              margin-top: 20px;
              font-size: 14px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <h1>AUTHENTIC PRODUCT</h1>
            <p style="color: #666; font-size: 18px;">This product has been verified as genuine</p>
            
            <div class="product-info">
              <p><strong>Product:</strong> ${result.product.name}</p>
              <p><strong>Batch ID:</strong> ${result.product.batchId}</p>
              <p><strong>Manufacturer:</strong> ${result.product.manufacturer}</p>
              <p><strong>Verified:</strong> ${new Date(result.verifiedAt).toLocaleString()}</p>
            </div>
            
            <div class="footer">
              <p>Thank you for choosing genuine products!</p>
              <p style="font-size: 12px; color: #999;">Powered by QualityChek Anti-Counterfeit System</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (result.status === 'warning') {
      html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>⚠ Warning - Already Verified</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 20px;
              padding: 30px;
              max-width: 500px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
            }
            .warning-icon {
              font-size: 80px;
              color: #f5576c;
              margin-bottom: 20px;
            }
            h1 {
              color: #f5576c;
              margin-bottom: 10px;
            }
            .warning-box {
              background: #fff5f5;
              border-left: 4px solid #f5576c;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
            }
            .warning-box p {
              margin: 8px 0;
              color: #333;
            }
            .action {
              background: #fee;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
            }
            .action strong {
              color: #c33;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="warning-icon">⚠</div>
            <h1>WARNING</h1>
            <p style="color: #666; font-size: 18px;">This product code has already been verified</p>
            
            <div class="warning-box">
              <p><strong style="color: #f5576c;">This may indicate:</strong></p>
              <ul style="color: #333;">
                <li>Counterfeit product with copied code</li>
                <li>Reused packaging from authentic product</li>
                <li>Duplicate or fake label</li>
              </ul>
              ${result.previousVerification ? `
                <p style="margin-top: 15px;"><strong>First verified:</strong> ${new Date(result.previousVerification.verifiedAt).toLocaleString()}</p>
              ` : ''}
            </div>
            
            <div class="action">
              <p><strong>What to do:</strong></p>
              <p>Contact the manufacturer immediately for verification. Do not consume or use this product if you have doubts about its authenticity.</p>
            </div>
            
            <div style="margin-top: 20px; font-size: 12px; color: #999;">
              Powered by QualityChek Anti-Counterfeit System
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>✗ Invalid Code</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 20px;
              padding: 30px;
              max-width: 500px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
            }
            .error-icon {
              font-size: 80px;
              color: #764ba2;
              margin-bottom: 20px;
            }
            h1 {
              color: #764ba2;
              margin-bottom: 10px;
            }
            .error-box {
              background: #f5f3ff;
              border-left: 4px solid #764ba2;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
            }
            .action {
              background: #fef3c7;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>INVALID CODE</h1>
            <p style="color: #666; font-size: 18px;">This verification code was not found in our system</p>
            
            <div class="error-box">
              <p><strong style="color: #764ba2;">Possible reasons:</strong></p>
              <ul style="color: #333;">
                <li>Code not registered in QualityChek system</li>
                <li>Counterfeit product with fake code</li>
                <li>Code typed incorrectly</li>
              </ul>
            </div>
            
            <div class="action">
              <p><strong>What to do:</strong></p>
              <p>Contact the manufacturer directly for verification. Exercise caution and do not use this product.</p>
            </div>
            
            <div style="margin-top: 20px; font-size: 12px; color: #999;">
              Powered by QualityChek Anti-Counterfeit System
            </div>
          </div>
        </body>
        </html>
      `;
    }
    
    res.send(html);
  }).catch(error => {
    console.error('Verification page error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
      </head>
      <body style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h1>Error</h1>
        <p>An error occurred while verifying the product. Please try again later.</p>
      </body>
      </html>
    `);
  });
}

module.exports = {
  verifyPublic,
  getVerificationPage
};
