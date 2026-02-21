const express = require('express');
const router = express.Router();
const {
  createBatch,
  getBatches,
  getBatchById,
  getBatchCodes,
  exportBatchCodes,
  archiveBatch
} = require('../controllers/batchController');
const { authenticate } = require('../middleware/auth');
const { codeGenerationLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authenticate);

// Batch operations
router.post('/', codeGenerationLimiter, createBatch);
router.get('/', getBatches);
router.get('/:id', getBatchById);
router.get('/:id/codes', getBatchCodes);
router.get('/:id/export', exportBatchCodes);
router.patch('/:id/archive', archiveBatch);

module.exports = router;
