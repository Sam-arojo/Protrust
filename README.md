# QualityChek - Anti-Counterfeit Verification Platform

A comprehensive SaaS platform for manufacturers to combat counterfeit products using unique verification codes and QR codes.

## 🎯 Features

- **Corporate Email Validation**: Only business email addresses allowed (blocks Gmail, Yahoo, etc.)
- **Code Generation**: Cryptographically secure unique codes (12-16 characters)
- **QR Code Generation**: Automatic QR code creation for each verification code
- **Dual Verification Methods**:
  - SMS verification via Twilio
  - QR code scanning via web page
- **Real-time Analytics**: Dashboard with verification trends and statistics
- **Batch Management**: Create and manage product batches
- **Export Functionality**: Export codes as PDF or ZIP
- **Security**: JWT authentication, rate limiting, input sanitization
- **Admin Panel**: User approval and system monitoring

## 📋 Prerequisites

- Node.js >= 16.x
- MongoDB >= 5.x
- Twilio account (for SMS)
- Gmail account (for email verification)
- reCAPTCHA keys (for QR verification)

## 🚀 Quick Start

### Backend Setup

1. **Navigate to backend directory**
```bash
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:
- MongoDB connection string
- JWT secret (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- Twilio credentials
- Email credentials
- reCAPTCHA secret key

4. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

Server runs on: `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
```

4. **Start development server**
```bash
npm start
```

Frontend runs on: `http://localhost:3000`

## 📁 Project Structure

### Backend (Node.js + Express)
```
backend/
├── config/              # Configuration files
├── models/              # Mongoose models
│   ├── User.js         # User authentication
│   ├── Batch.js        # Product batches
│   ├── Code.js         # Verification codes
│   └── Verification.js # Verification logs
├── workflows/           # Core business logic (procedural)
│   ├── codeGenerationWorkflow.js
│   └── verificationWorkflow.js
├── controllers/         # Route handlers
│   ├── authController.js
│   ├── batchController.js
│   ├── verificationController.js
│   ├── smsController.js
│   ├── analyticsController.js
│   └── adminController.js
├── routes/              # API routes
│   ├── authRoutes.js
│   ├── batchRoutes.js
│   ├── verificationRoutes.js
│   ├── smsRoutes.js
│   ├── analyticsRoutes.js
│   └── adminRoutes.js
├── middleware/          # Express middleware
│   ├── auth.js         # JWT authentication
│   └── rateLimiter.js  # Rate limiting
├── utils/               # Helper utilities
│   └── domainValidator.js
├── public/              # Static files
│   └── qrcodes/        # Generated QR codes
├── server.js            # Entry point
└── package.json
```

## 🔐 Security Features

1. **Email Domain Validation**: Blocks free email providers (Gmail, Yahoo, etc.)
2. **JWT Authentication**: Secure token-based auth
3. **Rate Limiting**:
   - 5 login attempts per 15 minutes
   - 5 SMS verifications per hour per phone
   - 10 QR verifications per hour per IP
   - 10 code generations per hour per user
4. **Input Sanitization**: Protection against XSS and SQL injection
5. **HTTPS Only** (in production)
6. **reCAPTCHA**: Bot protection on public verification page

## 📊 API Endpoints

### Authentication
```
POST   /api/auth/register        - Register new manufacturer
POST   /api/auth/login           - Login user
GET    /api/auth/verify-email/:token - Verify email
POST   /api/auth/forgot-password - Request password reset
POST   /api/auth/reset-password/:token - Reset password
GET    /api/auth/me              - Get current user
```

### Batches
```
POST   /api/batches              - Create batch and generate codes
GET    /api/batches              - Get all batches
GET    /api/batches/:id          - Get batch details
GET    /api/batches/:id/codes    - Get codes for batch
GET    /api/batches/:id/export   - Export codes (PDF/ZIP)
PATCH  /api/batches/:id/archive  - Archive batch
```

### Verification
```
GET    /api/verify?code=XXX      - Verify code (QR scan)
POST   /api/verify               - Verify code with reCAPTCHA
```

### SMS
```
POST   /api/sms/webhook          - Twilio webhook for incoming SMS
```

### Analytics
```
GET    /api/analytics/dashboard  - Dashboard statistics
GET    /api/analytics/trends     - Verification trends
GET    /api/analytics/geographic - Geographic data
```

### Admin
```
GET    /api/admin/users          - Get all users
PATCH  /api/admin/users/:id/approve - Approve user
DELETE /api/admin/users/:id      - Delete user
GET    /api/admin/stats          - System statistics
```

## 🔄 Workflows

### Code Generation Workflow
```
1. Create batch record
2. Generate unique cryptographic codes
3. Generate QR code for each verification code
4. Save codes to database
5. Update batch status
6. Return success
```

### Verification Workflow (SMS/QR)
```
1. Validate code format
2. Look up code in database
3. Check code status:
   - Active → Mark as verified, return success
   - Verified → Return duplicate warning
   - Invalid → Return error
4. Update code status (if active)
5. Log verification attempt
6. Return result
```

## 📱 SMS Integration

### Setup Twilio

1. Create Twilio account
2. Get a phone number with SMS capability
3. Configure webhook URL: `https://yourdomain.com/api/sms/webhook`
4. Add credentials to `.env`

### SMS Flow

1. Consumer scratches label, reveals code
2. Consumer sends code via SMS to your Twilio number
3. Twilio forwards SMS to your webhook
4. Backend processes verification
5. Backend responds with TwiML message
6. Consumer receives verification result

### SMS Response Format
```
✓ AUTHENTIC: Product verified successfully!
[Product Name]
Manufactured by [Company]

⚠ WARNING: This product was already verified. Possible FAKE.

✗ INVALID CODE: Not found in our system.
```

## 🌐 QR Code Verification

### Public Verification Page

URL format: `https://yourdomain.com/verify?code=ABC123XYZ456`

Features:
- Mobile-responsive design
- reCAPTCHA protection
- Rate limiting (10/hour per IP)
- Clear success/warning/error states
- Product information display

## 👤 User Roles

### Manufacturer (Default)
- Generate codes and batches
- View own analytics
- Export codes
- Manage own batches

### Admin
- Approve/reject user registrations
- View all system statistics
- Manage all users
- System monitoring

## 📈 Analytics Dashboard

Provides:
- Total codes generated
- Verification counts (SMS vs QR)
- Fake detection alerts
- Geographic distribution
- Verification trends over time
- Batch performance

## 🔧 Development

### Running Tests
```bash
npm test
```

### Database Seeding
```bash
# Create admin user
node scripts/createAdmin.js
```

### Generate Sample Data
```bash
# Generate test batch
node scripts/generateTestBatch.js
```

## 🚀 Deployment

### Recommended Stack
- **Backend**: AWS EC2 / Heroku / Railway
- **Database**: MongoDB Atlas
- **Frontend**: Vercel / Netlify
- **SMS**: Twilio
- **Email**: Gmail / SendGrid

### Environment Variables (Production)
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-super-secret-key
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=...
EMAIL_PASSWORD=...
RECAPTCHA_SECRET_KEY=...
CLIENT_URL=https://yourdomain.com
```

### SSL Certificate
Required for production. Use:
- Let's Encrypt (free)
- Cloudflare SSL
- AWS Certificate Manager

## 📝 TODO / Future Enhancements

- [ ] Redis integration for better rate limiting
- [ ] Multi-language support (Hausa, Igbo)
- [ ] Batch CSV upload
- [ ] Email notifications for fake detections
- [ ] Mobile app (React Native)
- [ ] Blockchain integration for immutable audit trail
- [ ] Advanced analytics with Chart.js
- [ ] Webhook support for integrations
- [ ] API documentation with Swagger
- [ ] Unit and integration tests

## 🤝 Support

For issues or questions:
- Email: support@qualitychek.com
- Documentation: https://docs.qualitychek.com

## 📄 License

Proprietary - All Rights Reserved

---

Built with procedural thinking for maximum clarity and maintainability.
