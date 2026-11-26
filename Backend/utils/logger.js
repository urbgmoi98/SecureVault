const pino = require('pino');
const env = require('../config/env');

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.token',
      'res.headers["set-cookie"]',
      'err.password',
      'err.token',
      'err.secret',
      'err.authorization',
      'err.cookie',
      'err.connectionString',
      'err.query',
      'err.parameters',
      'err.detail',
      'err.hint',
      'user.password_hash',
      'note.content',
      'profile.sensitive_data'
    ],
    censor: '[REDACTED]'
  },
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;