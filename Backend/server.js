const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');

const server = app.listen(env.PORT, () => {
  logger.info(`Servidor SecureVault escuchando en puerto ${env.PORT} en modo ${env.NODE_ENV}`);
});

// Timeouts (Sección 7)
server.setTimeout(30000);

// Apagado ordenado
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado. Saliendo.');
    process.exit(0);
  });
});