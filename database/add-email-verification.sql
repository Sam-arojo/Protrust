-- Add email verification fields to users table

-- Step 1: Add columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_token TEXT,
ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;

-- Step 2: Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token 
ON users(verification_token);

-- Step 3: Mark existing users as verified (they're already in the system)
UPDATE users 
SET email_verified = TRUE 
WHERE email_verified IS NULL OR email_verified = FALSE;

-- Step 4: Verify the changes
SELECT 
  email,
  email_verified,
  verification_token IS NOT NULL as has_token,
  created_at
FROM users
LIMIT 5;

-- All existing users should show email_verified = TRUE
