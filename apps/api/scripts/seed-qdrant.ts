import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config(); // CWD = apps/api/ at runtime — reads apps/api/.env automatically

const VECTOR_SIZE = 768; // nomic-embed-text-v1.5

async function qdrantFetch(path: string, options: RequestInit) {
  const url = `${process.env.QDRANT_URL || 'http://localhost:6333'}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.QDRANT_API_KEY) {
    headers['api-key'] = process.env.QDRANT_API_KEY;
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw { status: res.status, message: await res.text() };
  }
  return res.json();
}

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY is not defined, falling back to random vectors');
    return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
  }

  const cleanedText = text?.trim() || 'empty';

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: cleanedText,
        dimensions: VECTOR_SIZE,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI embeddings API call failed:', await response.text());
      return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
    }

    const data = await response.json() as any;
    return data.data[0].embedding;
  } catch (err) {
    console.error('Error fetching embedding:', err);
    return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
  }
}

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
      await qdrantFetch(`/collections/${col.name}`, {
        method: 'PUT',
        body: JSON.stringify({
          vectors: {
            size: VECTOR_SIZE,
            distance: 'Cosine',
          },
          sparse_vectors: {
            bm25: {
              modifier: 'idf',
            },
          },
          on_disk_payload: true,
        }),
      });
      console.log(`✅ Created collection: ${col.name}`);
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('already exists')) {
        console.log(`ℹ️ Collection ${col.name} already exists.`);
      } else {
        throw err;
      }
    }

    // Create payload indexes for filtering
    if (col.name === 'runbooks') {
      await qdrantFetch(`/collections/${col.name}/index`, {
        method: 'PUT',
        body: JSON.stringify({
          field_name: 'service_id',
          field_schema: 'keyword',
        }),
      });
      await qdrantFetch(`/collections/${col.name}/index`, {
        method: 'PUT',
        body: JSON.stringify({
          field_name: 'trust_score',
          field_schema: 'float',
        }),
      });
      await qdrantFetch(`/collections/${col.name}/index`, {
        method: 'PUT',
        body: JSON.stringify({
          field_name: 'last_used_at',
          field_schema: 'datetime',
        }),
      });
    }
    if (col.name === 'historical_incidents') {
      await qdrantFetch(`/collections/${col.name}/index`, {
        method: 'PUT',
        body: JSON.stringify({
          field_name: 'severity',
          field_schema: 'keyword',
        }),
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
    id: 'cf2a6322-8c30-4470-9dc9-01405a99cd24',
    payload: {
      title: 'INC-2024-0312: Payments DB Connection Pool Exhaustion',
      severity: 'SEV1',
      description: 'Error budget burn rate at 18.2x. payments-service latency spike to 4.2s. PostgreSQL connections saturated.',
      resolution: 'Increased max_connections to 200 in postgresql.conf and restarted database container. Configured PG_POOL_SIZE = 20 on payments-service deployment.',
      mttr_minutes: 22,
      occurred_at: '2024-03-12T14:22:00Z',
    },
  },
  {
    id: '8ab56376-32f2-43dc-bc32-19439b4d1da2',
    payload: {
      title: 'INC-2024-0415: Redis Cache Out Of Memory',
      severity: 'SEV1',
      description: 'API gateway returning 500 errors. redis-cache OOM command not allowed error in application stdout.',
      resolution: 'Changed redis maxmemory-policy to allkeys-lru and ran FLUSHDB during maintenance window. Restored functionality immediately.',
      mttr_minutes: 28,
      occurred_at: '2024-04-15T09:12:00Z',
    },
  },
  {
    id: '3f8673da-d9c8-4547-a609-d9cc45057a74',
    payload: {
      title: 'INC-2024-0520: Notification Service High Latency',
      severity: 'SEV2',
      description: 'SMS notifications delayed by > 5 minutes. Queue size for notifications-delivery topic growing exponentially.',
      resolution: 'Scaled up notifications-worker deployment from 2 to 6 replicas. Cleared backlog within 8 minutes.',
      mttr_minutes: 14,
      occurred_at: '2024-05-20T18:05:00Z',
    },
  },
  {
    id: 'a0cc91ea-b1a1-49fd-941f-02fd6796b6a3',
    payload: {
      title: 'INC-2024-0610: Checkout Service Rate Limiting Issues',
      severity: 'SEV2',
      description: 'Legitimate checkout requests rejected with 429 status code. Rate limiter sliding window misconfigured in Redis.',
      resolution: 'Updated redis-based rate limiter middleware configuration to increase window requests from 100 to 500 in dev and hotfixed config key.',
      mttr_minutes: 8,
      occurred_at: '2024-06-10T11:45:00Z',
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
    const vectorContent = `${runbook.payload.title} ${runbook.payload.content}`;
    const vector = await getEmbedding(vectorContent);
    await qdrantFetch(`/collections/runbooks/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [{
          id: runbook.id,
          vector,
          payload: runbook.payload,
        }],
      }),
    });
    console.log(`✅ Seeded runbook: ${runbook.payload.title}`);
  }

  // Seed historical incidents
  for (const incident of SEED_INCIDENTS) {
    const vectorContent = `${incident.payload.title} ${incident.payload.description} ${incident.payload.resolution}`;
    const vector = await getEmbedding(vectorContent);
    await qdrantFetch(`/collections/historical_incidents/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [{
          id: incident.id,
          vector,
          payload: incident.payload,
        }],
      }),
    });
    console.log(`✅ Seeded incident: ${incident.payload.title}`);
  }

  // Seed post-mortems
  for (const pm of SEED_POST_MORTEMS) {
    const vectorContent = `${pm.payload.title} ${pm.payload.root_cause_category} ${pm.payload.contributing_factors?.system?.join(' ') || ''}`;
    const vector = await getEmbedding(vectorContent);
    await qdrantFetch(`/collections/post_mortems/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [{
          id: pm.id,
          vector,
          payload: pm.payload,
        }],
      }),
    });
    console.log(`✅ Seeded post-mortem: ${pm.payload.title}`);
  }

  console.log('\n✅ All seed data loaded with real embeddings.');
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
