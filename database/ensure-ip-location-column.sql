-- Ensure ip_location column exists in verifications table
-- Run this in Supabase SQL Editor

-- Check if column exists
DO $$ 
BEGIN
    -- Add ip_location column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'verifications' 
        AND column_name = 'ip_location'
    ) THEN
        ALTER TABLE verifications 
        ADD COLUMN ip_location JSONB;
        
        RAISE NOTICE 'Added ip_location column to verifications table';
    ELSE
        RAISE NOTICE 'ip_location column already exists';
    END IF;
END $$;

-- Verify the column exists
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'verifications'
AND column_name = 'ip_location';

-- Should show:
-- column_name: ip_location
-- data_type: jsonb
-- is_nullable: YES
