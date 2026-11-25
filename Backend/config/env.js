const { z } = require('zod');
const dotenv = require('dotenv');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().url(),
  // Llaves de 32 bytes en base64 (Crypto AES-256)
  ENCRYPTION_KEY: z.string().length(44, "La llave de cifrado debe ser de 32 bytes en base64"),
  ENCRYPTION_KEY_VERSION: z.string().default('v1'),
  PREVIOUS_ENCRYPTION_KEY: z.string().optional(),
  // Llaves HMAC-SHA-512 (64 bytes en base64) - Prohibido SHA-256
  HMAC_KEY_RECOVERY: z.string().length(88),
  HMAC_KEY_SESSION: z.string().length(88),
  HMAC_KEY_CSRF: z.string().length(88),
  HMAC_KEY_INTEGRITY: z.string().length(88),
  SESSION_SECRET: z.string().min(32),
  ALLOWED_ORIGIN: z.string().url(),
  TRUST_PROXY: z.string().default('1'),
  // Límites de negocio
  MAX_NOTES_PER_USER: z.string().transform(Number).default('50'),
  MAX_NOTE_SIZE_BYTES: z.string().transform(Number).default('10240'),
  LOGIN_MAX_ATTEMPTS: z.string().transform(Number).default('5'),
  LOCKOUT_BASE_MINUTES: z.string().transform(Number).default('1')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Error crítico de configuración. El proceso no arrancará:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

module.exports = parsed.data;