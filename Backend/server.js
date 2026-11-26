const app = require('./app');
const env = require('./config/env');
const knex = require('./config/db');
const logger = require('./utils/logger');
const { serializeError } = require('./utils/errorLog');

const server = app.listen(env.PORT, () => {
  logger.info(`Servidor SecureVault escuchando en puerto ${env.PORT} en modo ${env.NODE_ENV}`);
});

// Timeouts (Sección 7)
server.setTimeout(30000);

let shutdownPromise;
let shutdownExitCode = 0;

function shutdown(exitCode = 0) {
  if (exitCode !== 0) shutdownExitCode = 1;
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    const timeout = setTimeout(() => {
      logger.fatal('El apagado ordenado excedió el tiempo límite');
      process.exit(1);
    }, 15000);

    try {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
      }
    } catch (error) {
      shutdownExitCode = 1;
      logger.error({ err: serializeError(error) }, 'No se pudo cerrar el servidor HTTP');
    }

    try {
      await knex.destroy();
    } catch (error) {
      shutdownExitCode = 1;
      logger.error({ err: serializeError(error) }, 'No se pudo cerrar el pool de base de datos');
    }

    clearTimeout(timeout);
    process.exitCode = shutdownExitCode;
  })();

  return shutdownPromise;
}

function handleFatalError(error, source) {
  logger.fatal({ source, err: serializeError(error) }, 'Error fatal del proceso');
  void shutdown(1);
}

process.on('unhandledRejection', (reason) => handleFatalError(reason, 'unhandledRejection'));
process.on('uncaughtException', (error) => handleFatalError(error, 'uncaughtException'));

process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  void shutdown(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido. Cerrando servidor...');
  void shutdown(0);
});