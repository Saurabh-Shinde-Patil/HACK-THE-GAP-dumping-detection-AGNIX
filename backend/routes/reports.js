const express = require('express');
const router = express.Router();
const path = require('path');
const Report = require('../models/Report');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const auditLog = require('../middleware/audit');
const { detectImage } = require('../services/aiService');
const { emitNewAlert } = require('../services/socketService');
const { sendSuccess, sendError, asyncHandler, paginate, paginateMeta } = require('../utils/helpers');

// POST /api/reports - Submit a report (citizen or CCTV)
router.post('/', authenticate, upload.single('image'), auditLog('CREATE_REPORT', 'Report'),
  asyncHandler(async (req, res) => {
    if (!req.file) return sendError(res, 400, 'Image is required');

    const { latitude, longitude, description, ward, address } = req.body;
    if (!latitude || !longitude) return sendError(res, 400, 'Location coordinates are required');

    // Send to AI service for detection
    const imagePath = path.join('uploads', req.file.filename);
    const detection = await detectImage(imagePath);

    const severity = detection.confidence > 0.85 ? 'critical'
      : detection.confidence > 0.65 ? 'high'
      : detection.confidence > 0.40 ? 'medium' : 'low';

    const report = await Report.create({
      image: `/uploads/${req.file.filename}`,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      address: address || 'Unknown Location',
      ward: ward || 'Unassigned',
      description,
      source: req.body.source || 'citizen',
      reporter: req.user._id,
      severity,
      detectionConfidence: detection.confidence,
      detectionDetails: detection,
    });

    await report.populate('reporter', 'name email');

    // Fire real-time alert
    emitNewAlert(report);

    sendSuccess(res, 201, report, 'Report submitted successfully');
  })
);

// GET /api/reports - List reports
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, ward, source, severity, lat, lng, radius } = req.query;
  const { skip } = paginate({}, page, limit);

  let filter = {};

  // Role-based filtering
  if (req.user.role === 'citizen') {
    filter.reporter = req.user._id;
  } else if (req.user.role === 'admin') {
    if (req.user.ward) filter.ward = req.user.ward;
  } else if (req.user.role === 'worker') {
    filter.assignedTo = req.user._id;
  }
  // superadmin sees all

  if (status) filter.status = status;
  if (ward && req.user.role !== 'citizen') filter.ward = ward;
  if (source) filter.source = source;
  if (severity) filter.severity = severity;

  // Geospatial radius query
  if (lat && lng && radius) {
    filter.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseInt(radius) || 5000,
      },
    };
  }

  const total = await Report.countDocuments(filter);
  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('reporter', 'name email')
    .populate('assignedTo', 'name email');

  sendSuccess(res, 200, reports, 'Reports fetched', paginateMeta(total, page, limit));
}));

// GET /api/reports/stats – aggregated stats
router.get('/stats', authenticate, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
  const stats = await Report.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, avgConfidence: { $avg: '$detectionConfidence' } } },
  ]);
  const bySeverity = await Report.aggregate([
    { $group: { _id: '$severity', count: { $sum: 1 } } },
  ]);
  const bySource = await Report.aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } },
  ]);
  const total = await Report.countDocuments();
  sendSuccess(res, 200, { total, byStatus: stats, bySeverity, bySource }, 'Stats fetched');
}));

// GET /api/reports/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id)
    .populate('reporter', 'name email phone')
    .populate('assignedTo', 'name email phone');
  if (!report) return sendError(res, 404, 'Report not found');

  // Citizens can only see their own reports
  if (req.user.role === 'citizen' && report.reporter?._id.toString() !== req.user._id.toString()) {
    return sendError(res, 403, 'Access denied');
  }
  sendSuccess(res, 200, report, 'Report retrieved');
}));

// PUT /api/reports/:id – update status
router.put('/:id', authenticate, authorize('admin', 'superadmin'), auditLog('UPDATE_REPORT', 'Report'),
  asyncHandler(async (req, res) => {
    const { status, ward, isVerified } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, ward, isVerified },
      { new: true, runValidators: true }
    ).populate('reporter', 'name email').populate('assignedTo', 'name email');

    if (!report) return sendError(res, 404, 'Report not found');
    sendSuccess(res, 200, report, 'Report updated');
  })
);

module.exports = router;
