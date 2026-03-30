// Standardized response helpers
const sendSuccess = (res, statusCode, data, message = 'Success', meta = {}) => {
  res.status(statusCode).json({ success: true, message, data, ...meta });
};

const sendError = (res, statusCode, message, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  res.status(statusCode).json(response);
};

// Pagination helper
const paginate = (query = {}, page = 1, limit = 20) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return { skip, limit: parseInt(limit) };
};

const paginateMeta = (total, page, limit) => ({
  pagination: {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / parseInt(limit)),
  },
});

// Async handler to eliminate try-catch boilerplate
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 400, 'Validation Error', messages);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 409, `${field} already exists`);
  }
  if (err.name === 'CastError') {
    return sendError(res, 400, 'Invalid ID format');
  }
  if (err.message && err.message.includes('Only JPEG')) {
    return sendError(res, 400, err.message);
  }

  sendError(res, err.statusCode || 500, err.message || 'Internal Server Error');
};

module.exports = { sendSuccess, sendError, paginate, paginateMeta, asyncHandler, errorHandler };
