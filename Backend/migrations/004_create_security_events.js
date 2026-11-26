exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE app.security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      event_type VARCHAR(100) NOT NULL,
      actor_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
      target_id UUID,
      result VARCHAR(50) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      request_id VARCHAR(255)
    )
  `);

  await knex.raw('ALTER TABLE app.security_events ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE app.security_events FORCE ROW LEVEL SECURITY');

  await knex.raw(`
    CREATE POLICY security_events_admin_select
    ON app.security_events
    FOR SELECT
    USING (
      current_setting('app.user_role', true) = 'admin'
      OR current_setting('request.jwt.claim.role', true) = 'admin'
      OR NULLIF(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,role}' = 'admin'
    )
  `);

  await knex.raw(`
    CREATE POLICY security_events_authenticated_insert
    ON app.security_events
    FOR INSERT
    WITH CHECK (
      current_setting('app.audit_write', true) = 'true'
      OR (
        COALESCE(
          NULLIF(current_setting('request.jwt.claim.role', true), ''),
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
        ) = 'authenticated'
        AND COALESCE(
          NULLIF(current_setting('request.jwt.claim.sub', true), ''),
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
        ) IS NOT NULL
      )
      OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    )
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS app.security_events');
};
