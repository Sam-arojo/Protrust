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

// Generate CSV content
function generateCSV(batch, codes) {
  // CSV Header
  let csv = 'Batch ID,Product Name,Code,QR Code URL,Status,Verified At,Created At\n';
  
  // CSV Rows
  codes.forEach(code => {
    const row = [
      batch.batch_id,
      batch.product_name,
      code.code,
      code.qr_code_url || '',
      code.status,
      code.verified_at || '',
      code.created_at
    ];
    
    // Escape commas and quotes in values
    const escapedRow = row.map(value => {
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    
    csv += escapedRow.join(',') + '\n';
  });
  
  return csv;
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

    const batchId = event.queryStringParameters?.batchId;
    const status = event.queryStringParameters?.status; // 'active', 'verified', or null for all

    if (!batchId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Batch ID required' })
      };
    }

    // Get batch details
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('*')
      .eq('id', batchId)
      .eq('manufacturer_id', decoded.userId)
      .single();

    if (batchError || !batch) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Batch not found' })
      };
    }

    // Get codes - filter by status if provided (fetch in chunks for large batches)
    console.log('Fetching codes for CSV export...');
    
    // First get count
    let countQuery = supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId);
    
    if (status) {
      countQuery = countQuery.eq('status', status);
    }
    
    const { count: totalCodes } = await countQuery;
    console.log(`Total codes to export: ${totalCodes}`);
    
    // Fetch in chunks
    const allCodes = [];
    const chunkSize = 1000;
    const totalChunks = Math.ceil(totalCodes / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const from = i * chunkSize;
      const to = from + chunkSize - 1;
      
      let chunkQuery = supabase
        .from('codes')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true })
        .range(from, to);
      
      if (status) {
        chunkQuery = chunkQuery.eq('status', status);
      }
      
      const { data: chunk, error: chunkError } = await chunkQuery;
      
      if (chunkError) {
        console.error('Chunk fetch error:', chunkError);
        continue;
      }
      
      if (chunk && chunk.length > 0) {
        allCodes.push(...chunk);
      }
    }
    
    console.log(`Fetched ${allCodes.length} codes for CSV`);
    
    const codes = allCodes;

    // Generate CSV
    const csvContent = generateCSV(batch, codes || []);

    // Return CSV file
    const filename = status 
      ? `${batch.batch_id}-${status}-codes.csv`
      : `${batch.batch_id}-all-codes.csv`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      },
      body: csvContent
    };

  } catch (error) {
    console.error('CSV generation error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'CSV generation failed' })
    };
  }
};
