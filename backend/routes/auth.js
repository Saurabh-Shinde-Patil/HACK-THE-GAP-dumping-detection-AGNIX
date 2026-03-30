const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, authenticate } = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const { sendSuccess, sendError, asyncHandler } = require('../utils/helpers');

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['citizen', 'worker', 'admin', 'superadmin']).withMessage('Invalid role'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array().map(e => e.msg));
  }

  const { name, email, password, role = 'citizen', ward, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return sendError(res, 409, 'Email already registered');

  // Prevent self-assigning superadmin in production
  const assignedRole = role === 'superadmin' ? 'citizen' : role;

  const user = await User.create({ name, email, password, role: assignedRole, ward, phone });
  const token = generateToken(user._id);

  sendSuccess(res, 201, { user: user.toJSON(), token }, 'Registration successful');
}));

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, 400, 'Validation failed');

  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !user.isActive) return sendError(res, 401, 'Invalid credentials');
  const isMatch = await user.matchPassword(password);
  if (!isMatch) return sendError(res, 401, 'Invalid credentials');

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);
  sendSuccess(res, 200, { user: user.toJSON(), token }, 'Login successful');
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  sendSuccess(res, 200, req.user, 'Profile retrieved');
}));

// PUT /api/auth/profile
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { name, phone, ward, fcmToken } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, phone, ward, fcmToken },
    { new: true, runValidators: true }
  );
  sendSuccess(res, 200, user, 'Profile updated');
}));

module.exports = router;
