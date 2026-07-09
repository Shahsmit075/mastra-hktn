# Guide 02 — Database Schema (PostgreSQL)

## File to Create: `apps/api/scripts/migrate-db.ts`

> ⚠️ This file lives inside the `apps/api/` workspace, NOT at repo root.
> When `npm run migrate --workspace @runbook-sentinel/api` runs, the CWD is `apps/api/`,
> so `tsx scripts/migrate-db.ts` resolves correctly to `apps/api/scripts/migrate-db.ts`.
> `dotenv.config()` with no arguments reads from `apps/api/.env` automatically.

This script is idempotent — safe to run multiple times.

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
```

## File to Create: `apps/api/src/lib/db.ts`

```typescript
import { Pool } from 'pg';

// Singleton pool — shared across the entire API process
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres client error', err);
});

export { pool };

// Helper: run query with automatic client release
export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.LOG_LEVEL === 'debug') {
    console.debug('query executed', { text, duration, rows: result.rowCount });
  }
  return result;
}

// Helper: check DB connectivity
export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
```

## Schema Notes

### `incidents.status` State Machine

```
open → triaging → awaiting_approval → executing → post_mortem → resolved
                ↘ (confidence < 0.85) → awaiting_manual_review → (IC assigns) → resolved
                                                                → (IC escalates) → triaging
```

### `workflow_state.idempotency_key` Format

Always: `{incidentId}:{stepName}`  
Example: `a3f1b2c4-...:triage` or `a3f1b2c4-...:remediation`

This key prevents an LLM call from being re-executed if a service crashes and restarts. The logic is:
1. Before executing any step, query `workflow_state` for `idempotency_key = '{incidentId}:{stepName}'`
2. If a row exists with `status = 'completed'`, use `result_json` directly — skip the LLM call
3. If no row exists, execute the step and INSERT the result

### `audit_logs.prompt_hash` Format

SHA-256 hex digest of the raw prompt string before Enkrypt AI processes it.  
Never store the raw prompt — only the hash.

```typescript
import { createHash } from 'crypto';

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt, 'utf8').digest('hex');
}
```
