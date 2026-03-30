const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
  },
  assignedWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'verified'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  notes: { type: String, default: '' },
  completionImage: { type: String, default: null },
  completedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

TaskSchema.index({ assignedWorker: 1, status: 1 });
TaskSchema.index({ reportId: 1 });

module.exports = mongoose.model('Task', TaskSchema);
