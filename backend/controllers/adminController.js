const User = require('../models/User');
const Batch = require('../models/Batch');
const Code = require('../models/Code');
const Verification = require('../models/Verification');

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Admin
 */
const getAllUsers = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const query = { role: 'manufacturer' };
    
    if (status === 'pending') {
      query.isApproved = false;
    } else if (status === 'approved') {
      query.isApproved = true;
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
};

/**
 * @desc    Approve user account
 * @route   PATCH /api/admin/users/:id/approve
 * @access  Admin
 */
const approveUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // TODO: Send approval email to user
    
    res.status(200).json({
      success: true,
      data: user
    });
    
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve user'
    });
  }
};

/**
 * @desc    Delete user account
 * @route   DELETE /api/admin/users/:id
 * @access  Admin
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
};

/**
 * @desc    Get system statistics
 * @route   GET /api/admin/stats
 * @access  Admin
 */
const getSystemStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'manufacturer' });
    const pendingUsers = await User.countDocuments({ role: 'manufacturer', isApproved: false });
    const totalBatches = await Batch.countDocuments();
    const totalCodes = await Code.countDocuments();
    const totalVerifications = await Verification.countDocuments();
    
    const verificationsByMethod = await Verification.aggregate([
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const verificationsByResult = await Verification.aggregate([
      {
        $group: {
          _id: '$result',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          pending: pendingUsers,
          approved: totalUsers - pendingUsers
        },
        batches: totalBatches,
        codes: totalCodes,
        verifications: {
          total: totalVerifications,
          byMethod: verificationsByMethod,
          byResult: verificationsByResult
        }
      }
    });
    
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system statistics'
    });
  }
};

module.exports = {
  getAllUsers,
  approveUser,
  deleteUser,
  getSystemStats
};
