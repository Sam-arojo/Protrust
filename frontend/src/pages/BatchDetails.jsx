import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function BatchDetails() {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [codes, setCodes] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'verified'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);
  
  // Pagination state (server-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Counts from server
  const [activeCount, setActiveCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  
  // Get current tab total count
  const getCurrentTabTotal = () => {
    if (activeTab === 'active') return activeCount;
    if (activeTab === 'verified') return verifiedCount;
    return batch?.codes_generated || 0;
  };
  
  // Reset to page 1 when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };
  
  const goToPage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Refetch when page or tab changes
  useEffect(() => {
    setLoading(true);
    fetchBatchDetails();
  }, [id, currentPage, activeTab]);

  const fetchBatchDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Build query parameters
      const params = new URLSearchParams({
        batchId: id,
        page: currentPage.toString(),
        pageSize: '1000'
      });

      // Add status filter if not showing all codes
      if (activeTab === 'active') {
        params.append('status', 'active');
      } else if (activeTab === 'verified') {
        params.append('status', 'verified');
      }

      const response = await fetch(`/api/get-batch-details?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch batch details');
      }

      setBatch(data.batch);
      setCodes(data.codes || []);
      
      // Update total pages from server response
      setTotalPages(data.pagination?.totalPages || 1);
      
      // Update tab counts
      setActiveCount(data.counts?.active || 0);
      setVerifiedCount(data.counts?.verified || 0);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/download-batch-pdf?batchId=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get the HTML content
      const htmlContent = await response.text();
      
      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
    } catch (err) {
      alert('Failed to generate document: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCSV = async () => {
    setDownloadingCSV(true);
    try {
      const token = localStorage.getItem('token');
      
      // Build URL with status filter if not 'all'
      let url = `/api/download-batch-csv?batchId=${id}`;
      if (activeTab !== 'all') {
        url += `&status=${activeTab}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get the CSV content
      const csvContent = await response.text();
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      const filename = activeTab === 'all' 
        ? `${batch?.batch_id || 'batch'}-all-codes.csv`
        : `${batch?.batch_id || 'batch'}-${activeTab}-codes.csv`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
    } catch (err) {
      alert('Failed to download CSV: ' + err.message);
    } finally {
      setDownloadingCSV(false);
    }
  };

  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <style>{`
          @keyframes qc-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.18); opacity: 0.75; }
          }
          .qc-logo-pulse {
            animation: qc-pulse 1.4s ease-in-out infinite;
          }
        `}</style>
        <img
          src="data:image/png;base64,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"
          alt="Qualitychek"
          className="qc-logo-pulse"
          style={{ width: '64px', height: '64px', objectFit: 'contain' }}
        />
        <div className="text-gray-500 text-sm font-medium tracking-wide">Loading batch details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <Link to="/batches" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Batches
          </Link>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <Link to="/batches" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to All Batches
        </Link>

        <div className="bg-white rounded-lg shadow p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{batch?.product_name}</h2>
              <p className="text-sm text-gray-600 mt-1">Batch ID: {batch?.batch_id}</p>
              {batch?.product_code && (
                <p className="text-sm text-gray-600 mt-1">Product Code: {batch.product_code}</p>
              )}
              {batch?.manufacturing_date && (
                <p className="text-sm text-gray-600 mt-1">
                  Manufacturing Date: {new Date(batch.manufacturing_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              )}
              {batch?.expiring_date && (
                <p className="text-sm text-gray-600 mt-1">
                  Expiring Date: {new Date(batch.expiring_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              )}
              <div className="flex gap-3 mt-2">
                <span className="text-xs text-gray-600">
                  <strong>Active:</strong> {activeCount}
                </span>
                <span className="text-xs text-gray-600">
                  <strong>Verified:</strong> {verifiedCount}
                </span>
                <span className="text-xs text-gray-600">
                  <strong>Total:</strong> {batch?.codes_generated || 0}
                </span>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-2">
              <button
                onClick={handleDownloadCSV}
                disabled={downloadingCSV || !batch?.codes_generated}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {downloadingCSV ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading || codes.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {downloading ? 'Opening...' : 'Print / PDF'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Category</div>
              <div className="text-lg font-semibold capitalize">{batch?.product_category}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Codes</div>
              <div className="text-lg font-semibold">{batch?.codes_generated?.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Status</div>
              <div className="text-lg font-semibold capitalize">
                {batch?.status === 'generating' ? (
                  <span className="text-blue-600 animate-pulse">
                    Generating... {Math.round((batch.codes_generated / batch.quantity) * 100)}%
                  </span>
                ) : batch?.status === 'active' || batch?.status === 'complete' ? (
                  <span className="text-green-600">Complete</span>
                ) : (
                  batch?.status
                )}
              </div>
              {batch?.status === 'generating' && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all" 
                    style={{ width: `${Math.round((batch.codes_generated / batch.quantity) * 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Created</div>
              <div className="text-lg font-semibold">
                {batch?.created_at ? new Date(batch.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 sm:p-8">
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => handleTabChange('all')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Codes ({batch?.codes_generated || 0})
              </button>
              <button
                onClick={() => handleTabChange('active')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'active'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                onClick={() => handleTabChange('verified')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'verified'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Verified ({verifiedCount})
              </button>
            </nav>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Verification Codes & QR Codes
            {totalPages > 1 && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                (Page {currentPage} of {totalPages})
              </span>
            )}
          </h3>

          {codes.length === 0 ? (
            <p className="text-gray-600">No {activeTab === 'all' ? '' : activeTab} codes found.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {codes.map((code, index) => (
                  <div key={code.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="text-center mb-2">
                      <div className="text-xs text-gray-500 mb-1">#{((currentPage - 1) * 1000) + index + 1}</div>
                      <div className="text-lg font-mono font-bold text-blue-600 mb-2 break-all">
                        {code.code}
                      </div>
                      <div className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        code.status === 'verified' 
                          ? 'bg-green-100 text-green-800' 
                          : code.status === 'flagged'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {code.status}
                      </div>
                    </div>
                    
                    {code.qr_code_url && (
                      <div className="flex justify-center mb-2">
                        <img 
                          src={code.qr_code_url} 
                          alt={`QR Code for ${code.code}`}
                          className="w-24 h-24 border border-gray-300 rounded"
                        />
                      </div>
                    )}
                    
                    {code.verified_at && (
                      <div className="text-xs text-gray-500 text-center">
                        {new Date(code.verified_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{((currentPage - 1) * 1000) + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(currentPage * 1000, getCurrentTabTotal())}</span> of{' '}
                        <span className="font-medium">{getCurrentTabTotal()}</span> codes
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                        <button
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:bg-gray-100"
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 7) {
                            pageNum = i + 1;
                          } else if (currentPage <= 4) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 3) {
                            pageNum = totalPages - 6 + i;
                          } else {
                            pageNum = currentPage - 3 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                currentPage === pageNum
                                  ? 'z-10 bg-blue-600 text-white focus:z-20'
                                  : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:bg-gray-100"
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchDetails;
