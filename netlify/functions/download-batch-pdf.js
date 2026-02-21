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

// Generate simple HTML-based PDF content
function generatePDFHTML(batch, codes) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${batch.batch_id} - Verification Codes</title>
  <style>
    @page {
      size: A4;
      margin: 5mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      padding: 0;
      background: white;
      font-size: 9px;
    }
    .no-print {
      margin-bottom: 15px;
      padding: 12px;
      background: #2563eb;
      color: white;
      border-radius: 6px;
      text-align: center;
    }
    .no-print button {
      background: white;
      color: #2563eb;
      border: none;
      padding: 8px 16px;
      margin: 4px;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      font-weight: bold;
    }
    .no-print button:hover {
      background: #f0f0f0;
    }
    .first-page-only {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      page-break-after: always;
    }
    .first-page-header {
      padding: 40px;
    }
    .first-page-header h1 {
      margin: 0 0 20px 0;
      color: #2563eb;
      font-size: 28px;
      font-weight: bold;
    }
    .first-page-header p {
      color: #666;
      font-size: 14px;
      margin: 8px 0;
    }
    .batch-info-first {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin-top: 30px;
      border-left: 4px solid #2563eb;
      font-size: 12px;
      text-align: left;
      max-width: 500px;
    }
    .batch-info-first p {
      margin: 8px 0;
      line-height: 1.6;
      color: #1f2937;
    }
    .batch-info-first strong {
      color: #1f2937;
      min-width: 100px;
      display: inline-block;
      font-size: 12px;
    }
    .codes-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 2px;
      margin-bottom: 0;
    }
    .code-card {
      border: 1px solid #e5e7eb;
      border-radius: 2px;
      padding: 2px;
      text-align: center;
      page-break-inside: avoid;
      background: white;
    }
    .code-card .code {
      font-size: 7px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      color: #2563eb;
      letter-spacing: 0.2px;
      margin: 1px 0;
      padding: 1px;
      background: #eff6ff;
      border-radius: 2px;
      word-break: break-all;
      line-height: 1.0;
    }
    .code-card .qr-code {
      margin: 1px 0;
    }
    .code-card .qr-code img {
      width: 32px;
      height: 32px;
      border: 1px solid #d1d5db;
      border-radius: 2px;
      padding: 1px;
      background: white;
    }
    .page-break {
      page-break-after: always;
    }
    .page-number {
      text-align: center;
      margin-top: 3px;
      padding-top: 2px;
      color: #6b7280;
      font-size: 7px;
    }
    .footer {
      text-align: center;
      margin-top: 2px;
      padding-top: 2px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 6px;
      line-height: 1.2;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      .code-card {
        page-break-inside: avoid;
      }
      body {
        padding: 0;
        margin: 0;
      }
      .codes-grid {
        gap: 1px;
      }
      .footer {
        margin-top: 1px;
        padding-top: 1px;
      }
    }
  </style>
  <script>
    function printPage() {
      window.print();
    }
    function savePDF() {
      window.print();
    }
  </script>
</head>
<body>
  <div class="no-print">
    <h2 style="margin-bottom: 8px; font-size: 16px;">📄 Verification Codes Document</h2>
    <p style="margin-bottom: 12px; font-size: 12px;">Choose an option below:</p>
    <button onclick="printPage()">🖨️ Print Document</button>
    <button onclick="savePDF()">💾 Save as PDF</button>
    <p style="margin-top: 8px; font-size: 11px;">Tip: In the print dialog, select "Save as PDF" as your printer</p>
  </div>

  ${generateFirstPageOnly(batch, codes)}
  ${generateCodePages(codes)}
  
  <div class="footer">
    <p><strong>QualityChek Anti-Counterfeit Platform</strong> | Document created: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })} | ⚠️ Keep secure. Each code is unique.</p>
  </div>
</body>
</html>
  `;
}

// Generate first page with ONLY header - NO CODES
function generateFirstPageOnly(batch, codes) {
  return `
    <div class="first-page-only">
      <div class="first-page-header">
        <h1>🔒 QualityChek Verification Codes</h1>
        <p>Anti-Counterfeit Product Verification System</p>
        
        <div class="batch-info-first">
          <p><strong>Batch No:</strong> ${batch.batch_id}</p>
          <p><strong>Product Name:</strong> ${batch.product_name}</p>
          ${batch.product_code ? `<p><strong>Product Code:</strong> ${batch.product_code}</p>` : ''}
          <p><strong>Category:</strong> ${batch.product_category}</p>
          ${batch.manufacturing_date ? `<p><strong>Manufacturing Date:</strong> ${new Date(batch.manufacturing_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
          })}</p>` : ''}
          ${batch.expiring_date ? `<p><strong>Expiring Date:</strong> ${new Date(batch.expiring_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
          })}</p>` : ''}
          <p><strong>Total Codes:</strong> ${codes.length}</p>
          <p><strong>Created By:</strong> ${batch.manufacturer_email || 'N/A'}</p>
          <p><strong>Company:</strong> ${batch.manufacturer_company || 'N/A'}</p>
          <p><strong>Generated:</strong> ${new Date(batch.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
          })}</p>
        </div>
      </div>
    </div>
  `;
}

// Generate pages with 100 codes each (5 columns × 20 rows) - NO serial numbers, NO status
function generateCodePages(codes) {
  const codesPerPage = 100;
  const pages = [];
  let pageNumber = 2; // Start at 2 since page 1 is header
  
  for (let i = 0; i < codes.length; i += codesPerPage) {
    const pageCodes = codes.slice(i, i + codesPerPage);
    const isLastPage = i + codesPerPage >= codes.length;
    
    pages.push(`
      <div class="codes-grid">
        ${pageCodes.map((code) => `
          <div class="code-card">
            <div class="code">${code.code}</div>
            ${code.qr_code_url ? `
              <div class="qr-code">
                <img src="${code.qr_code_url}" alt="QR" onerror="this.style.display='none'" />
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      <div class="page-number">Page ${pageNumber} of ${Math.ceil(codes.length / codesPerPage) + 1}</div>
      ${!isLastPage ? '<div class="page-break"></div>' : ''}
    `);
    
    pageNumber++;
  }
  
  return pages.join('');
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

    // Get manufacturer's email
    const { data: manufacturer } = await supabase
      .from('users')
      .select('email, company_name')
      .eq('id', decoded.userId)
      .single();

    // Get all codes (fetch in chunks for large batches)
    console.log('Fetching codes for PDF generation...');
    
    const { count: totalCodes } = await supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId);
    
    console.log(`Total codes: ${totalCodes}`);
    
    const allCodes = [];
    const chunkSize = 1000;
    const totalChunks = Math.ceil(totalCodes / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const from = i * chunkSize;
      const to = from + chunkSize - 1;
      
      const { data: chunk, error: chunkError } = await supabase
        .from('codes')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true })
        .range(from, to);
      
      if (chunkError) {
        console.error('Chunk fetch error:', chunkError);
        continue;
      }
      
      if (chunk && chunk.length > 0) {
        allCodes.push(...chunk);
      }
    }
    
    console.log(`Fetched ${allCodes.length} codes for PDF`);
    
    const codes = allCodes;

    // Add manufacturer info to batch
    const batchWithManufacturer = {
      ...batch,
      manufacturer_email: manufacturer?.email || 'N/A',
      manufacturer_company: manufacturer?.company_name || 'N/A'
    };

    // Generate HTML for PDF
    const htmlContent = generatePDFHTML(batchWithManufacturer, codes || []);

    // Return HTML that browser can print as PDF
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${batch.batch_id}-codes.html"`,
        'Access-Control-Allow-Origin': '*'
      },
      body: htmlContent
    };

  } catch (error) {
    console.error('PDF generation error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'PDF generation failed' })
    };
  }
};
