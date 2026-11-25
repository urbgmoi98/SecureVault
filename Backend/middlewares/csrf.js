const { hashToken, safeCompare } = require('../crypto/token');
const logger = require('../utils/logger');

module.exports = function csrfProtection(req, res, next) {
  // Ignorar métodos seguros
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const clientToken = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session.csrfToken;

  if (!clientToken || !sessionToken) {
    logger.warn({ msg: 'CSRF token faltante', reqId: req.id });
    return res.status(403).json({ code: 'FORBIDDEN', message: 'Acceso denegado' });
  }

  // Comparar el hash del token del cliente con el hash almacenado en sesión
  const hashedClientToken = hashToken(clientToken, 'HMAC_KEY_CSRF');

  if (!safeCompare(hashedClientToken, sessionToken)) {
    logger.warn({ msg: 'CSRF token inválido', reqId: req.id });
    return res.status(403).json({ code: 'FORBIDDEN', message: 'Acceso denegado' });
  }

  next();
};