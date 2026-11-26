const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  console.error('Ya existe Backend/.env; no se modificó para proteger la configuración actual.');
  process.exit(1);
}

const values = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://localhost:5432/securevault_dev',
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  ENCRYPTION_KEY_VERSION: 'v1',
  HMAC_KEY_RECOVERY: crypto.randomBytes(64).toString('base64'),
  HMAC_KEY_SESSION: crypto.randomBytes(64).toString('base64'),
  HMAC_KEY_CSRF: crypto.randomBytes(64).toString('base64'),
  HMAC_KEY_INTEGRITY: crypto.randomBytes(64).toString('base64'),
  SESSION_SECRET: crypto.randomBytes(48).toString('base64'),
  ALLOWED_ORIGIN: 'http://localhost:5173',
  TRUST_PROXY: '1'
};

const contents = `${Object.entries(values)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')}\n`;

try {
  fs.writeFileSync(envPath, contents, { flag: 'wx', mode: 0o600 });
  console.log('Configuración local creada en Backend/.env con secretos aleatorios.');
  console.log('Comprueba DATABASE_URL antes de iniciar si PostgreSQL usa otros datos de conexión.');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('Backend/.env ya existe; no se modificó para proteger la configuración actual.');
    process.exit(1);
  }
  throw error;
}
