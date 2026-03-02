const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const SYNC_LIMIT = 10000;   // Generate 10K codes immediately (safe for all tiers)
const CHUNK_SIZE = 1000;    // rows per insert statement
const CONCURRENCY = 8;      // parallel insert operations at once

// ── Generate N unique codes in pure memory (no DB round-trip needed)
// 30 chars ^ 12 digits = 531 trillion combinations → collision rate negligible
function generateCodes(qty) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const set = new Set();
  while (set.size < qty) {
    const bytes = crypto.randomBytes(12);
    let code = '';
    for (let i = 0; i < 12; i++) code += chars[bytes[i] % 30];
    set.add(code);
  }
  return Array.from(set);
}

// ── Insert records with CONCURRENCY parallel supabase calls for max speed
async function insertCodes(records) {
  const chunks = [];
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    chunks.push(records.slice(i, i + CHUNK_SIZE));
  }

  let inserted = 0;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(c => supabase.from('codes').insert(c)));
    results.forEach((r, idx) => {
      if (!r.error) inserted += batch[idx].length;
      else console.error('Insert error:', r.error.message);
    });
  }
  return inserted;
}

function buildRecords(codes, batchUUID, manufacturerId, siteUrl) {
  return codes.map(code => ({
    code,
    batch_id: batchUUID,
    manufacturer_id: manufacturerId,
    status: 'active',
    qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${siteUrl}/verify?code=${code}`)}`
  }));
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.substring(7), process.env.JWT_SECRET || 'default-secret-change-in-production');
  } catch { return null; }
}

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  try {
    const decoded = verifyToken(event.headers.authorization);
    if (!decoded) return respond(401, { error: 'Unauthorized' });

    const { productName, productCategory, quantity, customBatchId, productCode, manufacturingDate, expiringDate } = JSON.parse(event.body);

    if (!productName || !productCategory || !quantity) {
      return respond(400, { error: 'Missing required fields: productName, productCategory, quantity' });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100000) {
      return respond(400, { error: 'Quantity must be between 1 and 100,000' });
    }

    // ── Batch ID ───────────────────────────────────────────────────────────────
    let batchId;
    if (customBatchId && customBatchId.trim()) {
      batchId = customBatchId.trim();
      if (!/^[A-Za-z0-9\-_]+$/.test(batchId)) {
        return respond(400, { error: 'Batch ID can only contain letters, numbers, dashes and underscores' });
      }
      const { data: exists } = await supabase
        .from('batches').select('id').eq('batch_id', batchId).maybeSingle();
      if (exists) {
        return respond(400, { error: `Batch ID "${batchId}" already exists. Use a different ID or leave empty to auto-generate.` });
      }
    } else {
      batchId = `BN${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Math.random().toString(36).substr(2,6).toUpperCase()}`;
    }

    // ── Create batch record ────────────────────────────────────────────────────
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert([{
        batch_id: batchId,
        manufacturer_id: decoded.userId,
        product_name: productName,
        product_code: productCode || null,
        product_category: productCategory,
        quantity: qty,
        manufacturing_date: manufacturingDate || null,
        expiring_date: expiringDate || null,
        codes_generated: 0,
        status: 'generating'  // Mark as generating - cron job will complete
      }])
      .select()
      .single();

    if (batchError) {
      console.error('Batch insert error:', batchError.message);
      return respond(500, { error: 'Failed to create batch', details: batchError.message });
    }

    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://qualitychek.netlify.app';
    const t0 = Date.now();

    // ── Generate initial batch (up to 5K codes) synchronously ─────────────────
    const initialBatch = Math.min(qty, SYNC_LIMIT);
    console.log(`Generating initial ${initialBatch} codes for batch ${batchId}...`);

    const codes = generateCodes(initialBatch);
    const records = buildRecords(codes, batch.id, decoded.userId, siteUrl);
    const inserted = await insertCodes(records);

    // Update progress and status
    const isComplete = inserted >= qty;
    await supabase.from('batches').update({ 
      codes_generated: inserted,
      status: isComplete ? 'complete' : 'generating'
    }).eq('id', batch.id);
    
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`Initial batch done: ${inserted}/${qty} codes in ${elapsed}s`);

    // Return response
    if (isComplete) {
      // All codes generated immediately
      return respond(201, {
        success: true,
        message: 'Batch created successfully! All codes generated.',
        batch: {
          id: batch.id,
          batch_id: batchId,
          product_name: productName,
          quantity: qty,
          codes_generated: inserted,
          status: 'complete'
        }
      });
    } else {
      // More codes to be generated by scheduled function
      const remaining = qty - inserted;
      return respond(201, {
        success: true,
        message: `Batch created! ${inserted.toLocaleString()} codes ready. Remaining ${remaining.toLocaleString()} codes will be generated shortly.`,
        batch: {
          id: batch.id,
          batch_id: batchId,
          product_name: productName,
          quantity: qty,
          codes_generated: inserted,
          status: 'generating'
        }
      });
    }

  } catch (error) {
    console.error('Handler error:', error.message);
    return respond(500, { error: 'Server error', details: error.message });
  }
};
