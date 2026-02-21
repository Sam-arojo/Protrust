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

    // Get verified codes (unique codes that have been verified at least once)
    const { data: verifiedCodes } = await supabase
      .from('codes')
      .select('id')
      .eq('manufacturer_id', decoded.userId)
      .not('verified_at', 'is', null);

    // Get successful verifications
    const { count: successfulVerifications } = await supabase
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId)
      .eq('result', 'success');

    // Get fake detections (duplicate verification attempts)
    const { count: fakeDetections } = await supabase
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId)
      .eq('result', 'duplicate');
    
    // Get active batches count
    const { count: activeBatches } = await supabase
      .from('batches')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', decoded.userId)
      .eq('status', 'active');

    // Calculate verification rate
    const verificationRate = totalCodes > 0 
      ? Math.round(((verifiedCodes?.length || 0) / totalCodes) * 100) 
      : 0;

    // Calculate growth rates (placeholders - default to 0 until historical data implemented)
    // TODO: Implement real growth calculation based on historical data comparison
    const growthRate = 0; // Would compare to previous period
    const verifiedGrowth = 0; // Would compare to previous period
    const fakeGrowth = 0; // Would compare to previous period
    const rateGrowth = 0; // Would compare to previous period

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        totalCodes: totalCodes || 0,
        verifiedCodes: verifiedCodes?.length || 0,
        activeBatches: activeBatches || 0,
        fakeDetections: fakeDetections || 0,
        verificationRate: verificationRate,
        growthRate: growthRate,
        verifiedGrowth: verifiedGrowth,
        fakeGrowth: fakeGrowth,
        rateGrowth: rateGrowth
      })
    };

  } catch (error) {
    console.error('Get stats error:', error);
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
