const mongoose = require('mongoose');

const DetectionSchema = new mongoose.Schema({
  image: { type: String, default: '' },
  imageBase64: { type: String, default: '' },
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
  address: { type: String, default: 'CCTV Location' },
  ward: { type: String, default: 'Unassigned' },
  confidence: { type: Number, required: true },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  cameraId: { type: String, required: true },
  cameraName: { type: String, default: 'Unknown Camera' },
  detectedObjects: [{
    label: String,
    confidence: Number,
    bbox: [Number],
  }],
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'assigned', 'resolved', 'false-positive'],
    default: 'pending',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolvedAt: { type: Date, default: null },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  frameCount: { type: Number, default: 1 },
}, { timestamps: true });

// Indexes for geospatial and query performance
DetectionSchema.index({ location: '2dsphere' });
DetectionSchema.index({ status: 1, severity: 1 });
DetectionSchema.index({ cameraId: 1, createdAt: -1 });
DetectionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Detection', DetectionSchema);
