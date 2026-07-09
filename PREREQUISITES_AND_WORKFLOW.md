# Runbook Sentinel — Prerequisites & Implementation Workflow

> Single source of truth for anyone (human or AI agent) implementing this project.
> Every item references a real file, service, or known issue. No generic advice.

---

## 1. Prerequisites Checklist

### API Keys & Credentials

Reference: `.env.example` (repo root) for exact variable names.

- [ ] `FEATHERLESS_API_KEY` — sign up at featherless.ai. Used by all 3 agents (TriageAgent, RemediationAgent, PostMortemAgent) via `@ai-sdk/openai-compatible`. Model: `Qwen/Qwen2.5-72B-Instruct`.
- [ ] `QDRANT_URL` + `QDRANT_API_KEY` — local Docker (`http://localhost:6333`, no key) or Qdrant Cloud. Required before `npm run seed` runs.
- [ ] `ENKRYPT_API_KEY` — from enkryptai.com. No TypeScript SDK — raw `fetch()` with Bearer token. System fail-opens if unavailable (see `enkryptGuardrail.ts:52-55`).
- [ ] `DATABASE_URL` — Postgres. Local Docker default: `postgresql://sentinel:sentinel_dev_pass@localhost:5432/runbook_sentinel`
- [ ] `REDIS_URL` — Redis. Local Docker default: `redis://localhost:6379`
- [ ] `JWT_SECRET` — generate: `openssl rand -base64 32`. Used by `apps/api/src/middleware/auth.ts`.
- [ ] `NEXT_PUBLIC_API_URL` — goes in `apps/web/.env.local` (not `apps/api/.env`). Default: `http://localhost:3001`
- [ ] `NEXT_PUBLIC_DEMO_TOKEN` — generate after server starts via `jwt.sign()` in `apps/api/scripts/test-workflow.ts`

### Infrastructure (Docker)

- [ ] `docker compose up -d` — starts Postgres (`:5432`), Redis (`:6379`), Qdrant (`:6333`, `:6334`)
- [ ] `docker compose ps` — verify all 3 containers healthy before running any scripts
- [ ] Qdrant dashboard: `http://localhost:6333/dashboard` — verify collections appear after seed

### Database

- [ ] `npm run migrate --workspace @runbook-sentinel/api` — runs `apps/api/scripts/migrate-db.ts`
      Creates: `incidents`, `workflow_state`, `audit_logs` tables (defined in `docs/guides/02-DATABASE.md`)
- [ ] Script CWD: workspace scripts execute from `apps/api/`, so `tsx scripts/migrate-db.ts` resolves to `apps/api/scripts/migrate-db.ts`
- [ ] `dotenv.config()` reads from `apps/api/.env` automatically — no path argument needed

### Qdrant Seed

- [ ] `npm run seed --workspace @runbook-sentinel/api` — runs `apps/api/scripts/seed-qdrant.ts`
- [ ] Creates 4 collections: `runbooks`, `historical_incidents`, `post_mortems`, `synthesis_drafts`
- [ ] Seeds 3 runbooks, 5 historical incidents, 2 post-mortems (768-dim dense vectors, nomic-embed-text-v1.5)
- [ ] Vectors are `fakeVector()` random arrays — replace with real embeddings before demo

### Local Tooling

- [ ] Node.js 20+ (`node --version`)
- [ ] npm 10+ with workspaces support (`npm --version`)
- [ ] Docker Desktop running (`docker ps`)
- [ ] TypeScript strict mode — `tsconfig.base.json` sets `strict: true`

---

## 2. Implementation Sequence

Follow `implementation_vidhi.md` exactly. Three days, strict ordering within each day.

### Day 1 — Infrastructure Layer

Create files via `docs/guides/01-SETUP.md` and `docs/guides/02-DATABASE.md`:
```
docker-compose.yml              → repo root
apps/api/src/lib/db.ts          → Postgres pool singleton
apps/api/src/lib/redis.ts       → ioredis singleton (export: { redis, checkRedisHealth })
apps/api/scripts/migrate-db.ts  → idempotent table creation
apps/api/package.json           → all deps + 6 scripts (dev, build, start, migrate, seed, smoke-test)
apps/api/tsconfig.json          → paths: { "@/*": ["./src/*"] }
```

Create tools via `docs/guides/03-QDRANT.md` and `docs/guides/04-ENKRYPT.md`:
```
apps/api/src/mastra/tools/enkryptGuardrail.ts  → input/output guardrails, fail-open
apps/api/src/mastra/tools/qdrantSearch.ts      → Dense+BM25+RRF hybrid search
apps/api/src/mastra/tools/qdrantUpsert.ts       → chunk + embed + upsert
apps/api/scripts/seed-qdrant.ts                 → collection creation + seed data
```

**Validation:** `docker compose ps` (3/3), `npm run migrate` (3 tables created)

### Day 2 — Agent + Workflow Layer

**Critical order** — must create `mastra/index.ts` before any agent file (agents import `primaryModel` from `../index`):

1. `apps/api/src/mastra/index.ts` — placeholder with empty `agents: {}`, `workflows: {}`
2. `apps/api/src/mastra/agents/triageAgent.ts`
3. `apps/api/src/mastra/agents/remediationAgent.ts`
4. `apps/api/src/mastra/agents/postMortemAgent.ts`
5. Update `mastra/index.ts` — uncomment agent imports

Then create workflow + OTel (all from guides):
```
apps/api/src/mastra/workflows/incidentWorkflow.ts  → 8 steps + 3 branch gates
apps/api/src/lib/otel.ts                           → NodeSDK init (first import in index.ts)
apps/api/src/lib/telemetry.ts                      → withSpan helper, GenAI semconv attributes
apps/api/scripts/test-workflow.ts                   → direct Mastra call (no HTTP), generates test JWT
```

**Validation:** `npm run smoke-test --workspace @runbook-sentinel/api` — workflow starts, test JWT printed

### Day 3 — API + Frontend Layer

Create middleware + routes + server entry point from `docs/guides/07-API.md`:
```
apps/api/src/middleware/auth.ts            → JWT verify + requireRole()
apps/api/src/middleware/rateLimiter.ts     → Redis sliding window (100 req/min)
apps/api/src/middleware/correlationId.ts   → x-correlation-id injector
apps/api/src/middleware/errorHandler.ts    → global catch-all
apps/api/src/routes/alerts.ts             → POST /v1/incidents
apps/api/src/routes/incidents.ts          → GET /v1/incidents, GET /v1/incidents/:id
apps/api/src/routes/approve.ts            → POST /v1/incidents/:id/approve
apps/api/src/routes/analytics.ts          → GET /v1/analytics/mttr
apps/api/src/routes/knowledge.ts          → GET /v1/knowledge/conflicts
apps/api/src/server.ts                    → Express app factory (helmet, cors, all routes)
apps/api/src/index.ts                     → entry point (otel first, dotenv second)
```

**Key rule:** `server.ts` and `index.ts` must be created in the same session — `index.ts` imports `createApp` from `./server`.

Create frontend from `docs/guides/08-FRONTEND.md`:
```
npm install tailwindcss@3 postcss autoprefixer lucide-react
npx tailwindcss@3 init -p
apps/web/lib/api.ts                         → API client with demo JWT
apps/web/app/layout.tsx                     → RootLayout with Inter font + dark theme
apps/web/app/globals.css                    → @tailwind directives (v3, NOT v4 @import)
apps/web/app/page.tsx                       → Incidents list with 5s auto-refresh
apps/web/app/incidents/[id]/page.tsx        → Detail + Approve/Reject
apps/web/app/analytics/page.tsx             → MTTR bar chart
```

**Validation:** `npm run dev:api` → `curl /health` returns `{ status: "ok" }`. `npm run dev:web` → dashboard loads.

---

## 3. Known Pitfalls (Pre-Fixed in Guides)

| Pitfall | Wrong Pattern | Correct Pattern | Location Fixed |
|---|---|---|---|
| Circular import | Create agent before `mastra/index.ts` | Create `mastra/index.ts` first with placeholder, agents second | `docs/guides/05-AGENTS.md` L3-16 |
| Tailwind v4 syntax | `@import 'tailwindcss/base'` | `@tailwind base` / `@tailwind components` / `@tailwind utilities` | `docs/guides/08-FRONTEND.md` L417-424 |
| Double dotenv path | `dotenv.config({ path: 'apps/api/.env' })` | `dotenv.config()` — CWD is `apps/api/` at runtime | `docs/guides/03-QDRANT.md` L28 |
| Script location | Repo root `scripts/` | `apps/api/scripts/` — workspace CWD is `apps/api/` | `implementation_vidhi.md` L42-43 |
| Smoke test import path | `'../apps/api/src/mastra/index'` | `'../src/mastra/index'` (relative from `apps/api/scripts/`) | `implementation_vidhi.md` L138 |
| Redis export name | `export const redisClient` | `export const redis` | `docs/guides/07-API.md` L348 |
| Server entry point timing | Creates `index.ts` before `server.ts` exists | Create both in same session on Day 3 | `implementation_vidhi.md` L202-204 |
| `@/*` path alias missing | No paths in web tsconfig | `baseUrl: "."`, `paths: { "@/*": ["./*"] }` | `apps/web/tsconfig.json` L14-17 |
| Featherless structured output | `agent.generate(prompt, { output: Schema })` fails | Manual parse: `Schema.parse(JSON.parse(response.text))` | `docs/guides/06-WORKFLOWS.md` recovery pattern |

---

## 4. Secret Management

- `apps/api/.env` — gitignored, copy of `.env.example`. All non-public credentials.
- `apps/web/.env.local` — gitignored. Only contains `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DEMO_TOKEN`.
- `JWT_SECRET` — minimum 32 bytes. Generate: `openssl rand -base64 32`.
- Never log raw `process.env` values. Log `prompt_hash` (SHA-256) only — see `docs/guides/09-OTEL.md` L88-90.
- Enkrypt API key must never appear in frontend code or `NEXT_PUBLIC_*` env vars.

---

## 5. Agent Recovery Prompts

When the AI implementation agent gets stuck, use these verbatim:

### If Mastra imports fail
```
The Mastra API may have changed in the installed version. Run:
  cat node_modules/@mastra/core/package.json | grep version
Then look at the actual exported types in node_modules/@mastra/core/dist/index.d.ts
Adjust imports in incidentWorkflow.ts to match exactly what is exported.
```

### If Qdrant hybrid search fails
```
The @qdrant/js-client-rest version may not support query() with prefetch yet.
Downgrade to standard search:
  const result = await qdrant.search(collection, {
    vector: denseVector,
    limit: topK,
    with_payload: true,
  });
Note this simplification in a comment. Core RAG functionality is preserved.
```

### If Featherless structured output fails
```
Some Featherless models don't support strict JSON mode via output: Schema.
Instead:
  1. Add to prompt: "Respond with valid JSON only. Schema: " + JSON.stringify(zodToJsonSchema(MySchema))
  2. Parse manually: const parsed = MySchema.parse(JSON.parse(response.text))
Install zod-to-json-schema: npm install zod-to-json-schema
```

### If workflow suspend/resume API doesn't match
```
Check the installed Mastra version for the correct suspend/resume API.
Try: run.resume({ stepId: 'hitl_gate', context: { approved: true, approverId: 'test' } })
If run.resume doesn't exist, check if it's: workflow.resume(runId, stepId, resumeData)
```

---

## 6. File Reference Map

| File | Guide | Created On |
|---|---|---|
| `docker-compose.yml` | 01-SETUP | Day 1 AM |
| `apps/api/package.json` | 01-SETUP | Day 1 AM |
| `apps/api/tsconfig.json` | 01-SETUP | Day 1 AM |
| `apps/api/src/lib/db.ts` | 02-DATABASE | Day 1 AM |
| `apps/api/src/lib/redis.ts` | 07-API | Day 1 AM |
| `apps/api/scripts/migrate-db.ts` | 02-DATABASE | Day 1 AM |
| `apps/api/src/mastra/tools/enkryptGuardrail.ts` | 04-ENKRYPT | Day 1 PM |
| `apps/api/src/mastra/tools/qdrantSearch.ts` | 03-QDRANT | Day 1 PM |
| `apps/api/src/mastra/tools/qdrantUpsert.ts` | 03-QDRANT | Day 1 PM |
| `apps/api/scripts/seed-qdrant.ts` | 03-QDRANT | Day 1 PM |
| `apps/api/src/mastra/index.ts` | 05-AGENTS | Day 2 AM |
| `apps/api/src/mastra/agents/triageAgent.ts` | 05-AGENTS | Day 2 AM |
| `apps/api/src/mastra/agents/remediationAgent.ts` | 05-AGENTS | Day 2 AM |
| `apps/api/src/mastra/agents/postMortemAgent.ts` | 05-AGENTS | Day 2 AM |
| `apps/api/src/mastra/workflows/incidentWorkflow.ts` | 06-WORKFLOWS | Day 2 PM |
| `apps/api/src/lib/otel.ts` | 09-OTEL | Day 2 PM |
| `apps/api/src/lib/telemetry.ts` | 09-OTEL | Day 2 PM |
| `apps/api/scripts/test-workflow.ts` | Day 2 prompt | Day 2 PM |
| `apps/api/src/middleware/*.ts` | 07-API | Day 3 AM |
| `apps/api/src/routes/*.ts` | 07-API | Day 3 AM |
| `apps/api/src/server.ts` | 07-API | Day 3 AM |
| `apps/api/src/index.ts` | 07-API | Day 3 AM |
| `apps/web/lib/api.ts` | 08-FRONTEND | Day 3 Mid |
| `apps/web/app/layout.tsx` | 08-FRONTEND | Day 3 Mid |
| `apps/web/app/globals.css` | 08-FRONTEND | Day 3 Mid |
| `apps/web/app/page.tsx` | 08-FRONTEND | Day 3 Mid |
| `apps/web/app/incidents/[id]/page.tsx` | 08-FRONTEND | Day 3 Mid |
| `apps/web/app/analytics/page.tsx` | 08-FRONTEND | Day 3 Mid |

---

## 7. Acceptance Criteria (Minimal Demo)

The judges will verify these in 3 minutes:

- [ ] `POST /v1/incidents` with a synthetic payload returns `202` + `incidentId`
- [ ] TriageAgent outputs valid `TriageSchema` JSON with `severity`, `confidence_score`, `reasoning`
- [ ] Workflow status transitions: `open` → `triaging` → `awaiting_approval`
- [ ] `POST /v1/incidents/:id/approve` with `{ approved: true }` resumes workflow
- [ ] Final status: `resolved` with `mttr_minutes` populated
- [ ] Qdrant `post_mortems` collection has a new entry from `writeback` step
- [ ] HITL Dashboard shows real-time incident status updates
- [ ] MTTR Analytics page loads with a chart
