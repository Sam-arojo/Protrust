const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Function to get geolocation from IP address
async function getIpLocation(ipAddress) {
  console.log(`[GEOLOCATION] Starting lookup for IP: ${ipAddress}`);
  
  // Extract first IP if multiple IPs separated by comma (x-forwarded-for can have multiple)
  let cleanIp = ipAddress;
  if (ipAddress && ipAddress.includes(',')) {
    cleanIp = ipAddress.split(',')[0].trim();
    console.log(`[GEOLOCATION] Multiple IPs detected, using first: ${cleanIp}`);
  }
  
  if (!cleanIp || cleanIp === 'unknown' || cleanIp === '::1' || cleanIp.startsWith('127.')) {
    console.log(`[GEOLOCATION] Skipping localhost/unknown IP: ${cleanIp}`);
    return null;
  }

  try {
    console.log(`[GEOLOCATION] Calling ip-api.com for: ${cleanIp}`);
    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone`);
    
    if (!response.ok) {
      console.error(`[GEOLOCATION] API request failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[GEOLOCATION] API response:`, JSON.stringify(data));
    
    if (data.status === 'success') {
      const locationData = {
        city: data.city || '',
        region: data.regionName || '',
        state: data.regionName || '',
        country: data.country || '',
        countryCode: data.countryCode || '',
        lat: data.lat || 0,
        lon: data.lon || 0,
        timezone: data.timezone || ''
      };
      console.log(`[GEOLOCATION] Returning location data:`, JSON.stringify(locationData));
      return locationData;
    } else {
      console.error(`[GEOLOCATION] API returned status: ${data.status}, message: ${data.message || 'none'}`);
    }
    
    return null;
  } catch (error) {
    console.error(`[GEOLOCATION] Error during lookup:`, error.message);
    return null;
  }
}

exports.handler = async (event, context) => {
  // Allow GET and POST
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get code from query params (GET) or body (POST)
    let code;
    if (event.httpMethod === 'GET') {
      code = event.queryStringParameters?.code;
    } else {
      const body = JSON.parse(event.body);
      code = body.code;
    }

    if (!code) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Verification code required' })
      };
    }

    // Clean and uppercase the code
    const cleanCode = code.trim().toUpperCase();

    console.log('Verifying code:', cleanCode);

    // Look up code in database with batch information
    const { data: codeRecord, error: lookupError } = await supabase
      .from('codes')
      .select(`
        *,
        batches (
          product_name,
          product_code,
          batch_id,
          product_category,
          manufacturing_date,
          expiring_date
        )
      `)
      .eq('code', cleanCode)
      .single();

    // Code doesn't exist
    if (lookupError || !codeRecord) {
      console.log('Code not found:', cleanCode);
      
      // Get IP address and geolocation
      const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
      console.log(`[VERIFY] Getting geolocation for invalid code, IP: ${ipAddress}`);
      
      const ipLocation = await getIpLocation(ipAddress);
      console.log(`[VERIFY] Geolocation result:`, ipLocation ? JSON.stringify(ipLocation) : 'null');
      
      // Log verification attempt (no manufacturer_id/batch_id for invalid codes)
      const insertData = {
        code: cleanCode,
        method: 'qr',
        result: 'invalid',
        ip_address: ipAddress,
        ip_location: ipLocation,
        manufacturer_id: null,  // Unknown manufacturer for invalid code
        batch_id: null          // Unknown batch for invalid code
      };
      console.log(`[VERIFY] Inserting verification with data:`, JSON.stringify(insertData));
      
      await supabase.from('verifications').insert([insertData]);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          status: 'invalid',
          message: '✗ INVALID CODE - Not found in our system. Possible fake product!'
        })
      };
    }

    console.log('Code found:', codeRecord);

    // Code already verified (DUPLICATE - FAKE ALERT!)
    if (codeRecord.status === 'verified') {
      console.log('Code already verified - duplicate attempt');
      
      // Get IP address and geolocation
      const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
      console.log(`[VERIFY] Getting geolocation for duplicate code, IP: ${ipAddress}`);
      
      const ipLocation = await getIpLocation(ipAddress);
      console.log(`[VERIFY] Geolocation result:`, ipLocation ? JSON.stringify(ipLocation) : 'null');
      
      // Log duplicate attempt with manufacturer_id and batch_id
      const insertData = {
        code: cleanCode,
        method: 'qr',
        result: 'duplicate',
        ip_address: ipAddress,
        ip_location: ipLocation,
        manufacturer_id: codeRecord.manufacturer_id,  // Store for efficient queries
        batch_id: codeRecord.batch_id                 // Store for efficient queries
      };
      console.log(`[VERIFY] Inserting duplicate verification:`, JSON.stringify(insertData));
      
      await supabase.from('verifications').insert([insertData]);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          status: 'duplicate',
          message: '⚠ WARNING: This product code has already been verified. This may be a FAKE or reused product!',
          productInfo: {
            productName: codeRecord.batches?.product_name,
            productCode: codeRecord.batches?.product_code,
            batchId: codeRecord.batches?.batch_id,
            manufacturingDate: codeRecord.batches?.manufacturing_date,
            expiringDate: codeRecord.batches?.expiring_date,
            firstVerifiedAt: codeRecord.verified_at
          }
        })
      };
    }

    // Code is ACTIVE - Verify it now!
    console.log('Code is active - marking as verified');
    
    const now = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('codes')
      .update({
        status: 'verified',
        verified_at: now,
        verification_method: 'qr'
      })
      .eq('code', cleanCode)
      .eq('status', 'active'); // Only update if still active (prevent race conditions)

    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('Code successfully marked as verified');
    }

    // Get IP address and geolocation
    const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    console.log(`[VERIFY] Getting geolocation for successful verification, IP: ${ipAddress}`);
    
    const ipLocation = await getIpLocation(ipAddress);
    console.log(`[VERIFY] Geolocation result:`, ipLocation ? JSON.stringify(ipLocation) : 'null');

    // Log successful verification with manufacturer_id and batch_id
    const insertData = {
      code: cleanCode,
      method: 'qr',
      result: 'success',
      ip_address: ipAddress,
      ip_location: ipLocation,
      manufacturer_id: codeRecord.manufacturer_id,  // Store for efficient queries
      batch_id: codeRecord.batch_id                 // Store for efficient queries
    };
    console.log(`[VERIFY] Inserting success verification:`, JSON.stringify(insertData));
    
    await supabase.from('verifications').insert([insertData]);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        status: 'success',
        message: '✓ AUTHENTIC PRODUCT - Successfully verified! This is a genuine product.',
        productInfo: {
          productName: codeRecord.batches?.product_name,
          productCode: codeRecord.batches?.product_code,
          category: codeRecord.batches?.product_category,
          batchId: codeRecord.batches?.batch_id,
          manufacturingDate: codeRecord.batches?.manufacturing_date,
          expiringDate: codeRecord.batches?.expiring_date,
          verifiedAt: now
        }
      })
    };

  } catch (error) {
    console.error('Verification error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        status: 'error',
        message: 'Verification system error. Please try again.' 
      })
    };
  }
};
