const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');
const { sendSuccess, asyncHandler, paginate, paginateMeta } = require('../utils/helpers');

// GET /api/audit - Query audit logs (superadmin)
router.get('/', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action, userId } = req.query;
  const { skip } = paginate({}, page, limit);

  const filter = {};
  if (action) filter.action = new RegExp(action, 'i');
  if (userId) filter.user = userId;

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('user', 'name email role');

  sendSuccess(res, 200, logs, 'Audit logs fetched', paginateMeta(total, page, limit));
}));

module.exports = router;
