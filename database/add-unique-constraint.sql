-- Add UNIQUE constraint to codes table to prevent duplicate codes across ALL batches
-- This is a DATABASE-LEVEL safety mechanism

-- Run this SQL in Supabase SQL Editor:

-- Step 1: First, let's check if there are any existing duplicates
-- (There shouldn't be any, but let's verify)
SELECT code, COUNT(*) as count
FROM codes
GROUP BY code
HAVING COUNT(*) > 1;

-- If the above query returns any rows, you have duplicates that need to be cleaned up
-- If it returns nothing, proceed to Step 2

-- Step 2: Add UNIQUE constraint on the 'code' column
ALTER TABLE codes
ADD CONSTRAINT codes_code_unique UNIQUE (code);

-- What this does:
-- 1. Ensures no two codes can ever be the same
-- 2. Database will reject any insert with duplicate code
-- 3. Works across ALL batches and ALL manufacturers
-- 4. Extra safety layer beyond application logic

-- Step 3: Verify the constraint was added
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'codes'::regclass
  AND conname = 'codes_code_unique';

-- You should see one row with constraint_name = 'codes_code_unique'

-- IMPORTANT NOTES:
-- - This constraint is CRITICAL for data integrity
-- - It prevents duplicates at the database level
-- - Even if application code has a bug, database will reject duplicates
-- - This is a one-time migration, run it once
