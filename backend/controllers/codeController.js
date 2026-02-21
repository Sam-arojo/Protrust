const Code = require('../models/Code');
const Verification = require('../models/Verification');

/**
 * @desc    Get code details
 * @route   GET /api/codes/:code
 * @access  Private
 */
const getCodeDetails = async (req, res) => {
  try {
    const code = await Code.findOne({ 
      code: req.params.code,
      manufacturer: req.user._id
    })
    .populate('batch', 'batchId productName')
    .populate('manufacturer', 'companyName');
    
    if (!code) {
      return res.status(404).json({
        success: false,
        error: 'Code not found'
      });
    }
    
    // Get verification history
    const verifications = await Verification.find({ code: code.code })
      .sort({ timestamp: -1 })
      .limit(10);
    
    res.status(200).json({
      success: true,
      data: {
        code,
        verificationHistory: verifications
      }
    });
    
  } catch (error) {
    console.error('Get code details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve code details'
    });
  }
};

/**
 * @desc    Flag a code as suspicious
 * @route   PATCH /api/codes/:code/flag
 * @access  Private
 */
const flagCode = async (req, res) => {
  try {
    const code = await Code.findOneAndUpdate(
      {
        code: req.params.code,
        manufacturer: req.user._id
      },
      { status: 'flagged' },
      { new: true }
    );
    
    if (!code) {
      return res.status(404).json({
        success: false,
        error: 'Code not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: code
    });
    
  } catch (error) {
    console.error('Flag code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to flag code'
    });
  }
};

module.exports = {
  getCodeDetails,
  flagCode
};
