class AppError extends Error {
  constructor(message, statusCode = 500, publicCode = 'INTERNAL_ERROR', isOperational = true) {
    super(message);

    if (typeof message !== 'string' || !message.trim()) {
      throw new TypeError('AppError requires a safe, non-empty message');
    }
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
      throw new TypeError('AppError statusCode must be an HTTP error status');
    }
    if (typeof publicCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(publicCode)) {
      throw new TypeError('AppError publicCode must be an uppercase error code');
    }
    if (typeof isOperational !== 'boolean') {
      throw new TypeError('AppError isOperational must be a boolean');
    }

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.publicCode = publicCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, AppError);
  }
}

module.exports = AppError;
