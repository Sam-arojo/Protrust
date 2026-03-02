-- Add manufacturer_id and batch_id to verifications table for efficient querying
-- This eliminates the need to fetch all codes and use IN clauses

-- Step 1: Add the columns
ALTER TABLE verifications
ADD COLUMN IF NOT EXISTS manufacturer_id UUID,
ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Step 2: Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_verifications_manufacturer_id 
ON verifications(manufacturer_id);

CREATE INDEX IF NOT EXISTS idx_verifications_batch_id 
ON verifications(batch_id);

CREATE INDEX IF NOT EXISTS idx_verifications_result 
ON verifications(result);

-- Step 3: Backfill existing data (IMPORTANT!)
-- This updates all existing verifications with manufacturer_id and batch_id
UPDATE verifications v
SET 
  manufacturer_id = c.manufacturer_id,
  batch_id = c.batch_id
FROM codes c
WHERE v.code = c.code
  AND v.manufacturer_id IS NULL;

-- Step 4: Verify the update worked
SELECT 
  COUNT(*) as total_verifications,
  COUNT(manufacturer_id) as verifications_with_manufacturer,
  COUNT(batch_id) as verifications_with_batch
FROM verifications;

-- All three numbers should be equal

-- Step 5: Add foreign key constraints (optional but recommended)
ALTER TABLE verifications
ADD CONSTRAINT fk_verifications_manufacturer 
  FOREIGN KEY (manufacturer_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE;

ALTER TABLE verifications
ADD CONSTRAINT fk_verifications_batch 
  FOREIGN KEY (batch_id) 
  REFERENCES batches(id) 
  ON DELETE CASCADE;

-- Done! Now queries will be instant even with millions of codes
