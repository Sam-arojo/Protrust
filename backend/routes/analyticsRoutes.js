const express = require('express');
const router = express.Router();
const { 
  getDashboardStats, 
  getVerificationTrends,
  getGeographicData
} = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard', getDashboardStats);
router.get('/trends', getVerificationTrends);
router.get('/geographic', getGeographicData);

module.exports = router;
