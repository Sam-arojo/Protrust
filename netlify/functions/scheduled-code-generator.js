const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CHUNK_SIZE = 1000;    // rows per insert statement
const CONCURRENCY = 8;      // parallel insert operations
const CODES_PER_RUN = 10000; // Generate 10K codes per run (safe for 26s timeout)

// ── Generate N unique codes in pure memory
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

// ── Insert records with CONCURRENCY parallel supabase calls
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

exports.handler = async (event, context) => {
  console.log('[CRON] Starting scheduled code generation...');
  const startTime = Date.now();

  try {
    // ── Find all incomplete batches ──────────────────────────────────────────
    // Note: Supabase JS client doesn't support column-to-column comparison
    // So we fetch all 'generating' batches and filter in JavaScript
    const { data: allBatches, error: fetchError } = await supabase
      .from('batches')
      .select('id, batch_id, manufacturer_id, quantity, codes_generated')
      .eq('status', 'generating')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[CRON] Error fetching batches:', fetchError.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch incomplete batches' })
      };
    }

    if (!allBatches || allBatches.length === 0) {
      console.log('[CRON] No incomplete batches found. All done!');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No batches to process', processed: 0 })
      };
    }

    // Filter for batches that still need more codes
    const incompleteBatches = allBatches
      .filter(batch => batch.codes_generated < batch.quantity)
      .slice(0, 10); // Process up to 10 batches per run

    if (incompleteBatches.length === 0) {
      console.log('[CRON] All generating batches are complete.');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No batches to process', processed: 0 })
      };
    }

    console.log(`[CRON] Found ${incompleteBatches.length} incomplete batch(es)`);

    // ── Process each incomplete batch ────────────────────────────────────────
    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://qualitychek.netlify.app';
    let totalGenerated = 0;
    const results = [];

    for (const batch of incompleteBatches) {
      const remaining = batch.quantity - batch.codes_generated;
      const toGenerate = Math.min(CODES_PER_RUN, remaining);

      console.log(`[CRON] Batch ${batch.batch_id}: Generating ${toGenerate} codes (${batch.codes_generated}/${batch.quantity})`);

      try {
        // Generate codes
        const codes = generateCodes(toGenerate);
        const records = buildRecords(codes, batch.id, batch.manufacturer_id, siteUrl);
        const inserted = await insertCodes(records);

        // Update batch progress
        const newTotal = batch.codes_generated + inserted;
        const isComplete = newTotal >= batch.quantity;

        await supabase
          .from('batches')
          .update({
            codes_generated: newTotal,
            status: isComplete ? 'complete' : 'generating'
          })
          .eq('id', batch.id);

        totalGenerated += inserted;
        results.push({
          batch_id: batch.batch_id,
          generated: inserted,
          total: newTotal,
          target: batch.quantity,
          complete: isComplete
        });

        console.log(`[CRON] Batch ${batch.batch_id}: ${inserted} codes generated. Total: ${newTotal}/${batch.quantity} ${isComplete ? '✓ COMPLETE' : ''}`);

      } catch (err) {
        console.error(`[CRON] Error processing batch ${batch.batch_id}:`, err.message);
        results.push({
          batch_id: batch.batch_id,
          error: err.message
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[CRON] Completed in ${elapsed}s. Total codes generated: ${totalGenerated}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: incompleteBatches.length,
        totalGenerated,
        elapsed: `${elapsed}s`,
        results
      })
    };

  } catch (error) {
    console.error('[CRON] Fatal error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Scheduled generation failed', 
        details: error.message 
      })
    };
  }
};
