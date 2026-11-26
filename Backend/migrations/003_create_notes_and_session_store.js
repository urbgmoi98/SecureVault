exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.notes (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      title_ciphertext TEXT NOT NULL,
      body_ciphertext TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON app.notes (user_id, updated_at DESC)');
  await knex.raw('ALTER TABLE app.notes ENABLE ROW LEVEL SECURITY');

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.session_store (
      sid VARCHAR(255) PRIMARY KEY,
      sess JSONB NOT NULL,
      expired TIMESTAMPTZ NOT NULL
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS session_store_expired_idx ON app.session_store (expired)');
  await knex.raw('ALTER TABLE app.session_store ENABLE ROW LEVEL SECURITY');
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS app.session_store');
  await knex.raw('DROP TABLE IF EXISTS app.notes');
};
