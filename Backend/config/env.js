const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function base64KeySchema(byteLength, label) {
  return z.string().refine((value) => {
    const key = Buffer.from(value, 'base64');
    return key.length === byteLength && key.toString('base64') === value;
  }, `${label} debe ser una clave Base64 válida de ${byteLength} bytes`);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().url().refine(
    (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'DATABASE_URL debe ser una URL de PostgreSQL'
  ).refine(
    (value) => !value.includes('REPLACE_WITH_DATABASE_PASSWORD'),
    'Reemplaza REPLACE_WITH_DATABASE_PASSWORD por la contraseña de PostgreSQL de Supabase'
  ),
  ENCRYPTION_KEY: base64KeySchema(32, 'ENCRYPTION_KEY'),
  ENCRYPTION_KEY_VERSION: z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/).default('v1'),
  PREVIOUS_ENCRYPTION_KEY: base64KeySchema(32, 'PREVIOUS_ENCRYPTION_KEY').optional(),
  PREVIOUS_ENCRYPTION_KEY_VERSION: z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/).optional(),
  HMAC_KEY_RECOVERY: base64KeySchema(64, 'HMAC_KEY_RECOVERY'),
  HMAC_KEY_SESSION: base64KeySchema(64, 'HMAC_KEY_SESSION'),
  HMAC_KEY_CSRF: base64KeySchema(64, 'HMAC_KEY_CSRF'),
  HMAC_KEY_INTEGRITY: base64KeySchema(64, 'HMAC_KEY_INTEGRITY'),
  SESSION_SECRET: z.string().min(32),
  ALLOWED_ORIGIN: z.string().url(),
  TRUST_PROXY: z.string().default('1'),
  // Límites de negocio
  MAX_NOTES_PER_USER: z.string().transform(Number).default('50'),
  MAX_NOTE_SIZE_BYTES: z.string().transform(Number).default('10240'),
  LOGIN_MAX_ATTEMPTS: z.string().transform(Number).default('5'),
  LOCKOUT_BASE_MINUTES: z.string().transform(Number).default('1')
}).superRefine((values, context) => {
  const hasPreviousKey = Boolean(values.PREVIOUS_ENCRYPTION_KEY);
  const hasPreviousVersion = Boolean(values.PREVIOUS_ENCRYPTION_KEY_VERSION);

  if (hasPreviousKey !== hasPreviousVersion) {
    context.addIssue({
      code: 'custom',
      path: ['PREVIOUS_ENCRYPTION_KEY_VERSION'],
      message: 'Configura la clave y versión anterior juntas'
    });
  }

  if (values.PREVIOUS_ENCRYPTION_KEY_VERSION === values.ENCRYPTION_KEY_VERSION) {
    context.addIssue({
      code: 'custom',
      path: ['PREVIOUS_ENCRYPTION_KEY_VERSION'],
      message: 'La versión anterior debe diferir de ENCRYPTION_KEY_VERSION'
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Error crítico de configuración. El proceso no arrancará:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

module.exports = parsed.data;