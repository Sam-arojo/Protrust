# QualityChek - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will get you up and running with QualityChek locally.

### Step 1: Prerequisites Check

Make sure you have:
- ✅ Node.js 16+ installed (`node --version`)
- ✅ MongoDB installed and running (`mongod --version`)
- ✅ Git installed

### Step 2: Clone & Setup Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Step 3: Configure Environment

Edit `backend/.env` with these minimum settings:

```bash
# Database (use local MongoDB)
MONGODB_URI=mongodb://localhost:27017/qualitychek

# JWT Secret (generate one)
JWT_SECRET=your-random-secret-here-change-this

# For development, you can skip these:
# - TWILIO credentials (SMS won't work but app will run)
# - Email credentials (email verification won't work)
# - reCAPTCHA (verification will still work)

# Set these for full functionality
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

### Step 4: Start Backend

```bash
# From backend directory
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 QualityChek server running on port 5000
```

### Step 5: Setup Frontend (New Terminal)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:5000" > .env
echo "VITE_RECAPTCHA_SITE_KEY=your-key-here" >> .env

# Start dev server
npm run dev
```

Frontend runs on: `http://localhost:3000`

### Step 6: Create Admin User

```bash
# In backend directory
node -e "
const User = require('./models/User');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const admin = await User.create({
    email: 'admin@qualitychek.com',
    password: 'Admin123!',
    companyName: 'QualityChek Admin',
    companyDomain: 'qualitychek.com',
    role: 'admin',
    isVerified: true,
    isApproved: true
  });
  console.log('✅ Admin user created:', admin.email);
  process.exit(0);
});
"
```

### Step 7: Register a Test Manufacturer

1. Go to `http://localhost:3000/register`
2. Use these details:
   - Email: `john@acmecorp.com`
   - Password: `Test123!`
   - Company: `ACME Corp`
   - Domain: `acmecorp.com`
3. Check terminal for verification link (since email isn't configured)
4. Login as admin and approve the user

### Step 8: Test the System

1. **Login** as manufacturer
2. **Create a batch**: Dashboard → New Batch
   - Product: "Pain Relief Tablets"
   - Category: Medicine
   - Quantity: 10
3. **View codes**: Check generated codes and QR codes
4. **Test verification**:
   - Go to `http://localhost:3000/verify?code=YOUR_CODE`
   - Complete verification
5. **Check analytics**: View dashboard stats

## 📱 Testing SMS (Optional)

If you have Twilio:

1. Add Twilio credentials to `.env`
2. Configure webhook: `https://your-ngrok-url.com/api/sms/webhook`
3. Send SMS to your Twilio number with a code

## 🔧 Common Issues

### "Cannot connect to MongoDB"
```bash
# Start MongoDB
mongod

# Or use MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/qualitychek
```

### "Port 5000 already in use"
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or change port in .env
PORT=5001
```

### "CORS error"
Make sure `CLIENT_URL` in backend `.env` matches your frontend URL

## 📂 Project Structure Overview

```
qualitychek/
├── backend/          # Node.js + Express API
│   ├── workflows/   # Core business logic (PROCEDURAL STYLE)
│   ├── controllers/ # Route handlers
│   ├── models/      # Database schemas
│   └── routes/      # API endpoints
├── frontend/        # React dashboard
│   ├── pages/       # Page components
│   └── components/  # Reusable components
└── README.md        # Full documentation
```

## 🎯 Your First Workflow

Understanding the **Procedural Code Organization**:

```javascript
// Example: Code Verification Workflow
// Location: backend/workflows/verificationWorkflow.js

async function executeVerificationWorkflow(code, method, metadata) {
  // STEP 1: Validate code format
  const validation = validateCodeFormat(code);
  if (!validation.valid) return error;
  
  // STEP 2: Look up code in database
  const codeRecord = await lookupCode(code);
  
  // STEP 3: Check code status
  const statusCheck = checkCodeStatus(codeRecord);
  
  // STEP 4: Update code if needed
  if (statusCheck.shouldUpdate) {
    await markCodeAsVerified(code, method);
  }
  
  // STEP 5: Log verification
  await logVerification(code, method, statusCheck.status);
  
  // STEP 6: Return result
  return result;
}
```

Each step is:
- **Clear and sequential**
- **Easy to debug**
- **Matches your thinking style**

## 🔐 Security Checklist

For production:
- [ ] Change JWT_SECRET to a secure random value
- [ ] Use MongoDB Atlas (not local MongoDB)
- [ ] Enable HTTPS
- [ ] Configure real Twilio credentials
- [ ] Set up email service
- [ ] Add reCAPTCHA keys
- [ ] Set NODE_ENV=production
- [ ] Enable all rate limiters
- [ ] Review CORS settings

## 📚 Next Steps

1. Read full `README.md` for detailed documentation
2. Explore the code starting with `backend/workflows/`
3. Customize the frontend in `frontend/src/pages/`
4. Set up Twilio for SMS testing
5. Deploy to production (see README deployment section)

## 💡 Tips

- **Code is organized procedurally** - workflows > controllers > routes
- **Each workflow has clear steps** - easy to follow and modify
- **Comments explain the "why"** - not just the "what"
- **Error handling is explicit** - check each step's result
- **Logs show progress** - see console for workflow execution

## 🆘 Need Help?

- Check `README.md` for full documentation
- Review code comments for explanations
- All workflows are in `backend/workflows/`
- Test endpoints with Postman/Insomnia

---

**You're all set! 🎉**

Login as manufacturer → Create batch → Generate codes → Test verification → View analytics
