exports.up = async function(knex) {
  // Tabla de Sesiones (Regla 3.8: Cookie opaca, nunca el ID en claro)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.sessions (
      sid VARCHAR(255) PRIMARY KEY, -- Hash HMAC-SHA-512 del ID de sesión
      user_id UUID REFERENCES app.users(id) ON DELETE CASCADE,
      csrf_secret VARCHAR(255) NOT NULL, -- Hash HMAC-SHA-512
      data JSONB,
      expires_at TIMESTAMPTZ NOT NULL,
      absolute_expires_at TIMESTAMPTZ NOT NULL,
      is_revoked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await knex.raw('ALTER TABLE app.sessions ENABLE ROW LEVEL SECURITY');

  // Tabla de Tokens de Recuperación (RF-06)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES app.users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) UNIQUE NOT NULL, -- Hash HMAC-SHA-512
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await knex.raw('ALTER TABLE app.password_resets ENABLE ROW LEVEL SECURITY');
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS app.password_resets');
  await knex.raw('DROP TABLE IF EXISTS app.sessions');
};