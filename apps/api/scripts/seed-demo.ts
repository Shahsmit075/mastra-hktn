import { Pool } from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEMO_INCIDENTS = [
  // ── RESOLVED ────────────────────────────────────────────────────────────────
  {
    id: uuidv4(),
    correlation_id: `DEMO-RESOLVED-001-${Date.now()}`,
    service_id: 'payments-service',
    status: 'resolved',
    severity: 'SEV1',
    mttr_minutes: 22,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),   // 5 days ago
    resolved_at: new Date(Date.now() - 86400000 * 5 + 22 * 60000).toISOString(),
    raw_payload: {
      source: 'prometheus', alert_name: 'HighErrorRate',
      description: 'Payments service error rate hit 12.4%. Connection pool fully exhausted (20/20). P99 latency: 4.8s.',
      metrics: { error_rate: 0.124, p99_latency_ms: 4800, pool_used: 20, pool_max: 20 },
      labels: { env: 'production', region: 'us-east-1' },
    },
  },
  {
    id: uuidv4(),
    correlation_id: `DEMO-RESOLVED-002-${Date.now() + 1}`,
    service_id: 'auth-service',
    status: 'resolved',
    severity: 'SEV1',
    mttr_minutes: 28,
    created_at: new Date(Date.now() - 86400000 * 14).toISOString(),  // 14 days ago
    resolved_at: new Date(Date.now() - 86400000 * 14 + 28 * 60000).toISOString(),
    raw_payload: {
      source: 'pagerduty', alert_name: 'ServiceUnavailable',
      description: 'Auth service returning 503. HPA not configured — single replica overwhelmed by traffic spike.',
      metrics: { rps: 1850, replica_count: 1, cpu_percent: 99 },
      labels: { env: 'production', region: 'us-west-2' },
    },
  },
  {
    id: uuidv4(),
    correlation_id: `DEMO-RESOLVED-003-${Date.now() + 2}`,
    service_id: 'redis-cache',
    status: 'resolved',
    severity: 'SEV2',
    mttr_minutes: 14,
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
    resolved_at: new Date(Date.now() - 86400000 * 9 + 14 * 60000).toISOString(),
    raw_payload: {
      source: 'prometheus', alert_name: 'RedisMemoryPressure',
      description: 'Redis eviction rate spiked to 4,300/min. Memory at 98%. Cache miss rate 62%.',
      metrics: { evictions_per_min: 4300, memory_used_percent: 0.98, cache_miss_rate: 0.62 },
      labels: { env: 'production', region: 'eu-west-1' },
    },
  },
  {
    id: uuidv4(),
    correlation_id: `DEMO-RESOLVED-004-${Date.now() + 3}`,
    service_id: 'api-gateway',
    status: 'resolved',
    severity: 'SEV2',
    mttr_minutes: 8,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    resolved_at: new Date(Date.now() - 86400000 * 3 + 8 * 60000).toISOString(),
    raw_payload: {
      source: 'webhook', alert_name: 'HighLatency',
      description: 'API Gateway P99 latency crossed 2.5s. Upstream payment-service rate-limiting.',
      metrics: { p99_latency_ms: 2500, upstream_errors: 423, rate_limit_hits: 1200 },
      labels: { env: 'production', region: 'us-east-1' },
    },
  },

  // ── POST-MORTEM (AI wrote it, reviewed) ─────────────────────────────────────
  {
    id: uuidv4(),
    correlation_id: `DEMO-POSTMORTEM-001-${Date.now() + 4}`,
    service_id: 'inventory-service',
    status: 'post_mortem',
    severity: 'SEV1',
    mttr_minutes: 45,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    resolved_at: new Date(Date.now() - 86400000 * 2 + 45 * 60000).toISOString(),
    raw_payload: {
      source: 'prometheus', alert_name: 'OOMKilled',
      description: 'Inventory service pods OOMKilled repeatedly. Memory limits not set on deployment. DB migration ran without limits.',
      metrics: { oom_kills: 7, memory_request_mb: 256, memory_actual_mb: 3400 },
      labels: { env: 'production', region: 'us-east-1' },
    },
  },

  // ── AWAITING APPROVAL (AI triaged, plan ready, needs human sign-off) ─────────
  {
    id: uuidv4(),
    correlation_id: `DEMO-APPROVAL-001-${Date.now() + 5}`,
    service_id: 'checkout-service',
    status: 'awaiting_approval',
    severity: 'SEV1',
    mttr_minutes: null,
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 minutes ago
    resolved_at: null,
    raw_payload: {
      source: 'prometheus', alert_name: 'CheckoutFailures',
      description: 'Checkout service failure rate at 23%. Stripe webhook timeout. DB connection pool at 95%.',
      metrics: { failure_rate: 0.23, webhook_timeout_ms: 30000, pool_utilization: 0.95 },
      labels: { env: 'production', region: 'us-east-1' },
    },
  },

  // ── TRIAGING (AI agents actively working) ───────────────────────────────────
  {
    id: uuidv4(),
    correlation_id: `DEMO-TRIAGING-001-${Date.now() + 6}`,
    service_id: 'notification-service',
    status: 'triaging',
    severity: 'SEV2',
    mttr_minutes: null,
    created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),  // 4 minutes ago
    resolved_at: null,
    raw_payload: {
      source: 'pagerduty', alert_name: 'EmailDeliveryFailure',
      description: 'Email delivery failure rate 34%. SMTP pool exhausted. Transactional emails queued.',
      metrics: { delivery_failure_rate: 0.34, smtp_pool_active: 50, smtp_pool_max: 50 },
      labels: { env: 'production', region: 'us-east-1' },
    },
  },

  // ── OPEN (just came in) ──────────────────────────────────────────────────────
  {
    id: uuidv4(),
    correlation_id: `DEMO-OPEN-001-${Date.now() + 7}`,
    service_id: 'recommendation-engine',
    status: 'open',
    severity: 'SEV3',
    mttr_minutes: null,
    created_at: new Date(Date.now() - 1000 * 60 * 1).toISOString(),  // 1 minute ago
    resolved_at: null,
    raw_payload: {
      source: 'prometheus', alert_name: 'HighInferenceLatency',
      description: 'Recommendation model inference latency P95: 3.1s. GPU utilization 98%. Auto-scaling not triggered.',
      metrics: { p95_latency_ms: 3100, gpu_utilization: 0.98, model_requests_queued: 847 },
      labels: { env: 'production', region: 'us-east-1' },
    },
  },
];

async function seedDemo() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding demo incidents into PostgreSQL...\n');

    // Clear existing demo data to avoid duplicates on re-run
    await client.query(`DELETE FROM incidents WHERE correlation_id LIKE 'DEMO-%'`);

    for (const inc of DEMO_INCIDENTS) {
      await client.query(
        `INSERT INTO incidents (id, correlation_id, service_id, status, severity, mttr_minutes, created_at, resolved_at, raw_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          inc.id,
          inc.correlation_id,
          inc.service_id,
          inc.status,
          inc.severity,
          inc.mttr_minutes,
          inc.created_at,
          inc.resolved_at,
          JSON.stringify(inc.raw_payload),
        ]
      );
      const icon = {
        resolved: '✅', post_mortem: '📋', awaiting_approval: '⏳',
        triaging: '🔍', open: '🔴',
      }[inc.status] || '•';
      console.log(`${icon} Seeded [${inc.status.toUpperCase()}] ${inc.service_id} - ${inc.severity || 'no sev'}`);
    }

    console.log(`\n✅ ${DEMO_INCIDENTS.length} demo incidents seeded successfully!`);
    console.log('→ Refresh http://localhost:3000 to see your full dashboard.\n');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemo();
