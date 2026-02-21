const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// All code routes require authentication
router.use(protect);

// Get codes for a batch
router.get('/batch/:batchId', async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Get codes by batch - coming soon'
  });
});

module.exports = router;
