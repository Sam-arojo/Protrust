import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auto-verify if code is in URL (from QR scan)
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode && !result) {
      setCode(urlCode);
      setTimeout(() => {
        handleVerify(urlCode);
      }, 500);
    }
  }, [searchParams]);

  const handleVerify = async (codeToVerify) => {
    const verifyCode = codeToVerify || code;
    
    if (!verifyCode) {
      alert('Please enter a verification code');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/verify?code=${encodeURIComponent(verifyCode.toUpperCase())}`, {
        method: 'GET'
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Verification error:', error);
      setResult({
        success: false,
        status: 'error',
        message: 'Verification failed. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnother = () => {
    setCode('');
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Card - Reduced from max-w-lg to max-w-md (25% smaller) */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-9">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img src="/logo.png" alt="QualityChek" className="h-20 w-20" />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              <span className="text-blue-900">Quality</span>
              <span className="text-green-600">Chek</span>
              <span className="text-gray-900"> Verify</span>
            </h1>
            <p className="text-gray-500 uppercase text-xs tracking-wide font-medium">
              Anti-Counterfeit Product Verification
            </p>
          </div>

          {!result ? (
            <>
              {/* Input Form */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Verification Code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
                      className="w-full pl-12 pr-4 py-4 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-wider font-mono uppercase placeholder-gray-400"
                      placeholder="ENTER CODE FROM PRODUCT"
                      maxLength="20"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleVerify()}
                  disabled={loading || !code}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Product
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* Alternative SMS Section */}
              <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  <span className="font-bold">Alternative:</span> Send code via SMS
                </p>
                <p className="text-sm text-gray-600">
                  Text the code to: <span className="font-bold text-blue-600 text-lg">12345</span>
                </p>
              </div>
            </>
          ) : result.status === 'success' ? (
            /* Success State */
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-green-800 mb-2">AUTHENTIC PRODUCT</h3>
                    <p className="text-green-700 font-medium mb-3">
                      AUTHENTIC PRODUCT - Successfully verified!<br />
                      This is a genuine product.
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">Product Name:</span> {result.productInfo?.productName || 'N/A'}
                      </p>
                      {result.productInfo?.productCode && (
                        <p className="text-sm text-green-800">
                          <span className="font-medium">Product Code:</span> {result.productInfo.productCode}
                        </p>
                      )}
                      <p className="text-sm text-green-800">
                        <span className="font-medium">Batch No:</span> {result.productInfo?.batchId || 'N/A'}
                      </p>
                      {result.productInfo?.manufacturingDate && (
                        <p className="text-sm text-green-800">
                          <span className="font-medium">Manufacturing Date:</span> {new Date(result.productInfo.manufacturingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      {result.productInfo?.expiringDate && (
                        <p className="text-sm text-green-800">
                          <span className="font-medium">Expiring Date:</span> {new Date(result.productInfo.expiringDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleVerifyAnother}
                className="w-full bg-gray-700 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Verify Another Product
              </button>
            </div>
          ) : (
            /* Duplicate/Fake State */
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border-l-4 border-red-600 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-red-800 mb-2">FAKE OR REUSED PRODUCT</h3>
                    <p className="text-red-700 font-medium mb-3">
                      <span className="font-bold">WARNING:</span> This product code has already been verified. This may be a <span className="font-bold">FAKE</span> or reused product!
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-sm text-red-800">
                        <span className="font-medium">Product Name:</span> {result.productInfo?.productName || 'N/A'}
                      </p>
                      {result.productInfo?.productCode && (
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Product Code:</span> {result.productInfo.productCode}
                        </p>
                      )}
                      <p className="text-sm text-red-800">
                        <span className="font-medium">Batch No:</span> {result.productInfo?.batchId || 'N/A'}
                      </p>
                      {result.productInfo?.manufacturingDate && (
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Manufacturing Date:</span> {new Date(result.productInfo.manufacturingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      {result.productInfo?.expiringDate && (
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Expiring Date:</span> {new Date(result.productInfo.expiringDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      <p className="text-sm text-red-800">
                        <span className="font-medium">First verified:</span> {result.productInfo?.firstVerifiedAt 
                          ? (() => {
                              // Ensure timestamp is treated as UTC by adding 'Z' if missing
                              let timestamp = result.productInfo.firstVerifiedAt;
                              if (timestamp && !timestamp.endsWith('Z') && !timestamp.includes('+')) {
                                timestamp = timestamp + 'Z';
                              }
                              
                              // Create date from UTC timestamp and format to local time
                              const date = new Date(timestamp);
                              const dateStr = date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                              const timeStr = date.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              });
                              return `${dateStr}, ${timeStr}`;
                            })()
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleVerifyAnother}
                className="w-full bg-gray-700 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Verify Another Product
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Powered by <span className="font-semibold"><span className="text-gray-900">Quality</span><span className="text-green-600">Chek</span></span>, a product of Flocode Technology Limited
            </p>
          </div>
        </div>

        {/* Bottom Shield Text */}
        {!result && (
          <div className="mt-6 flex items-center justify-center gap-2 text-gray-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-xs uppercase tracking-wide">Protecting consumers from counterfeit products</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyPage;
