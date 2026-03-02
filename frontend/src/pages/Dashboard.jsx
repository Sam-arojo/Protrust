import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import cachedFetch from '../utils/apiCache';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalCodes: 0,
    verifiedCodes: 0,
    activeBatches: 0,
    fakeDetections: 0,
    verificationRate: 0,
    growthRate: 0
  });
  const [recentBatches, setRecentBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingCachedData, setUsingCachedData] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch stats with caching
      const statsResponse = await cachedFetch('/api/get-stats', { headers });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
        setUsingCachedData(statsResponse.fromCache);
      }

      // Fetch recent batches with caching
      const batchesResponse = await cachedFetch('/api/get-batches?page=1&pageSize=2', { headers });

      if (batchesResponse.ok) {
        const batchesData = await batchesResponse.json();
        setRecentBatches(batchesData.batches || []);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (!silent) {
        setError('Unable to load dashboard data. Showing cached data if available.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.companyName || 'Manufacturer'}
          </h1>
          <p className="text-gray-500 mt-2">
            Overview of your product authenticity ecosystem for today.
          </p>
        </div>

        {/* Cache/Error Info Banner */}
        {(usingCachedData || error) && (
          <div className={`mb-6 p-4 rounded-lg ${
            error ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start">
              <svg 
                className={`w-5 h-5 mt-0.5 mr-3 ${error ? 'text-yellow-600' : 'text-blue-600'}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className={`text-sm font-medium ${error ? 'text-yellow-800' : 'text-blue-800'}`}>
                  {error || 'Showing cached data'}
                </p>
                {usingCachedData && !error && (
                  <p className="text-xs text-blue-600 mt-1">
                    Data refreshes automatically every 30 seconds. This prevents database overload during code generation.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Total Codes Generated */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M15 15h2v2h-2z M19 15h1v1h-1z M15 19h1v1h-1z M18 18h2v2h-2z" />
                </svg>
              </div>
              {!loading && stats.totalCodes > 0 && (
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-md ${
                  (stats.growthRate || 0) > 0 
                    ? 'text-green-600 bg-green-50' 
                    : 'text-gray-500 bg-gray-100'
                }`}>
                  {(stats.growthRate || 0) > 0 ? '+' : ''}{stats.growthRate || 0}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Total Codes Generated</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.totalCodes.toLocaleString()}
            </p>
          </div>

          {/* Successfully Verified */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {!loading && stats.totalCodes > 0 && (
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-md ${
                  (stats.verifiedGrowth || 0) > 0 
                    ? 'text-green-600 bg-green-50' 
                    : 'text-gray-500 bg-gray-100'
                }`}>
                  {(stats.verifiedGrowth || 0) > 0 ? '+' : ''}{stats.verifiedGrowth || 0}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Successfully Verified</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.verifiedCodes.toLocaleString()}
            </p>
          </div>

          {/* Fake Detections */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-red-50 rounded-xl">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              {stats.fakeDetections > 10 && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-md">
                  High Alert
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Fake Detections</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.fakeDetections}
            </p>
          </div>

          {/* Active Batches */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-teal-50 rounded-xl">
                <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">Active Batches</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.activeBatches}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Create New Batch */}
            <Link
              to="/batches/create"
              className="bg-gradient-to-br from-teal-700 to-teal-800 hover:from-teal-800 hover:to-teal-900 text-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-600 rounded-full -mr-16 -mt-16 opacity-20"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-teal-600 bg-opacity-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-bold text-xl mb-2">Create New Batch</h3>
                <p className="text-sm text-teal-50">Generate a new set of unique authenticity codes.</p>
              </div>
            </Link>

            {/* View All Batches */}
            <Link
              to="/batches"
              className="bg-white hover:bg-gray-50 rounded-2xl p-8 shadow-sm border border-gray-200 hover:shadow-md transition-all group"
            >
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">View All Batches</h3>
              <p className="text-sm text-gray-500">Manage and track your existing product batches.</p>
            </Link>

            {/* View Analytics */}
            <Link
              to="/analytics"
              className="bg-white hover:bg-gray-50 rounded-2xl p-8 shadow-sm border border-gray-200 hover:shadow-md transition-all group"
            >
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l5-5 4 4 6-8 M4 16h.01 M9 11h.01 M13 15h.01 M19 7h.01 M7 6l1 1 M6 7l1-1" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">View Analytics</h3>
              <p className="text-sm text-gray-500">Detailed insights on verification geo-locations.</p>
            </Link>

            {/* Public Verify Page */}
            <Link
              to="/verify"
              className="bg-white hover:bg-gray-50 rounded-2xl p-8 shadow-sm border border-gray-200 hover:shadow-md transition-all group"
            >
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">Public Verify Page</h3>
              <p className="text-sm text-gray-500">Customer-facing portal to verify products.</p>
            </Link>
          </div>
        </div>

        {/* Recent Batch Activity */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Batch Activity</h2>
          
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-teal-600"></div>
              <p className="text-gray-500 mt-4">Loading recent batches...</p>
            </div>
          ) : recentBatches.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium mb-2">No batches created yet</p>
              <p className="text-gray-500 text-sm mb-4">Start by creating your first batch of authenticity codes.</p>
              <Link to="/batches/create" className="inline-flex items-center gap-2 text-teal-700 hover:text-teal-800 font-semibold">
                Create your first batch
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Batch ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{batch.batch_id}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">{batch.product_name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">{batch.quantity?.toLocaleString() || 0}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            batch.codes_generated === batch.quantity
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {batch.codes_generated === batch.quantity ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {batch.codes_generated === batch.quantity ? (
                            <Link
                              to={`/batches/${batch.id}`}
                              className="text-sm font-medium text-teal-700 hover:text-teal-800"
                            >
                              Download PDF
                            </Link>
                          ) : (
                            <Link
                              to={`/batches/${batch.id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            >
                              View Status
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
