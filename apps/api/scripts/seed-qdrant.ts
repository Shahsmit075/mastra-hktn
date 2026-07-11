import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config(); // CWD = apps/api/ at runtime — reads apps/api/.env automatically

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

const VECTOR_SIZE = 768; // nomic-embed-text-v1.5

const COLLECTIONS = [
  {
    name: 'runbooks',
    description: 'Verified SRE procedures and operational playbooks',
  },
  {
    name: 'historical_incidents',
    description: 'Past incident summaries with resolution outcomes',
  },
  {
    name: 'post_mortems',
    description: 'Blameless post-mortem reports',
  },
  {
    name: 'synthesis_drafts',
    description: 'KFS-generated reconciled documents pending SRE review',
  },
];

async function createCollections() {
  for (const col of COLLECTIONS) {
    try {
      await qdrant.createCollection(col.name, {
        vectors: {
          dense: {
            size: VECTOR_SIZE,
            distance: 'Cosine',
          },
        },
        // Enable sparse vectors for BM25 hybrid search
        sparse_vectors: {
          bm25: {
            modifier: 'idf',
          },
        },
        on_disk_payload: true,
      });
      console.log(`✅ Created collection: ${col.name}`);
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes('already exists')) {
        console.log(`⏭️  Collection already exists: ${col.name}`);
      } else {
        throw err;
      }
    }

    // Create payload indexes for filtering
    if (col.name === 'runbooks') {
      await qdrant.createPayloadIndex(col.name, {
        field_name: 'service_id',
        field_schema: 'keyword',
      });
      await qdrant.createPayloadIndex(col.name, {
        field_name: 'trust_score',
        field_schema: 'float',
      });
      await qdrant.createPayloadIndex(col.name, {
        field_name: 'last_used_at',
        field_schema: 'datetime',
      });
    }
    if (col.name === 'historical_incidents') {
      await qdrant.createPayloadIndex(col.name, {
        field_name: 'severity',
        field_schema: 'keyword',
      });
    }
  }
}

// ─── Synthetic Seed Data ───────────────────────────────────────────────────────

// These are placeholder vectors (random). Replace with real embeddings
// when the embedding model is available. The structure and metadata are correct.
function fakeVector(): number[] {
  return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
}

const SEED_RUNBOOKS = [
  {
    id: uuidv4(),
    payload: {
      title: 'Postgres Connection Pool Exhaustion',
      service_id: 'payments-service',
      content: `
        SYMPTOMS: High latency on /v1/charge endpoint. DB connection timeout errors.
        DIAGNOSIS: Run SELECT count(*) FROM pg_stat_activity. If > 80, pool is full.
        RESOLUTION:
          1. Increase max_connections in postgresql.conf: max_connections = 200
          2. Set PG_POOL_SIZE=20 in app env and restart
          3. Add connection timeout: connect_timeout = 10
          4. Monitor: SELECT wait_event_type, count(*) FROM pg_stat_activity GROUP BY 1
        RISK: mitigating — requires app restart (30s downtime window)
        RUNBOOK_ID: RB-PG-001
        VERIFIED_BY: sre_lead
      `.trim(),
      version: '2.1',
      trust_score: 1.0,
      last_used_at: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
      verified_by: 'sre_lead',
      tags: ['postgres', 'connection-pool', 'database', 'latency'],
    },
  },
  {
    id: uuidv4(),
    payload: {
      title: 'Kubernetes Pod OOMKilled Recovery',
      service_id: 'payments-db',
      content: `
        SYMPTOMS: Pod status shows OOMKilled. Repeated restarts. Memory limit exceeded.
        DIAGNOSIS: kubectl describe pod <pod-name> | grep -A5 OOMKilled
        RESOLUTION:
          1. Identify memory usage: kubectl top pod <pod-name>
          2. Patch memory limit: kubectl patch deployment <name> -p '{"spec":{"template":{"spec":{"containers":[{"name":"<container>","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
          3. Verify rolling restart: kubectl rollout status deployment/<name>
          4. Set HPA: kubectl autoscale deployment <name> --min=2 --max=5
        RISK: mitigating — rolling restart causes 30-90s disruption per pod
        RUNBOOK_ID: RB-K8S-042
        VERIFIED_BY: sre_lead
      `.trim(),
      version: '1.8',
      trust_score: 0.95,
      last_used_at: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
      verified_by: 'sre_lead',
      tags: ['kubernetes', 'oom', 'memory', 'pod', 'restart'],
    },
  },
  {
    id: uuidv4(),
    payload: {
      title: 'Redis Memory Pressure & Eviction',
      service_id: 'auth-service',
      content: `
        SYMPTOMS: Cache miss rate spike. AUTH_SERVICE latency > 500ms. Redis MAXMEMORY hit.
        DIAGNOSIS: redis-cli info memory | grep used_memory_human
        RESOLUTION:
          1. Check eviction policy: redis-cli config get maxmemory-policy
          2. Set to allkeys-lru: redis-cli config set maxmemory-policy allkeys-lru
          3. Increase memory if possible: redis-cli config set maxmemory 4gb
          4. Identify large keys: redis-cli --bigkeys
          5. If critical: redis-cli FLUSHDB (CAUTION: clears all sessions)
        RISK: high — FLUSHDB logs all users out. Requires IC approval.
        RUNBOOK_ID: RB-RD-007
        VERIFIED_BY: sre_lead
      `.trim(),
      version: '3.0',
      trust_score: 0.9,
      last_used_at: new Date(Date.now() - 86400000 * 45).toISOString(), // 45 days ago — slightly stale
      verified_by: 'sre_lead',
      tags: ['redis', 'cache', 'memory', 'eviction', 'session'],
    },
  },
];

const SEED_INCIDENTS = [
  {
    id: uuidv4(),
    payload: {
      title: 'INC-2024-0312: OOMKilled on payments-db',
      incident_id: 'INC-2024-0312',
      severity: 'SEV1',
      service_id: 'payments-db',
      root_cause: 'Missing memory limits on payments-db deployment',
      resolution: 'Applied 4Gi memory limit via kubectl patch. Rolling restart.',
      mttr: 22,
      resolution_status: 'resolved',
      occurred_at: new Date(Date.now() - 86400000 * 90).toISOString(),
      tags: ['kubernetes', 'oom', 'memory', 'payments-db'],
    },
  },
  {
    id: uuidv4(),
    payload: {
      title: 'INC-2024-0418: Connection pool exhaustion on payments-service',
      incident_id: 'INC-2024-0418',
      severity: 'SEV1',
      service_id: 'payments-service',
      root_cause: 'Sudden traffic spike + inadequate PG pool size (default 5)',
      resolution: 'Increased PG_POOL_SIZE to 20 and restarted service. Added connection monitoring.',
      mttr: 35,
      resolution_status: 'resolved',
      occurred_at: new Date(Date.now() - 86400000 * 75).toISOString(),
      tags: ['postgres', 'connection-pool', 'payments'],
    },
  },
  {
    id: uuidv4(),
    payload: {
      title: 'INC-2024-0521: Redis eviction causing auth failures',
      incident_id: 'INC-2024-0521',
      severity: 'SEV2',
      service_id: 'auth-service',
      root_cause: 'Redis maxmemory policy was noeviction — caused OOM errors',
      resolution: 'Changed policy to allkeys-lru. Auth service recovered within 5 minutes.',
      mttr: 18,
      resolution_status: 'resolved',
      occurred_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      tags: ['redis', 'auth', 'cache', 'eviction'],
    },
  },
  {
    id: uuidv4(),
    payload: {
      title: 'INC-2024-0601: Payments latency spike (DB slow queries)',
      incident_id: 'INC-2024-0601',
      severity: 'SEV2',
      service_id: 'payments-service',
      root_cause: 'Missing index on transactions.created_at caused full table scan',
      resolution: 'Added CONCURRENTLY index. Query time dropped from 8s to 12ms.',
      mttr: 45,
      resolution_status: 'resolved',
      occurred_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      tags: ['postgres', 'query', 'index', 'performance', 'payments'],
    },
  },
  {
    id: uuidv4(),
    payload: {
      title: 'INC-2024-0615: Auth service 503s under load',
      incident_id: 'INC-2024-0615',
      severity: 'SEV1',
      service_id: 'auth-service',
      root_cause: 'HPA not configured. Single replica could not handle traffic.',
      resolution: 'Deployed HPA min=2 max=5. Added Redis session TTL to reduce load.',
      mttr: 28,
      resolution_status: 'resolved',
      occurred_at: new Date(Date.now() - 86400000 * 14).toISOString(),
      tags: ['kubernetes', 'hpa', 'auth', 'scaling', 'traffic'],
    },
  },
];

const SEED_POST_MORTEMS = [
  {
    id: uuidv4(),
    payload: {
      title: 'Post-Mortem: INC-2024-0312 OOMKilled payments-db',
      incident_id: 'INC-2024-0312',
      severity: 'SEV1',
      affected_service: 'payments-db',
      mttr: 22,
      mttr_delta: -8, // 8 minutes faster than 90-day p50 at the time
      root_cause_category: 'System',
      contributing_factors: {
        system: ['No memory limits set on K8s deployment', 'No HPA configured'],
        process: ['Runbook RB-K8S-042 not consulted during deployment'],
        human: ['UI ambiguity in deployment config form — limits field not obvious'],
      },
      action_items: [
        { description: 'Add memory limits to all deployments', owner_role: 'on_call_engineer', target_date: '2024-04-01' },
        { description: 'Add K8s resource limits to deployment checklist', owner_role: 'sre_lead', target_date: '2024-04-15' },
      ],
    },
  },
  {
    id: uuidv4(),
    payload: {
      title: 'Post-Mortem: INC-2024-0601 Payments latency spike',
      incident_id: 'INC-2024-0601',
      severity: 'SEV2',
      affected_service: 'payments-service',
      mttr: 45,
      mttr_delta: 12, // 12 minutes SLOWER than 90-day p50 — regression
      root_cause_category: 'Process',
      contributing_factors: {
        system: ['Missing index on high-cardinality column'],
        process: ['No query performance review in deployment checklist'],
        human: ['Engineer unfamiliar with EXPLAIN ANALYZE output'],
      },
      action_items: [
        { description: 'Add query plan review to PR checklist for DB migrations', owner_role: 'sre_lead', target_date: '2024-07-01' },
        { description: 'Set up pg_stat_statements monitoring', owner_role: 'on_call_engineer', target_date: '2024-06-15' },
      ],
    },
  },
];

async function seedData() {
  // Seed runbooks
  for (const runbook of SEED_RUNBOOKS) {
    await qdrant.upsert('runbooks', {
      wait: true,
      points: [{
        id: runbook.id,
        vector: { dense: fakeVector() },
        payload: runbook.payload,
      }],
    });
    console.log(`✅ Seeded runbook: ${runbook.payload.title}`);
  }

  // Seed historical incidents
  for (const incident of SEED_INCIDENTS) {
    await qdrant.upsert('historical_incidents', {
      wait: true,
      points: [{
        id: incident.id,
        vector: { dense: fakeVector() },
        payload: incident.payload,
      }],
    });
    console.log(`✅ Seeded incident: ${incident.payload.title}`);
  }

  // Seed post-mortems
  for (const pm of SEED_POST_MORTEMS) {
    await qdrant.upsert('post_mortems', {
      wait: true,
      points: [{
        id: pm.id,
        vector: { dense: fakeVector() },
        payload: pm.payload,
      }],
    });
    console.log(`✅ Seeded post-mortem: ${pm.payload.title}`);
  }

  console.log('\n✅ All seed data loaded. Replace fake vectors with real embeddings before demo.');
}

async function main() {
  await createCollections();
  await seedData();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
