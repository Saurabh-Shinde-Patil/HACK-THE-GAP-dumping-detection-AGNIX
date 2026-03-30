const AuditLog = require('../models/AuditLog');

const auditLog = (action, resource) => {
  return async (req, res, next) => {
    // Store original send to intercept response
    const originalJson = res.json.bind(res);
    res.json = async (data) => {
      if (res.statusCode < 400 && req.user) {
        try {
          await AuditLog.create({
            user: req.user._id,
            action,
            resource,
            resourceId: req.params.id || (data.data && data.data._id) || null,
            details: { method: req.method, path: req.path, body: { ...req.body, password: undefined } },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });
        } catch (err) {
          console.warn('Audit log failed:', err.message);
        }
      }
      return originalJson(data);
    };
    next();
  };
};

module.exports = auditLog;
