const express = require('express');
const router = express.Router();
const { 
  createBatch, 
  getBatches, 
  getBatch, 
  exportBatch, 
  updateBatch 
} = require('../controllers/batchController');
const { protect } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// All batch routes require authentication
router.use(protect);

router.post('/', rateLimiter.codeGeneration, createBatch);
router.get('/', getBatches);
router.get('/:id', getBatch);
router.get('/:id/export', exportBatch);
router.patch('/:id', updateBatch);

module.exports = router;
