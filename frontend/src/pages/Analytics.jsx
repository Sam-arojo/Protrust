import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../components/Layout';
import cachedFetch from '../utils/apiCache';

function Analytics() {
  const [stats, setStats] = useState({
    totalCodes: 0,
    verifiedCodes: 0,
    fakeDetections: 0,
    verificationRate: 0,
    growthRate: 0,
    verifiedGrowth: 0,
    fakeGrowth: 0,
    rateGrowth: 0
  });
  const [verifications, setVerifications] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [methodData, setMethodData] = useState([]);
  const [timelineDays, setTimelineDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterResult, setFilterResult] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAnalytics();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAnalytics(true); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Regenerate trend data when timeline changes
    if (verifications.length > 0) {
      generateTrendData(verifications, timelineDays);
    }
  }, [timelineDays]);

  const fetchAnalytics = async (silent = false) => {
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

      // Fetch analytics with caching
      const analyticsResponse = await cachedFetch('/api/get-analytics', { headers });

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        const verifs = analyticsData.analytics?.recentVerifications || [];
        setVerifications(verifs);
        
        // Count actual success verifications
        const successCount = verifs.filter(v => v.result === 'success').length;
        
        // Update stats with correct verified count
        setStats(prev => ({
          ...prev,
          verifiedCodes: successCount
        }));
        
        // Generate trend data
        generateTrendData(verifs, timelineDays);
        
        // Calculate method distribution
        calculateMethodDistribution(verifs);
      }

    } catch (err) {
      console.error('Error fetching analytics:', err);
      if (!silent) {
        setError('Unable to load analytics data. Showing cached data if available.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const generateTrendData = (verifs, days) => {
    // Group verifications by date for specified number of days
    const trendArray = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const count = verifs.filter(v => {
        const vDate = new Date(v.timestamp);
        return vDate.toDateString() === date.toDateString();
      }).length;
      
      trendArray.push({
        date: dateStr,
        verifications: count
      });
    }
    
    setTrendData(trendArray);
  };

  const calculateMethodDistribution = (verifs) => {
    const qrCount = verifs.filter(v => v.method === 'qr').length;
    const manualCount = verifs.filter(v => v.method === 'manual').length;
    const total = qrCount + manualCount;
    
    if (total === 0) {
      // Show empty chart when no data
      setMethodData([
        { name: 'QR Code', value: 0, percentage: 0 },
        { name: 'Manual', value: 0, percentage: 0 }
      ]);
    } else {
      setMethodData([
        { name: 'QR Code', value: qrCount, percentage: Math.round((qrCount / total) * 100) },
        { name: 'Manual', value: manualCount, percentage: Math.round((manualCount / total) * 100) }
      ]);
    }
  };

  // Apply filters
  const filteredVerifications = verifications.filter(verification => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (verification.code && verification.code.toLowerCase().includes(searchLower)) ||
      (verification.batch_number && verification.batch_number.toLowerCase().includes(searchLower)) ||
      (verification.location && verification.location.toLowerCase().includes(searchLower));
    
    const matchesMethod = filterMethod === 'all' || verification.method === filterMethod;
    const matchesResult = filterResult === 'all' || verification.result === filterResult;
    
    let matchesDate = true;
    if (filterDateFrom || filterDateTo) {
      const verificationDate = new Date(verification.timestamp);
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && verificationDate >= fromDate;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && verificationDate <= toDate;
      }
    }
    
    return matchesSearch && matchesMethod && matchesResult && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredVerifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentVerifications = filteredVerifications.slice(startIndex, startIndex + itemsPerPage);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['CODE', 'BATCH NUMBER', 'RESULT', 'LOCATION', 'METHOD', 'TIME'];
    const rows = filteredVerifications.map(v => [
      v.code,
      v.batch_number,
      v.result,
      v.location,
      v.method === 'qr' ? 'QR' : 'Manual',
      new Date(v.timestamp).toLocaleString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `verification_attempts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#2563eb', '#cbd5e1']; // Blue for QR, Gray for Manual

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back to Dashboard */}
        <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center text-sm font-medium">
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-2">Real-time insights for your anti-counterfeit measures.</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Codes Generated */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M15 15h2v2h-2z M19 15h1v1h-1z M15 19h1v1h-1z M18 18h2v2h-2z" />
                </svg>
              </div>
              {!loading && (
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-md ${
                  stats.growthRate > 0 
                    ? 'text-green-600 bg-green-50' 
                    : 'text-gray-500 bg-gray-100'
                }`}>
                  {stats.growthRate > 0 ? '+' : ''}{stats.growthRate || 0}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Total Codes Generated</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.totalCodes.toLocaleString()}
            </p>
          </div>

          {/* Successfully Verified */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {!loading && (
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-md ${
                  stats.verifiedGrowth > 0 
                    ? 'text-green-600 bg-green-50' 
                    : 'text-gray-500 bg-gray-100'
                }`}>
                  {stats.verifiedGrowth > 0 ? '+' : ''}{stats.verifiedGrowth || 0}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Successfully Verified</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.verifiedCodes.toLocaleString()}
            </p>
          </div>

          {/* Fake Detections */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-red-50 rounded-xl">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              {!loading && (
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-md ${
                  stats.fakeGrowth < 0 
                    ? 'text-green-600 bg-green-50' 
                    : stats.fakeGrowth > 0
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-500 bg-gray-100'
                }`}>
                  {stats.fakeGrowth > 0 ? '+' : ''}{stats.fakeGrowth || 0}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Fake Detections</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.fakeDetections}
            </p>
          </div>

          {/* Verification Rate */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-xl">
                <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              {!loading && (
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-md ${
                  stats.rateGrowth > 0 
                    ? 'text-purple-600 bg-purple-50' 
                    : stats.rateGrowth < 0
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-500 bg-gray-100'
                }`}>
                  {stats.rateGrowth > 0 ? '+' : ''}{stats.rateGrowth || 0}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Verification Rate</p>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '...' : `${stats.verificationRate || 0}%`}
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Verification Trends over Time */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Verification Trends over Time</h3>
              <select 
                value={timelineDays}
                onChange={(e) => setTimelineDays(parseInt(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <defs>
                  <linearGradient id="colorVerifications" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelStyle={{ color: '#374151', fontWeight: 600 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="verifications" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={{ fill: '#2563eb', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Verification Methods */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Verification Methods</h3>
            {methodData[0]?.value === 0 && methodData[1]?.value === 0 ? (
              <div className="flex items-center justify-center" style={{ height: 300 }}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">No verification data yet</p>
                  <p className="text-sm text-gray-400 mt-1">Data will appear when verifications occur</p>
                </div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={methodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {methodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-sm text-gray-600">
                      QR Code ({methodData[0]?.percentage || 0}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <span className="text-sm text-gray-600">
                      Manual ({methodData[1]?.percentage || 0}%)
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Search & Filter</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search by code, batch number, city, or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="col-span-1 md:col-span-2 lg:col-span-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Methods</option>
              <option value="qr">QR Code</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Results</option>
              <option value="success">Success</option>
              <option value="duplicate">Duplicate</option>
            </select>
            <div className="col-span-1 md:col-span-2 lg:col-span-1 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => setCurrentPage(1)}
            className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>

        {/* Recent Verification Attempts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Recent Verification Attempts</h3>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Export Data
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CODE</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">BATCH NUMBER</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">RESULT</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">LOCATION</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">METHOD</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">TIME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentVerifications.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No verification attempts found
                    </td>
                  </tr>
                ) : (
                  currentVerifications.map((verification, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{verification.code}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{verification.batch_number}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          verification.result === 'success' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {verification.result === 'success' ? 'SUCCESS' : 'DUPLICATE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{verification.location || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {verification.method === 'qr' ? 'QR' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {new Date(verification.timestamp).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredVerifications.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredVerifications.length)} of {filteredVerifications.length} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Analytics;
