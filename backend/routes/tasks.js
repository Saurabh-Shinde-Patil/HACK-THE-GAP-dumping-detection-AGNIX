const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Report = require('../models/Report');
const Detection = require('../models/Detection');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const auditLog = require('../middleware/audit');
const { emitTaskAssigned, emitTaskCompleted } = require('../services/socketService');
const { notifyWorkerNewTask } = require('../services/notificationService');
const { sendSuccess, sendError, asyncHandler, paginate, paginateMeta } = require('../utils/helpers');

// POST /api/tasks - Assign task (admin/superadmin)
router.post('/', authenticate, authorize('admin', 'superadmin'), auditLog('ASSIGN_TASK', 'Task'),
  asyncHandler(async (req, res) => {
    const { reportId, workerId, priority = 'medium', notes } = req.body;
    if (!reportId || !workerId) return sendError(res, 400, 'reportId and workerId are required');

    const [report, worker] = await Promise.all([
      Report.findById(reportId),
      User.findById(workerId),
    ]);

    if (!report) return sendError(res, 404, 'Report not found');
    if (!worker) return sendError(res, 404, 'Worker not found');

    const task = await Task.create({
      reportId,
      assignedWorker: workerId,
      assignedBy: req.user._id,
      priority,
      notes,
    });

    // Update report status
    await Report.findByIdAndUpdate(reportId, { status: 'assigned', assignedTo: workerId });

    await task.populate(['reportId', 'assignedWorker', 'assignedBy']);

    // Real-time & notification
    emitTaskAssigned(workerId, task);
    notifyWorkerNewTask(worker, task).catch(() => {});

    sendSuccess(res, 201, task, 'Task assigned successfully');
  })
);

// GET /api/tasks - List tasks
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, priority } = req.query;
  const { skip } = paginate({}, page, limit);

  let filter = {};
  if (req.user.role === 'worker') filter.assignedWorker = req.user._id;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const total = await Task.countDocuments(filter);
  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('reportId', 'image address ward severity status')
    .populate('assignedWorker', 'name email phone')
    .populate('assignedBy', 'name email');

  sendSuccess(res, 200, tasks, 'Tasks fetched', paginateMeta(total, page, limit));
}));

// GET /api/tasks/stats
router.get('/stats', authenticate, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
  const stats = await Task.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byWorker = await Task.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: '$assignedWorker', completed: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'worker' } },
    { $unwind: '$worker' },
    { $project: { 'worker.name': 1, 'worker.email': 1, completed: 1 } },
    { $sort: { completed: -1 } },
    { $limit: 10 },
  ]);
  sendSuccess(res, 200, { byStatus: stats, topWorkers: byWorker }, 'Task stats fetched');
}));

// GET /api/tasks/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('reportId')
    .populate('assignedWorker', 'name email phone')
    .populate('assignedBy', 'name email');
  if (!task) return sendError(res, 404, 'Task not found');
  sendSuccess(res, 200, task, 'Task retrieved');
}));

// PUT /api/tasks/:id - Update task status / upload completion image
router.put('/:id', authenticate, upload.single('completionImage'), auditLog('UPDATE_TASK', 'Task'),
  asyncHandler(async (req, res) => {
    const { status, notes } = req.body;
    const update = { notes };
    if (status) update.status = status;
    if (req.file) update.completionImage = `/uploads/${req.file.filename}`;
    if (status === 'completed') {
      update.completedAt = new Date();
      // Update report status
      const task = await Task.findById(req.params.id);
      if (task) await Report.findByIdAndUpdate(task.reportId, { status: 'in-progress' });
    }
    if (status === 'verified') update.verifiedAt = new Date();

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('reportId', 'image address ward')
      .populate('assignedWorker', 'name email');

    if (!updatedTask) return sendError(res, 404, 'Task not found');

    // --- REVERSE-SYNC WITH CCTV DASHBOARD ---
    // Check if this task originated from the AI Live Monitor
    if (status && updatedTask.reportId && updatedTask.reportId.address) {
      const addressString = updatedTask.reportId.address;
      if (addressString.startsWith('[CCTV] Alert ID: ')) {
        const detectionId = addressString.replace('[CCTV] Alert ID: ', '').trim();
        
        // Map the Worker's task status back to the Dashboard's detection status
        let detectionStatus = status; 
        if (status === 'in-progress') detectionStatus = 'assigned';
        if (status === 'completed' || status === 'verified') detectionStatus = 'resolved';
        
        try {
          const syncUpdate = { status: detectionStatus };
          
          // If the worker marked it completed, give them credit on the CCTV dashboard!
          if (detectionStatus === 'resolved' && updatedTask.assignedWorker) {
            syncUpdate.resolvedAt = new Date();
            syncUpdate.resolvedBy = updatedTask.assignedWorker._id;
          }
          
          await Detection.findByIdAndUpdate(detectionId, syncUpdate);
        } catch (e) {
          console.error("Task to CCTV Reverse-Sync Failed:", e);
        }
      }
    }

    if (status === 'completed') emitTaskCompleted(updatedTask);

    sendSuccess(res, 200, updatedTask, 'Task updated');
  })
);

module.exports = router;
