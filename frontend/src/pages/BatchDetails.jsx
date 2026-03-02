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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading batch details...</div>
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
