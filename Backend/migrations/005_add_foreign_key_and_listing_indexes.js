exports.up = async function (knex) {
  await knex.raw('CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON app.sessions (user_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON app.password_resets (user_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS security_events_actor_id_idx ON app.security_events (actor_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS users_created_at_idx ON app.users (created_at DESC)');
  await knex.raw('CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON app.security_events (created_at DESC)');
  await knex.raw('CREATE INDEX IF NOT EXISTS security_events_type_created_at_idx ON app.security_events (event_type, created_at DESC)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS app.security_events_type_created_at_idx');
  await knex.raw('DROP INDEX IF EXISTS app.security_events_created_at_idx');
  await knex.raw('DROP INDEX IF EXISTS app.users_created_at_idx');
  await knex.raw('DROP INDEX IF EXISTS app.security_events_actor_id_idx');
  await knex.raw('DROP INDEX IF EXISTS app.password_resets_user_id_idx');
  await knex.raw('DROP INDEX IF EXISTS app.sessions_user_id_idx');
};
