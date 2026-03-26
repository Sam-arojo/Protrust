const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-in-production');
  } catch (error) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF GENERATION
// Exactly mirrors the HTML template:
//   Cover page  — centered title + subtitle + info card (left blue border)
//   Code pages  — 5 columns × 14 rows = 70 codes per page
//                 code text:  7px Courier Bold, #2563eb on #eff6ff background
//                 QR image:   40px CSS = 30pt PDF
//                 cell border: 1px #e5e7eb
//   Page number — centered bottom, 7px #6b7280
//   Footer      — same text as HTML template
// ─────────────────────────────────────────────────────────────────────────────
async function generatePDF(batch, codes) {
  // Pre-generate all QR buffers before building the PDF
  console.log(`Pre-generating ${codes.length} QR codes...`);
  const qrBuffers = [];
  for (let i = 0; i < codes.length; i++) {
    const urlToEncode = codes[i].verification_url || codes[i].code;
    try {
      const buf = await QRCode.toBuffer(urlToEncode, {
        errorCorrectionLevel: 'M',
        width: 80,   // 80px source renders crisply at 30pt (= 40px CSS)
        margin: 1,
        type: 'png',
        color: { dark: '#000000', light: '#ffffff' }
      });
      qrBuffers.push(buf);
    } catch (e) {
      qrBuffers.push(null);
    }
    if ((i + 1) % 5000 === 0) {
      console.log(`  QR progress: ${i + 1} / ${codes.length}`);
    }
  }
  console.log('QR generation done. Building PDF...');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Page dimensions (points — 1mm = 2.835pt) ─────────────────────
      const pageW    = 595.28;
      const pageH    = 841.89;
      const margin   = 28.35;               // 10mm
      const contentW = pageW - 2 * margin;  // 538.58pt

      // ── Code page grid ────────────────────────────────────────────────
      const codesPerRow  = 5;
      const codesPerPage = 70;               // 5 × 14
      const rows         = 14;
      const gap          = 1.5;              // 2px gap → 1.5pt

      // Cell width — 5 columns filling content width exactly
      const cellW = (contentW - (codesPerRow - 1) * gap) / codesPerRow; // ~106.5pt

      // Reserve bottom space for page number
      const pageNumH = 12;
      const availH   = pageH - 2 * margin - pageNumH;
      const cellH    = (availH - (rows - 1) * gap) / rows;              // ~52.6pt

      // QR: 40px CSS = 40 × (72/96) = 30pt PDF
      const qrPt       = 30;
      const codeFontPt = 5.25;              // 7px → 5.25pt
      const codeRowH   = codeFontPt + 3;    // text row height inc. padding

      // ── Colours (exact HTML values) ───────────────────────────────────
      const BLUE        = '#2563eb';
      const LIGHT_BLUE  = '#eff6ff';
      const GRAY_BG     = '#f3f4f6';
      const DARK_TEXT   = '#1f2937';
      const MID_GRAY    = '#6b7280';
      const BORDER      = '#e5e7eb';
      const QR_BORDER   = '#d1d5db';
      const GRAY_666    = '#666666';

      const totalCodePages = Math.ceil(codes.length / codesPerPage);
      const totalPages     = totalCodePages + 1; // +1 for cover

      // ── COVER PAGE ────────────────────────────────────────────────────
      doc.addPage();

      // Info lines — same fields as generateFirstPageOnly()
      const infoLines = [
        ['Batch No:',      batch.batch_id],
        ['Product Name:',  batch.product_name],
        ...(batch.product_code      ? [['Product Code:',   batch.product_code]] : []),
        ['Category:',      batch.product_category || 'N/A'],
        ...(batch.manufacturing_date ? [['Mfg Date:', new Date(batch.manufacturing_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })]] : []),
        ...(batch.expiring_date      ? [['Expiring Date:', new Date(batch.expiring_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })]] : []),
        ['Total Codes:',   codes.length.toLocaleString()],
        ['Created By:',    batch.manufacturer_email   || 'N/A'],
        ['Company:',       batch.manufacturer_company || 'N/A'],
        ['Generated:',     new Date(batch.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      ];

      const cardPad   = 15;
      const lineH     = 18;
      const cardW     = Math.min(375, contentW);
      const cardH     = cardPad * 2 + infoLines.length * lineH;

      // Font sizes: 28px → 21pt, 14px → 10.5pt
      const titlePt    = 21;
      const subtitlePt = 10.5;

      // Vertically centre the whole block
      const blockH = titlePt + 8 + subtitlePt + 22 + cardH;
      let y = (pageH - blockH) / 2;

      // Title
      doc.fillColor(BLUE).fontSize(titlePt).font('Helvetica-Bold')
        .text('QualityChek Verification Codes', margin, y,
          { width: contentW, align: 'center', lineBreak: false });
      y += titlePt + 8;

      // Subtitle
      doc.fillColor(GRAY_666).fontSize(subtitlePt).font('Helvetica')
        .text('Anti-Counterfeit Product Verification System', margin, y,
          { width: contentW, align: 'center', lineBreak: false });
      y += subtitlePt + 22;

      // Card (centred horizontally)
      const cardX = (pageW - cardW) / 2;

      // Background fill
      doc.rect(cardX, y, cardW, cardH).fill(GRAY_BG);

      // Left blue border strip (4px → 3pt)
      doc.rect(cardX, y, 3, cardH).fill(BLUE);

      // Info rows
      const labelW = 100;
      const valueX = cardX + 15 + labelW + 4;
      const valueW = cardW - cardPad - labelW - 10;
      let ry = y + cardPad;

      infoLines.forEach(([label, value]) => {
        doc.fillColor(DARK_TEXT).fontSize(9).font('Helvetica-Bold')
          .text(label, cardX + 15, ry, { width: labelW, lineBreak: false });
        doc.fillColor(DARK_TEXT).fontSize(9).font('Helvetica')
          .text(String(value), valueX, ry, { width: valueW, lineBreak: false });
        ry += lineH;
      });

      // ── CODE PAGES ────────────────────────────────────────────────────
      for (let i = 0; i < codes.length; i++) {
        const indexOnPage = i % codesPerPage;

        // New page
        if (indexOnPage === 0) {
          doc.addPage();
          const pageNum = Math.floor(i / codesPerPage) + 2;

          // Page number drawn immediately at bottom
          doc.fillColor(MID_GRAY).fontSize(5.25).font('Helvetica')
            .text(
              `Page ${pageNum} of ${totalPages}`,
              margin, pageH - margin - pageNumH + 2,
              { width: contentW, align: 'center', lineBreak: false }
            );
        }

        const row = Math.floor(indexOnPage / codesPerRow);
        const col = indexOnPage % codesPerRow;

        const cx = margin + col * (cellW + gap);
        const cy = margin + row * (cellH + gap);

        // Cell border — 1px #e5e7eb
        doc.rect(cx, cy, cellW, cellH).stroke(BORDER);

        // Code text background (#eff6ff)
        doc.rect(cx + 0.5, cy + 0.5, cellW - 1, codeRowH).fill(LIGHT_BLUE);

        // Code text — Courier Bold, 7px (#2563eb)
        doc.fillColor(BLUE).fontSize(codeFontPt).font('Courier-Bold')
          .text(codes[i].code, cx + 1, cy + 1.5,
            { width: cellW - 2, align: 'center', lineBreak: false });

        // QR image — centred in remaining cell space
        const qrX = cx + (cellW - qrPt) / 2;
        const qrY = cy + codeRowH + 2;

        if (qrBuffers[i]) {
          // QR border (1px #d1d5db)
          doc.rect(qrX - 0.5, qrY - 0.5, qrPt + 1, qrPt + 1).stroke(QR_BORDER);
          doc.image(qrBuffers[i], qrX, qrY, { width: qrPt, height: qrPt });
        } else {
          // Fallback placeholder
          doc.rect(qrX, qrY, qrPt, qrPt).fill('#f1f5f9');
        }
      }

      // ── Footer — last code page, same text as HTML template ───────────
      const footerY = pageH - margin - pageNumH - 9;
      doc.fillColor(MID_GRAY).fontSize(4.5).font('Helvetica')
        .text(
          `QualityChek Anti-Counterfeit Platform | Document created: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} | Keep secure. Each code is unique.`,
          margin, footerY,
          { width: contentW, align: 'center', lineBreak: false }
        );

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const decoded = verifyToken(event.headers.authorization);
    if (!decoded) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const batchId = event.queryStringParameters?.batchId;
    if (!batchId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Batch ID required' }) };
    }

    // Batch details
    const { data: batch, error: batchError } = await supabase
      .from('batches').select('*')
      .eq('id', batchId).eq('manufacturer_id', decoded.userId).single();

    if (batchError || !batch) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Batch not found' }) };
    }

    // Manufacturer info
    const { data: manufacturer } = await supabase
      .from('users').select('email, company_name')
      .eq('id', decoded.userId).single();

    // Fetch all codes in chunks
    console.log('Fetching codes for PDF generation...');
    const { count: totalCodes } = await supabase
      .from('codes').select('*', { count: 'exact', head: true }).eq('batch_id', batchId);

    console.log(`Total codes: ${totalCodes}`);

    const allCodes = [];
    const chunkSize = 1000;
    for (let i = 0; i < Math.ceil(totalCodes / chunkSize); i++) {
      const from = i * chunkSize;
      const { data: chunk, error: chunkError } = await supabase
        .from('codes').select('*').eq('batch_id', batchId)
        .order('created_at', { ascending: true })
        .range(from, from + chunkSize - 1);
      if (!chunkError && chunk?.length > 0) allCodes.push(...chunk);
    }

    console.log(`Fetched ${allCodes.length} codes.`);

    // Attach manufacturer fields (mirrors batchWithManufacturer in HTML version)
    const batchWithManufacturer = {
      ...batch,
      manufacturer_email:   manufacturer?.email         || 'N/A',
      manufacturer_company: manufacturer?.company_name  || 'N/A',
    };

    // Generate PDF
    const pdfBuffer = await generatePDF(batchWithManufacturer, allCodes);
    console.log(`PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Upload to Supabase Storage (same bucket as HTML version)
    const fileName = `batch-${batchId}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('batch-documents')
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Signed URL — 1 hour
    const { data: signedData, error: signedError } = await supabase.storage
      .from('batch-documents').createSignedUrl(fileName, 3600);

    if (signedError) throw new Error(`Signed URL failed: ${signedError.message}`);

    console.log('PDF ready.');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        downloadUrl: signedData.signedUrl,
        fileName: `${batch.batch_id}-verification-codes.pdf`,
        totalCodes: allCodes.length
      })
    };

  } catch (error) {
    console.error('PDF generation error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'PDF generation failed: ' + error.message })
    };
  }
};
