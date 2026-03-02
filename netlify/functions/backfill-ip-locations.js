const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Function to get geolocation from IP address
async function getIpLocation(ipAddress) {
  // Extract first IP if multiple IPs separated by comma
  let cleanIp = ipAddress;
  if (ipAddress && ipAddress.includes(',')) {
    cleanIp = ipAddress.split(',')[0].trim();
  }
  
  if (!cleanIp || cleanIp === 'unknown' || cleanIp === '::1' || cleanIp.startsWith('127.')) {
    return null;
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        city: data.city || '',
        region: data.regionName || '',
        state: data.regionName || '',
        country: data.country || '',
        countryCode: data.countryCode || '',
        lat: data.lat || 0,
        lon: data.lon || 0,
        timezone: data.timezone || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error('IP geolocation error:', error);
    return null;
  }
}

// Verify admin authentication
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-in-production');
    return decoded;
  } catch (error) {
    return null;
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify authentication - must be admin
    const decoded = verifyToken(event.headers.authorization);
    
    if (!decoded || decoded.role !== 'admin') {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Unauthorized - Admin access required' })
      };
    }

    console.log('Starting IP geolocation backfill...');

    // Get all verifications without ip_location
    const { data: verificationsToUpdate, count } = await supabase
      .from('verifications')
      .select('id, ip_address', { count: 'exact' })
      .is('ip_location', null)
      .not('ip_address', 'is', null)
      .limit(1000); // Process 1000 at a time to avoid timeout

    console.log(`Found ${count} verifications without geolocation data`);
    console.log(`Processing first ${verificationsToUpdate?.length || 0} verifications...`);

    if (!verificationsToUpdate || verificationsToUpdate.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'No verifications need backfilling',
          processed: 0,
          remaining: 0
        })
      };
    }

    let processed = 0;
    let failed = 0;

    // Process in batches with delay to respect API rate limits (45 req/min)
    for (const verification of verificationsToUpdate) {
      try {
        const ipLocation = await getIpLocation(verification.ip_address);
        
        if (ipLocation) {
          await supabase
            .from('verifications')
            .update({ ip_location: ipLocation })
            .eq('id', verification.id);
          
          processed++;
          console.log(`Updated ${processed}/${verificationsToUpdate.length}`);
        } else {
          failed++;
        }

        // Delay to respect rate limit (45 req/min = ~1.3 req/sec)
        await new Promise(resolve => setTimeout(resolve, 800));
        
      } catch (error) {
        console.error(`Failed to process verification ${verification.id}:`, error);
        failed++;
      }
    }

    const remaining = Math.max(0, count - processed - failed);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: `Backfill batch completed`,
        processed: processed,
        failed: failed,
        remaining: remaining,
        note: remaining > 0 ? 'Run this function again to process more records' : 'All records processed!'
      })
    };

  } catch (error) {
    console.error('Backfill error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Backfill failed',
        details: error.message 
      })
    };
  }
};
