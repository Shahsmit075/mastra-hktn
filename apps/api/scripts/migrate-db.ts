import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── incidents ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status          VARCHAR(20) NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','triaging','awaiting_approval',
                                           'executing','post_mortem','resolved','failed')),
        severity        VARCHAR(10) CHECK (severity IN ('SEV1','SEV2','SEV3')),
        service_id      VARCHAR(100) NOT NULL,
        correlation_id  VARCHAR(100) UNIQUE NOT NULL,
        raw_payload     JSONB NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at     TIMESTAMPTZ,
        mttr_minutes    INTEGER
      );
    `);

    // ─── workflow_state ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_state (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id      UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        step_name        VARCHAR(50) NOT NULL,
        status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','running','completed','failed','suspended')),
        result_json      JSONB,
        traceparent      VARCHAR(200),
        idempotency_key  VARCHAR(200) UNIQUE NOT NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_incident ON workflow_state(incident_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_idempotency ON workflow_state(idempotency_key);
    `);

    // ─── audit_logs ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id  UUID REFERENCES incidents(id) ON DELETE SET NULL,
        user_id      VARCHAR(100),
        role         VARCHAR(30),
        action       VARCHAR(50) NOT NULL,
        prompt_hash  VARCHAR(64),
        payload      JSONB,
        timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_incident ON audit_logs(incident_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
    `);

    await client.query('COMMIT');
    console.log('✅ Database migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
