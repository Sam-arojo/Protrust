const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const SYNC_LIMIT = 60000;   // codes generated synchronously before returning response
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
        status: 'active'
      }])
      .select()
      .single();

    if (batchError) {
      console.error('Batch insert error:', batchError.message);
      return respond(500, { error: 'Failed to create batch', details: batchError.message });
    }

    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://qualitychek.netlify.app';
    const t0 = Date.now();

    // ── STEP 1: Always generate the first SYNC_LIMIT (60K) synchronously ──────
    const firstBatch = Math.min(qty, SYNC_LIMIT);
    console.log(`SYNC: generating first ${firstBatch} codes...`);

    const firstCodes = generateCodes(firstBatch);
    const firstRecords = buildRecords(firstCodes, batch.id, decoded.userId, siteUrl);
    const firstInserted = await insertCodes(firstRecords);

    // Update progress after first batch
    await supabase.from('batches').update({ codes_generated: firstInserted }).eq('id', batch.id);
    console.log(`SYNC done: ${firstInserted}/${qty} codes in ${((Date.now()-t0)/1000).toFixed(1)}s`);

    // ── STEP 2: If qty <= 60K we're done, return immediately ──────────────────
    if (qty <= SYNC_LIMIT) {
      return respond(201, {
        success: true,
        message: 'Batch created successfully!',
        batch: {
          id: batch.id,
          batch_id: batchId,
          product_name: productName,
          quantity: qty,
          codes_generated: firstInserted
        }
      });
    }

    // ── STEP 3: qty > 60K — fire background job for the remainder ─────────────
    const remaining = qty - firstInserted;
    console.log(`ASYNC: generating remaining ${remaining} codes in background...`);

    ;(async () => {
      try {
        // Generate remaining codes in large 20K chunks with full parallelism
        const BG_CHUNK = 20000;
        let total = firstInserted;

        for (let offset = 0; offset < remaining; offset += BG_CHUNK) {
          const size = Math.min(BG_CHUNK, remaining - offset);
          console.log(`BG: generating chunk of ${size} (total so far: ${total}/${qty})`);

          const codes = generateCodes(size);
          const records = buildRecords(codes, batch.id, decoded.userId, siteUrl);
          const inserted = await insertCodes(records);
          total += inserted;

          await supabase.from('batches').update({ codes_generated: total }).eq('id', batch.id);
          console.log(`BG progress: ${total}/${qty}`);
        }

        console.log(`BG complete: ${total}/${qty} total codes`);
      } catch (err) {
        console.error('BG generation error:', err.message);
      }
    })();

    // Return immediately — user already has 60K codes waiting
    return respond(201, {
      success: true,
      message: `Batch created! First ${firstInserted.toLocaleString()} codes are ready now. Remaining ${remaining.toLocaleString()} are being generated in the background.`,
      batch: {
        id: batch.id,
        batch_id: batchId,
        product_name: productName,
        quantity: qty,
        codes_generated: firstInserted   // 60K already done
      }
    });

  } catch (error) {
    console.error('Handler error:', error.message);
    return respond(500, { error: 'Server error', details: error.message });
  }
};
