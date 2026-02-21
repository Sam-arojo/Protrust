const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
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

    const batchId = event.queryStringParameters?.batchId;
    const page = parseInt(event.queryStringParameters?.page) || 1;
    const pageSize = parseInt(event.queryStringParameters?.pageSize) || 1000;
    const status = event.queryStringParameters?.status; // 'active', 'verified', or null for all

    if (!batchId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Batch ID required' })
      };
    }

    console.log(`Fetching batch ${batchId}, page ${page}, pageSize ${pageSize}, status ${status || 'all'}`);

    // Get batch details
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('*')
      .eq('id', batchId)
      .eq('manufacturer_id', decoded.userId)
      .single();

    if (batchError || !batch) {
      console.error('Batch fetch error:', batchError);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Batch not found' })
      };
    }

    // Build base query
    let countQuery = supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId);
    
    let dataQuery = supabase
      .from('codes')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    
    // Apply status filter if provided
    if (status) {
      countQuery = countQuery.eq('status', status);
      dataQuery = dataQuery.eq('status', status);
    }

    // Get total count (fast COUNT query)
    const { count: totalCount } = await countQuery;
    console.log(`Total codes matching filter: ${totalCount}`);
    
    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    console.log(`Fetching codes ${from} to ${to} (page ${page})...`);
    
    // Fetch only the requested page of codes
    const { data: codes, error: codesError } = await dataQuery.range(from, to);

    if (codesError) {
      console.error('Codes fetch error:', codesError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Failed to fetch codes' })
      };
    }

    console.log(`Fetched ${codes?.length || 0} codes for page ${page}`);

    // Get status counts (fast COUNT queries)
    const { count: activeCount } = await supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('status', 'active');

    const { count: verifiedCount } = await supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('status', 'verified');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        batch: batch,
        codes: codes || [],
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalCodes: totalCount,
          totalPages: Math.ceil(totalCount / pageSize)
        },
        counts: {
          total: batch.codes_generated || 0,
          active: activeCount || 0,
          verified: verifiedCount || 0
        }
      })
    };

  } catch (error) {
    console.error('Get batch details error:', error);
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
