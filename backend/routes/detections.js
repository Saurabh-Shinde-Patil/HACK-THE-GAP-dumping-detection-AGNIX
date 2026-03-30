const express = require('express');
const router = express.Router();
const Detection = require('../models/Detection');
const { authenticate, authorize } = require('../middleware/auth');
const { emitCCTVDetection } = require('../services/socketService');
const { sendSuccess, sendError, asyncHandler, paginate, paginateMeta } = require('../utils/helpers');

// Middleware: Validate API key for AI service requests
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.DETECTION_API_KEY || 'cleancity-detection-key';
  if (apiKey !== expectedKey) {
    return sendError(res, 401, 'Invalid or missing API key');
  }
  next();
};

// POST /api/detections — Receive detection from AI service
router.post('/', validateApiKey, asyncHandler(async (req, res) => {
  const {
    image, imageBase64, latitude, longitude, address, ward,
    confidence, cameraId, cameraName, detectedObjects, frameCount,
  } = req.body;

  if (!latitude || !longitude) return sendError(res, 400, 'Location coordinates are required');
  if (!confidence) return sendError(res, 400, 'Confidence score is required');
  if (!cameraId) return sendError(res, 400, 'Camera ID is required');

  // Duplicate prevention: same camera within 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const duplicate = await Detection.findOne({
    cameraId,
    createdAt: { $gte: fiveMinAgo },
    status: { $in: ['pending', 'acknowledged'] },
  });

  if (duplicate) {
    return sendSuccess(res, 200, duplicate, 'Duplicate detection — already reported within 5 minutes');
  }

  // Auto severity based on confidence
  const severity = confidence > 0.85 ? 'critical'
    : confidence > 0.65 ? 'high'
    : confidence > 0.40 ? 'medium' : 'low';

  const detection = await Detection.create({
    image: image || '',
    imageBase64: imageBase64 || '',
    location: {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    },
    address: address || 'CCTV Location',
    ward: ward || 'Unassigned',
    confidence,
    severity,
    cameraId,
    cameraName: cameraName || 'Camera',
    detectedObjects: detectedObjects || [],
    frameCount: frameCount || 1,
  });

  // Emit real-time alert to admin dashboards
  emitCCTVDetection(detection);

  sendSuccess(res, 201, detection, 'Detection reported successfully');
}));

// GET /api/detections — List detections (admin/superadmin only)
router.get('/', authenticate, authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, severity, cameraId } = req.query;
    const { skip } = paginate({}, page, limit);

    let filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (cameraId) filter.cameraId = cameraId;

    const total = await Detection.countDocuments(filter);
    const detections = await Detection.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email');

    sendSuccess(res, 200, detections, 'Detections fetched', paginateMeta(total, page, limit));
  })
);

// GET /api/detections/stats — Detection statistics
router.get('/stats', authenticate, authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [byStatus, bySeverity, todayCount, totalCount] = await Promise.all([
      Detection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Detection.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Detection.countDocuments({ createdAt: { $gte: today } }),
      Detection.countDocuments(),
    ]);

    const avgConfidence = await Detection.aggregate([
      { $group: { _id: null, avg: { $avg: '$confidence' } } },
    ]);

    sendSuccess(res, 200, {
      total: totalCount,
      today: todayCount,
      avgConfidence: avgConfidence[0]?.avg ? Math.round(avgConfidence[0].avg * 100) / 100 : 0,
      byStatus,
      bySeverity,
    }, 'Detection stats fetched');
  })
);

// GET /api/detections/:id — Single detection
router.get('/:id', authenticate, authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const detection = await Detection.findById(req.params.id)
      .populate('assignedTo', 'name email phone')
      .populate('resolvedBy', 'name email phone');
    if (!detection) return sendError(res, 404, 'Detection not found');
    sendSuccess(res, 200, detection, 'Detection retrieved');
  })
);

// PUT /api/detections/:id — Update detection status / assign team
router.put('/:id', authenticate, authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const { status, assignedTo, ward } = req.body;
    const updateData = {};

    if (status) updateData.status = status;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (ward) updateData.ward = ward;

    // If resolving, record who and when
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.user._id;
    }

    const detection = await Detection.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email')
     .populate('resolvedBy', 'name email');

    if (!detection) return sendError(res, 404, 'Detection not found');
    sendSuccess(res, 200, detection, 'Detection updated');
  })
);

module.exports = router;
