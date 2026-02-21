const Batch = require('../models/Batch');
const Code = require('../models/Code');
const Verification = require('../models/Verification');

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/analytics/dashboard
 * @access  Private
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get total codes generated
    const totalCodes = await Code.countDocuments({ manufacturer: userId });
    
    // Get verification counts
    const verifiedCodes = await Code.countDocuments({ 
      manufacturer: userId, 
      status: 'verified' 
    });
    
    const flaggedCodes = await Code.countDocuments({ 
      manufacturer: userId, 
      status: 'flagged' 
    });
    
    // Get verification breakdown by method
    const smsVerifications = await Verification.countDocuments({
      method: 'sms',
      result: 'success'
    });
    
    const qrVerifications = await Verification.countDocuments({
      method: 'qr',
      result: 'success'
    });
    
    // Get fake detections (duplicate attempts)
    const fakeDetections = await Verification.countDocuments({
      result: 'duplicate'
    });
    
    // Get total batches
    const totalBatches = await Batch.countDocuments({ manufacturer: userId });
    
    // Recent verifications (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentVerifications = await Verification.countDocuments({
      timestamp: { $gte: sevenDaysAgo }
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalCodes,
        verifiedCodes,
        flaggedCodes,
        activeCodes: totalCodes - verifiedCodes - flaggedCodes,
        totalBatches,
        verificationMethods: {
          sms: smsVerifications,
          qr: qrVerifications
        },
        fakeDetections,
        recentVerifications
      }
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard statistics'
    });
  }
};

/**
 * @desc    Get verification trends over time
 * @route   GET /api/analytics/trends
 * @access  Private
 */
const getVerificationTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    // Aggregate verifications by day
    const trends = await Verification.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            method: '$method',
            result: '$result'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: trends
    });
    
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trends'
    });
  }
};

/**
 * @desc    Get geographic verification data
 * @route   GET /api/analytics/geographic
 * @access  Private
 */
const getGeographicData = async (req, res) => {
  try {
    // Aggregate by location
    const geographic = await Verification.aggregate([
      {
        $match: {
          'location.country': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$location.country',
          count: { $sum: 1 },
          cities: { $addToSet: '$location.city' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 20
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: geographic
    });
    
  } catch (error) {
    console.error('Geographic data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve geographic data'
    });
  }
};

module.exports = {
  getDashboardStats,
  getVerificationTrends,
  getGeographicData
};
