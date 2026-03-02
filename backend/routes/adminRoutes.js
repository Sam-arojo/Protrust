const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  approveUser,
  deleteUser,
  getSystemStats
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// All admin routes require admin role
router.use(authenticate);
router.use(authorize('admin'));

router.get('/users', getAllUsers);
router.patch('/users/:id/approve', approveUser);
router.delete('/users/:id', deleteUser);
router.get('/stats', getSystemStats);

module.exports = router;
