const express = require('express');
const router = express.Router();
const { getCodeDetails, flagCode } = require('../controllers/codeController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:code', getCodeDetails);
router.patch('/:code/flag', flagCode);

module.exports = router;
