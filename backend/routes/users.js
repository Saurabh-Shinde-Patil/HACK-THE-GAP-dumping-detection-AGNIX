const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const { sendSuccess, sendError, asyncHandler, paginate, paginateMeta } = require('../utils/helpers');

// GET /api/users - List all users (superadmin)
router.get('/', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, ward } = req.query;
  const { skip } = paginate({}, page, limit);
  const filter = {};
  if (role) filter.role = role;
  if (ward) filter.ward = ward;

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  sendSuccess(res, 200, users, 'Users fetched', paginateMeta(total, page, limit));
}));

// PUT /api/users/:id/role - Change user role (superadmin)
router.put('/:id/role', authenticate, authorize('superadmin'), auditLog('CHANGE_ROLE', 'User'),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!['citizen', 'worker', 'admin', 'superadmin'].includes(role)) {
      return sendError(res, 400, 'Invalid role');
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return sendError(res, 404, 'User not found');
    sendSuccess(res, 200, user, 'Role updated');
  })
);

// PUT /api/users/:id/deactivate - Deactivate user (superadmin)
router.put('/:id/deactivate', authenticate, authorize('superadmin'), auditLog('DEACTIVATE_USER', 'User'),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return sendError(res, 404, 'User not found');
    sendSuccess(res, 200, user, 'User deactivated');
  })
);

// GET /api/users/workers - Get all workers (admin)
router.get('/workers', authenticate, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
  const { ward } = req.query;
  const filter = { role: 'worker', isActive: true };
  if (ward) filter.ward = ward;
  const workers = await User.find(filter).sort({ name: 1 });
  sendSuccess(res, 200, workers, 'Workers fetched');
}));

module.exports = router;
