module.exports.requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'No autenticado' });
  }
  next();
};

module.exports.requireRole = (role) => {
  return (req, res, next) => {
    if (!req.session || req.session.role !== role) {
      // Registrar intento de acceso denegado (A01)
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Prohibido' });
    }
    next();
  };
};