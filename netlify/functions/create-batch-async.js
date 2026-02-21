const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Generate a single unique verification code
function generateCode(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  const bytes = crypto.randomBytes(length);
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  
  return code;
}

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

// Background code generation function (runs without waiting for response)
async function generateCodesInBackground(batch, quantity, userId) {
  try {
    console.log(`Background: Starting code generation for batch ${batch.id}, quantity: ${quantity}`);
    
    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://your-site.netlify.app';
    
    // Generate codes in chunks to manage memory
    const chunkSize = 5000;
    let totalGenerated = 0;
    
    for (let offset = 0; offset < quantity; offset += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, quantity - offset);
      console.log(`Background: Generating chunk ${offset}-${offset + currentChunkSize}...`);
      
      // Generate unique codes for this chunk
      const codesSet = new Set();
      let attempts = 0;
      const maxAttempts = currentChunkSize * 3;
      
      while (codesSet.size < currentChunkSize && attempts < maxAttempts) {
        const code = generateCode();
        codesSet.add(code);
        attempts++;
      }
      
      const codesArray = Array.from(codesSet);
      
      // Check if codes exist in database (batch check)
      const { data: existingCodes } = await supabase
        .from('codes')
        .select('code')
        .in('code', codesArray);
      
      const existingCodeSet = new Set((existingCodes || []).map(c => c.code));
      let finalCodes = codesArray.filter(code => !existingCodeSet.has(code));
      
      // Generate replacements for existing codes
      while (finalCodes.length < currentChunkSize) {
        const code = generateCode();
        if (!finalCodes.includes(code) && !existingCodeSet.has(code)) {
          finalCodes.push(code);
        }
      }
      
      // Prepare code records
      const codeRecords = finalCodes.map(code => ({
        code: code,
        batch_id: batch.id,
        manufacturer_id: userId,
        status: 'active',
        qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${siteUrl}/verify?code=${code}`)}`
      }));
      
      // Insert codes in smaller sub-chunks
      const insertChunkSize = 500;
      for (let i = 0; i < codeRecords.length; i += insertChunkSize) {
        const insertChunk = codeRecords.slice(i, i + insertChunkSize);
        
        const { error: insertError } = await supabase
          .from('codes')
          .insert(insertChunk);
        
        if (!insertError) {
          totalGenerated += insertChunk.length;
          
          // Update batch progress
          await supabase
            .from('batches')
            .update({ codes_generated: totalGenerated })
            .eq('id', batch.id);
          
          console.log(`Background: Inserted ${totalGenerated}/${quantity} codes`);
        } else {
          console.error(`Background: Insert error:`, insertError);
        }
      }
    }
    
    console.log(`Background: Completed! Generated ${totalGenerated} codes for batch ${batch.id}`);
    
  } catch (error) {
    console.error('Background code generation error:', error);
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
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

    const { productName, productCategory, quantity, notes } = JSON.parse(event.body);

    // Validate inputs
    if (!productName || !productCategory || !quantity) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    if (quantity < 1 || quantity > 100000) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Quantity must be between 1 and 100,000' })
      };
    }

    // Generate batch ID
    const batchId = `BN${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    console.log(`Creating batch ${batchId} for ${quantity} codes...`);

    // Create batch record immediately
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert([{
        batch_id: batchId,
        manufacturer_id: decoded.userId,
        product_name: productName,
        product_category: productCategory,
        quantity: quantity,
        codes_generated: 0, // Will be updated as codes are generated
        notes: notes || null,
        status: 'active'
      }])
      .select()
      .single();

    if (batchError) {
      console.error('Batch creation error:', batchError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Failed to create batch' })
      };
    }

    console.log(`Batch ${batch.id} created. Starting background code generation...`);

    // Start code generation in background (don't wait for it)
    generateCodesInBackground(batch, quantity, decoded.userId).catch(err => {
      console.error('Background generation failed:', err);
    });

    // Return immediately with batch info
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: quantity > 10000 
          ? `Batch created! Codes are being generated in the background. This may take a few minutes for ${quantity} codes. You can refresh the batch details page to see progress.`
          : 'Batch created successfully!',
        batch: {
          id: batch.id,
          batch_id: batch.batch_id,
          quantity: quantity,
          codes_generated: 0,
          status: 'generating' // Frontend can show loading state
        }
      })
    };

  } catch (error) {
    console.error('Create batch error:', error);
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
