const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Verification = require('../models/Verification');

// All verification routes require authentication
router.use(protect);

// Get verification history
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, method, result } = req.query;
    
    const query = { manufacturerId: req.user._id };
    if (method) query.method = method;
    if (result) query.result = result;
    
    const verifications = await Verification.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-senderPhone -ipAddress'); // Exclude sensitive data
    
    const count = await Verification.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: verifications.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      verifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching verifications'
    });
  }
});

module.exports = router;
