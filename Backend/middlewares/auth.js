const auditService = require('../services/auditService');

module.exports.requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'No autenticado' });
  }
  next();
};

module.exports.requireRole = (role) => {
  return async (req, res, next) => {
    if (!req.session || req.session.role !== role) {
      try {
        await auditService.logEvent({
          event_type: 'ACCESS_DENIED',
          actor_id: req.session && req.session.userId,
          result: 'DENIED',
          details: { required_role: role },
          request_id: req.id
        });
      } catch (error) {
        return next(error);
      }
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Prohibido' });
    }
    next();
  };
};