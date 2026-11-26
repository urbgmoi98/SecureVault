const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./utils/logger');
const sessionMiddleware = require('./middlewares/sessions');
const csrfProtection = require('./middlewares/csrf');
const authRoutes = require('./routes/authRoutes');
const notesRoutes = require('./routes/notesRoutes');
const healthRoutes = require('./routes/healthRoutes');
const AppError = require('./utils/AppError');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Confianza en el proxy (necesario para cookies Secure y Rate Limit en producción)
app.set('trust proxy', env.TRUST_PROXY);

// Desactivar identificación del framework
app.disable('x-powered-by');

// Logging HTTP
app.use(pinoHttp({ logger }));

// CORS Restringido al propio dominio
app.use(cors({
  origin: [
    env.ALLOWED_ORIGIN,
    ...(env.NODE_ENV === 'development' ? ['http://localhost:5173'] : [])
  ],
  credentials: true
}));

// Helmet: CSP Estricta (Sin inline scripts, solo mismo origen)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // Sin unsafe-inline
      styleSrc: ["'self'"],  // Sin unsafe-inline
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false // Ajustar según necesidad de recursos
}));

function mapParserError(error) {
  if (error.type === 'entity.too.large') {
    return new AppError('El cuerpo de la petición excede el límite', 413, 'PAYLOAD_TOO_LARGE');
  }
  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    return new AppError('El cuerpo de la petición no es válido', 400, 'INVALID_JSON');
  }
  return error;
}

function useParser(parser) {
  return (req, res, next) => parser(req, res, (error) => next(error ? mapParserError(error) : undefined));
}

app.use(useParser(express.json({ limit: '20kb' })));
app.use(useParser(express.urlencoded({ extended: true, limit: '10kb' })));
app.use(cookieParser());
app.use(sessionMiddleware);

app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

app.use('/api', csrfProtection);
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api', (req, res, next) => {
  next(new AppError('Ruta no encontrada', 404, 'NOT_FOUND'));
});

app.use(errorHandler);

module.exports = app;