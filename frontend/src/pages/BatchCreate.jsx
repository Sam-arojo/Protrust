import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

function BatchCreate() {
  const [formData, setFormData] = useState({
    batchNumber: '',
    productName: '',
    productCode: '',
    productCategory: 'electronics',
    quantity: '',
    manufacturingDate: '',
    expiringDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    setLoading(true);

    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const requestBody = {
        customBatchId: formData.batchNumber.trim() || null,
        productName: formData.productName,
        productCode: formData.productCode.trim() || null,
        productCategory: formData.productCategory,
        quantity: parseInt(formData.quantity),
        manufacturingDate: formData.manufacturingDate || null,
        expiringDate: formData.expiringDate || null
      };

      console.log('Creating batch:', requestBody);

      const response = await fetch('/api/create-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      console.log('Response status:', response.status);
      console.log('Response data:', data);

      if (!response.ok) {
        // Show detailed error from backend
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Batch creation failed');
        throw new Error(errorMsg);
      }

      setSuccess(data);
      
      // Redirect to batches list after 3 seconds
      setTimeout(() => {
        navigate('/batches');
      }, 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to Dashboard
        </Link>

        <div className="bg-white rounded-lg shadow p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Batch</h2>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Number (Optional)
                </label>
                <input
                  type="text"
                  name="batchNumber"
                  value={formData.batchNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., BATCH-2024-001, LOT-A123, MFG-456"
                />
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Optional:</strong> Enter your existing batch/lot number. Can contain letters, numbers, dashes (-), and underscores (_). If left empty, a unique ID will be auto-generated (e.g., BN20260216ABC).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Pain Relief Tablets"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Code
                </label>
                <input
                  type="text"
                  name="productCode"
                  value={formData.productCode}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., PRD-12345, SKU-ABC"
                />
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Optional:</strong> Your internal product code or SKU number.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Category *
                </label>
                <select
                  name="productCategory"
                  value={formData.productCategory}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="electronics">Electronics</option>
                  <option value="pharmaceuticals">Pharmaceuticals</option>
                  <option value="fashion">Fashion/Apparel</option>
                  <option value="food-beverage">Food & Beverage</option>
                  <option value="cosmetics">Cosmetics</option>
                  <option value="automotive">Automotive</option>
                  <option value="luxury-goods">Luxury Goods</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity (Number of Codes) *
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  required
                  min="1"
                  max="100000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1000"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Maximum 100,000 codes per batch (recommended: batches under 10,000 generate faster)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manufacturing Date
                </label>
                <input
                  type="date"
                  name="manufacturingDate"
                  value={formData.manufacturingDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Optional:</strong> Date when the product was manufactured.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiring Date
                </label>
                <input
                  type="date"
                  name="expiringDate"
                  value={formData.expiringDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Optional:</strong> Date when the product expires (for FMCG products).
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Creating Batch...' : 'Generate Verification Codes'}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <svg className="w-16 h-16 text-green-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-green-900 mb-1">
                  Batch Created Successfully!
                </h3>
                <p className="text-green-800 font-semibold text-lg mb-4">
                  {success.batch?.batch_id} — {success.batch?.product_name}
                </p>
                <div className="bg-white rounded-lg p-4 text-left space-y-2 border border-green-100">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Batch ID:</span> {success.batch?.batch_id}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Product:</span> {success.batch?.product_name}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Quantity:</span> {success.batch?.quantity?.toLocaleString()} codes
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Ready now:</span>{' '}
                    <span className="text-green-700 font-medium">
                      {success.batch?.codes_generated?.toLocaleString()} codes ✓
                    </span>
                  </p>
                  {success.batch?.codes_generated < success.batch?.quantity && (
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">Remaining:</span>{' '}
                      <span className="text-amber-700 font-medium">
                        {(success.batch?.quantity - success.batch?.codes_generated).toLocaleString()} generating in background
                      </span>
                    </p>
                  )}
                </div>
                {success.batch?.codes_generated < success.batch?.quantity && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                    ⏳ Open the batch details and refresh to track background generation progress.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Link
                  to="/batches"
                  className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  View All Batches
                </Link>
                <button
                  onClick={() => {
                    setSuccess(null);
                    setFormData({
                      batchNumber: '',
                      productName: '',
                      productCategory: 'electronics',
                      quantity: ''
                    });
                  }}
                  className="block w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                >
                  Create Another Batch
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default BatchCreate;
