exports.up = async function(knex) {
  // 1. Crear esquema
  await knex.raw('CREATE SCHEMA IF NOT EXISTS app');
  
  // 2. Tabla de usuarios
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      failed_attempts INT DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // 3. Habilitar RLS (Row Level Security)
  await knex.raw('ALTER TABLE app.users ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE app.users FORCE ROW LEVEL SECURITY');
  
};

exports.down = async function(knex) {
  await knex.raw('DROP SCHEMA IF EXISTS app CASCADE');
};