-- Check how many verifications need IP geolocation backfill
SELECT 
  COUNT(*) as total_without_location,
  COUNT(DISTINCT ip_address) as unique_ips
FROM verifications
WHERE ip_location IS NULL
  AND ip_address IS NOT NULL
  AND ip_address != 'unknown';

-- Sample of IPs that need backfilling
SELECT 
  ip_address,
  COUNT(*) as verification_count
FROM verifications
WHERE ip_location IS NULL
  AND ip_address IS NOT NULL
  AND ip_address != 'unknown'
GROUP BY ip_address
ORDER BY verification_count DESC
LIMIT 20;

-- NOTE: You cannot backfill IP geolocation purely with SQL
-- because it requires calling an external API (ip-api.com)

-- TWO OPTIONS TO BACKFILL:

-- OPTION 1: Use the backfill function (RECOMMENDED)
-- After deploying, call this endpoint as admin:
-- POST https://your-site.netlify.app/.netlify/functions/backfill-ip-locations
-- With Authorization header
-- This will process 1000 records at a time
-- Run multiple times until all records are processed

-- OPTION 2: Accept that old verifications will show IP addresses
-- Only new verifications (after deployment) will show city/state
-- This is acceptable since:
-- 1. Most analytics focus on recent data
-- 2. Old data is historical
-- 3. New verifications will have proper location data

-- If you want to clear old verifications and start fresh:
-- DELETE FROM verifications WHERE ip_location IS NULL;
-- (WARNING: This deletes historical data permanently!)
