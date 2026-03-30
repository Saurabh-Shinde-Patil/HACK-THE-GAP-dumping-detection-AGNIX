const express = require('express');
const router = express.Router();
const Detection = require('../models/Detection');
const Report = require('../models/Report');
const Task = require('../models/Task');
const { authenticate, authorize } = require('../middleware/auth');
const { emitTaskAssigned } = require('../services/socketService');
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

  // (Removed time-based duplicate prevention. Handled by AI state-tracking.)

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

    // --- WORKER INTEGRATION FIX ---
    // If Admin assigned a worker to this CCTV alert, automatically generate 
    // a standard Task so the field worker can actually see it in their App!
    if (assignedTo && detection) {
      // Check if we already created a task for this specific CCTV alert
      const existingReport = await Report.findOne({ address: `[CCTV] Alert ID: ${detection._id}` });

      if (!existingReport) {
        // 1. Create a proxy Report for the CCTV Alert
        const newReport = await Report.create({
          userId: req.user._id, // the admin who assigned it
          // handle binary or base64 image data gracefully
          image: detection.imageBase64 ? `data:image/jpeg;base64,${detection.imageBase64}` : (detection.image || ''),
          location: detection.location,
          address: `[CCTV] Alert ID: ${detection._id}`, // Unique tracking ID
          ward: detection.ward,
          severity: detection.severity,
          status: 'assigned',
          source: 'cctv',
          assignedTo: assignedTo
        });

        // 2. Create the unified Task document for the Worker Dashboard
        const newTask = await Task.create({
          reportId: newReport._id,
          assignedWorker: assignedTo,
          assignedBy: req.user._id,
          priority: detection.severity === 'critical' ? 'urgent' : detection.severity,
          notes: 'Auto-generated task from AI CCTV Detection feed. Please resolve immediately.'
        });

        // Trigger real-time worker notification
        emitTaskAssigned(assignedTo, newTask);
      }
    }

    if (!detection) return sendError(res, 404, 'Detection not found');
    sendSuccess(res, 200, detection, 'Detection updated');
  })
);

module.exports = router;
