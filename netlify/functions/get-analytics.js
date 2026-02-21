const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Verify JWT token
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
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify authentication
    const decoded = verifyToken(event.headers.authorization);
    
    if (!decoded) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Get total codes for this manufacturer
    const { count: totalCodes } = await supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId);

    // Get all verifications for this manufacturer - Direct query by manufacturer_id (MUCH FASTER!)
    console.log('Fetching verifications directly by manufacturer_id...');
    
    // Get total verifications count
    const { count: totalVerifications } = await supabase
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId);
    
    console.log(`Total verifications for manufacturer: ${totalVerifications || 0}`);
    
    // Get successful verification attempts
    const { count: successfulVerifications } = await supabase
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId)
      .eq('result', 'success');
    
    console.log(`Successful verification attempts: ${successfulVerifications || 0}`);
    
    // Get fake detections count (duplicate attempts)
    const { count: fakeDetections } = await supabase
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId)
      .eq('result', 'duplicate');
    
    console.log(`Fake detections: ${fakeDetections || 0}`);

    // Get recent verification attempts with batch info and geolocation
    let recentVerifications = [];
    if (totalVerifications > 0) {
      console.log(`Fetching ${totalVerifications} verifications in chunks...`);
      
      // Fetch ALL verifications in chunks
      const allVerifications = [];
      const chunkSize = 1000;
      const totalChunks = Math.ceil(totalVerifications / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const from = i * chunkSize;
        const to = from + chunkSize - 1;
        
        const { data: chunk } = await supabase
          .from('verifications')
          .select('*')
          .eq('manufacturer_id', decoded.userId)
          .order('timestamp', { ascending: false })
          .range(from, to);
        
        if (chunk && chunk.length > 0) {
          allVerifications.push(...chunk);
        }
      }
      
      console.log(`Fetched ${allVerifications.length} verifications`);
      
      if (allVerifications.length > 0) {
        // Get batch info for each verification (using batch_id from verification table)
        const uniqueBatchIds = [...new Set(allVerifications.map(v => v.batch_id).filter(Boolean))];
        
        let batchMap = {};
        if (uniqueBatchIds.length > 0) {
          const { data: batches } = await supabase
            .from('batches')
            .select('id, batch_id')
            .in('id', uniqueBatchIds);
          
          if (batches) {
            // Map UUID to batch_id (e.g., UUID -> 'BN20260215')
            batchMap = Object.fromEntries(batches.map(b => [b.id, b.batch_id]));
          }
        }
        
        // Add batch_number and format location to verifications
        recentVerifications = allVerifications.map(v => ({
          ...v,
          batch_number: batchMap[v.batch_id] || 'N/A',
          location: formatLocation(v.ip_address, v.ip_location)
        }));
      }
    }

    // Helper function to format location from IP
    function formatLocation(ipAddress, ipLocation) {
      if (!ipAddress) return 'Unknown';
      
      try {
        if (ipLocation && typeof ipLocation === 'object') {
          const city = ipLocation.city || '';
          const state = ipLocation.region || ipLocation.state || '';
          const country = ipLocation.country || '';
          
          if (city && state) {
            return `${city}, ${state}`;
          } else if (state && country) {
            return `${state}, ${country}`;
          } else if (city && country) {
            return `${city}, ${country}`;
          } else if (country) {
            return country;
          }
        }
        // If no location data, show IP
        return `IP: ${ipAddress}`;
      } catch (error) {
        return `IP: ${ipAddress}`;
      }
    }

    // Calculate verification rate (percentage of unique codes that have been verified at least once)
    // For this, we need count of unique verified codes from codes table
    const { count: uniqueVerifiedCodes } = await supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId)
      .eq('status', 'verified');
    
    const verificationRate = totalCodes > 0 
      ? Math.round((uniqueVerifiedCodes / totalCodes) * 100) 
      : 0;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        analytics: {
          totalCodes: totalCodes || 0,
          successfulVerifications: successfulVerifications || 0,
          fakeDetections: fakeDetections || 0,
          verificationRate: verificationRate,
          recentVerifications: recentVerifications
        }
      })
    };

  } catch (error) {
    console.error('Get analytics error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
