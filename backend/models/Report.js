const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  image: { type: String, required: true },
  thumbnail: { type: String },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  address: { type: String, default: 'Unknown Location' },
  ward: { type: String, default: 'Unassigned' },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in-progress', 'completed', 'rejected'],
    default: 'pending',
  },
  source: {
    type: String,
    enum: ['citizen', 'cctv'],
    required: true,
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  detectionConfidence: { type: Number, default: 0 },
  detectionDetails: { type: Object, default: {} },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

// 2dsphere index for geospatial queries
ReportSchema.index({ location: '2dsphere' });
ReportSchema.index({ status: 1, ward: 1 });
ReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', ReportSchema);
