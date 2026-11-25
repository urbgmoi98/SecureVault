const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./utils/logger');

const app = express();

// Confianza en el proxy (necesario para cookies Secure y Rate Limit en producción)
app.set('trust proxy', env.TRUST_PROXY);

// Desactivar identificación del framework
app.disable('x-powered-by');

// Logging HTTP
app.use(pinoHttp({ logger }));

// CORS Restringido al propio dominio
app.use(cors({
  origin: env.ALLOWED_ORIGIN,
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

app.use(express.json({ limit: '10kb' })); // Límite estricto de body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// TODO: Configurar express-session con almacén en base de datos o Redis (Regla 3.8)

// Manejo global de errores (Sección 7)
app.use((err, req, res, next) => {
  logger.error({
    msg: 'Error interno no manejado',
    error: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    reqId: req.id
  });

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la petición excede el límite', reqId: req.id });
  }

  // Respuesta genérica
  res.status(500).json({ 
    code: 'INTERNAL_ERROR', 
    message: 'Ocurrió un error inesperado', 
    reqId: req.id // Identificador de correlación
  });
});

module.exports = app;