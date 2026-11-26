const AppError = require('../utils/AppError');
const { serializeError } = require('../utils/errorLog');
const logger = require('../utils/logger');

function getRequestId(req) {
  const candidate = req && req.id;
  const requestId = typeof candidate === 'string' || (typeof candidate === 'number' && Number.isFinite(candidate))
    ? String(candidate)
    : '';

  return requestId && requestId.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(requestId)
    ? requestId
    : 'unavailable';
}

module.exports = function errorHandler(error, req, res, next) {
  const requestId = getRequestId(req);
  logger.error({
    err: serializeError(error),
    requestId
  }, 'Request failed');

  if (res.headersSent) return next(error);

  const typedError = error instanceof AppError;
  const statusCode = typedError ? error.statusCode : 500;
  const code = typedError ? error.publicCode : 'INTERNAL_ERROR';
  const message = typedError ? error.message : 'Ocurrió un error inesperado';

  return res.status(statusCode).json({
    code,
    message,
    requestId
  });
};
