# Runbook Sentinel — Implementation Execution Plan
> Last updated: 2026-07-09 | All 9 pre-flight gaps patched

---

## Pre-Flight: What Was Fixed Before Starting

| Gap | Fix |
|---|---|
| `routes/incidents.ts`, `analytics.ts`, `knowledge.ts` missing | Added to Guide 07 |
| `lib/redis.ts` export name undefined | Added explicit file with `{ redis, checkRedisHealth }` exports |
| Tailwind v4 `@import` syntax breaks Next.js | Fixed to v3 `@tailwind` directives in Guide 08 |
| `@/*` path alias missing from web tsconfig | Added `baseUrl` + `paths` to `apps/web/tsconfig.json` |
| `apps/web/lib/` directory not created | Explicit `mkdir -p` added to Guide 08 setup section |
| Circular import: agents created before `mastra/index.ts` | Creation order warning added to top of Guide 05 |
| `.env.example` missing | Already exists at repo root (3656 bytes) |
| `routes/knowledge.ts` imported but never written | Full implementation added to Guide 07 |

---

## Day 1 — Infrastructure + Integration Layer (8 hrs)

### Morning (4 hrs): Setup + DB + Docker

Paste into Cursor Composer:

```
@docs/guides/01-SETUP.md @docs/guides/02-DATABASE.md

Based on these two guides, do the following in exact order:
1. Create docker-compose.yml at repo root (Postgres + Redis + Qdrant)
2. Update apps/api/package.json with ALL of the following:
   a. dependencies and devDependencies from Guide 01
   b. scripts section EXACTLY as:
      "migrate": "tsx scripts/migrate-db.ts"
      "seed": "tsx scripts/seed-qdrant.ts"
      "smoke-test": "tsx scripts/test-workflow.ts"

   Note: These paths resolve to apps/api/scripts/*.ts because npm workspace
   scripts execute with CWD = apps/api/. Scripts must live INSIDE apps/api/scripts/.
   (Already added to apps/api/package.json — verify they're there before proceeding)
      "dev": "tsx watch src/index.ts"
      "build": "tsc -p tsconfig.json"
3. Replace apps/api/tsconfig.json with the exact config from Guide 01
4. Create apps/api/src/lib/db.ts exactly as specified in Guide 02
5. Create apps/api/src/lib/redis.ts exactly as specified in Guide 07
   (export name must be { redis, checkRedisHealth } — not redisClient)
6. Create apps/api/scripts/migrate-db.ts exactly as in Guide 02
   (NOT at repo root scripts/ — workspace CWD is apps/api/)
7. Run: npm install --workspace @runbook-sentinel/api
Confirm all files exist before finishing.
```

**Day 1 Morning Validation:**
```bash
docker compose up -d
docker compose ps   # all 3 containers: postgres, redis, qdrant
npm run migrate --workspace @runbook-sentinel/api
# Expected: ✅ Database migration complete
```

### Afternoon (4 hrs): Enkrypt + Qdrant Tools

Paste into Cursor Composer:

```
@docs/guides/03-QDRANT.md @docs/guides/04-ENKRYPT.md

Create these files exactly as specified. Do not summarize or shorten any code:
1. apps/api/src/mastra/tools/enkryptGuardrail.ts — full file from Guide 04
2. apps/api/src/mastra/tools/qdrantSearch.ts — full file from Guide 03
3. apps/api/src/mastra/tools/qdrantUpsert.ts — full file from Guide 03
4. apps/api/scripts/seed-qdrant.ts — full seed script from Guide 03
   Use dotenv.config() — no path argument needed (CWD is apps/api/ at runtime)
```

---

## Day 2 — Agents + Workflow (8 hrs)

### ⚠️ Critical Ordering Rule for Agents
`mastra/index.ts` MUST be created before any agent file. Agents import `primaryModel` from `../index`. Creating agents first = circular import error in TypeScript strict mode.

Correct order:
1. `apps/api/src/mastra/index.ts` ← FIRST
2. `triageAgent.ts` → `remediationAgent.ts` → `postMortemAgent.ts`
3. Update `index.ts` to import the three agents

### Morning (3 hrs): Agents + index.ts

Paste into Cursor Composer:

```
@docs/guides/05-AGENTS.md

Follow the CRITICAL creation order in the guide:
Step 1 — Create apps/api/src/mastra/index.ts first.
  For the initial version, comment out the agent imports since agents don't exist yet:
  // import { triageAgent } from './agents/triageAgent';
  Export featherlessProvider and primaryModel and fastModel. 
  Create a placeholder mastra instance with empty agents and workflows.

Step 2 — Create the three agent files exactly as written:
  1. apps/api/src/mastra/agents/triageAgent.ts
  2. apps/api/src/mastra/agents/remediationAgent.ts
  3. apps/api/src/mastra/agents/postMortemAgent.ts
  Do NOT shorten the CRISPE system prompts — full text is mandatory for demo quality.

Step 3 — Update apps/api/src/mastra/index.ts:
  Uncomment the agent imports and add all three agents to the Mastra instance.
```

### Midday + Afternoon (5 hrs): Workflow + OTel

Paste agents + workflow in one combined prompt (prevents AI losing agent schema context):

```
@docs/guides/05-AGENTS.md @docs/guides/06-WORKFLOWS.md @docs/guides/09-OTEL.md

Create these files in order:
1. apps/api/src/mastra/workflows/incidentWorkflow.ts — full file from Guide 06
   Rules:
   - Keep ALL 8 steps: sanitize, triage, confidence_gate, retrieval, remediation,
     hitl_gate, post_mortem, writeback
   - Keep getOrExecuteStep() idempotency helper exactly as written
   - Keep all branch logic (blocked halt, manual review halt, rejected halt)
   - If too large for one pass, split at step definitions and generate in 2 parts

2. apps/api/src/lib/otel.ts — full SDK init from Guide 09

3. apps/api/src/lib/telemetry.ts — withSpan helper + GenAI attributes from Guide 09

4. apps/api/scripts/test-workflow.ts — call Mastra directly (NOT via HTTP — server.ts
   doesn't exist yet on Day 2). Use this exact pattern:

   import 'dotenv/config';
   import { mastra } from '../src/mastra/index';
   import jwt from 'jsonwebtoken';

   const token = jwt.sign(
     { id: 'test-ic-01', role: 'incident_commander', email: 'ic@test.com' },
     process.env.JWT_SECRET!,
     { expiresIn: '1h' }
   );
   console.log('TEST JWT:', token);

   const workflow = mastra.getWorkflow('incident-response');
   const run = await workflow.createRun();
   const result = await run.start({
     inputData: {
       rawPayload: JSON.stringify({
         source: 'prometheus',
         service_id: 'payments-service',
         alert_name: 'HighErrorRate',
         description: 'Error rate 8.2%. P99 4.2s. Connection pool exhausted.',
         metrics: { error_rate: 0.082, p99_latency_ms: 4200 }
       }),
       incidentId: 'test-incident-001',
       correlationId: 'test-correlation-001',
       traceparent: null,
     },
   });
   console.log('Workflow result:', JSON.stringify(result, null, 2));

   DO NOT create apps/api/src/index.ts yet — that requires server.ts which is Day 3.
```

**Day 2 Validation:**
```bash
# No dev:api yet — server.ts doesn't exist. Run the direct workflow smoke test:
npm run smoke-test --workspace @runbook-sentinel/api
# Expected: workflow starts, TriageAgent log output in console, test JWT printed
# tsx resolves via workspace scripts — do NOT use npx tsx directly from root
```

---

## Day 3 — API + Frontend + Demo Polish (8 hrs)

### Morning (3 hrs): API Routes

Paste into Cursor Composer:

```
@docs/guides/07-API.md

Create ALL files from this guide in this order:
Middleware first:
  1. apps/api/src/middleware/auth.ts
  2. apps/api/src/middleware/rateLimiter.ts  (imports { redis } from '../lib/redis')
  3. apps/api/src/middleware/correlationId.ts
  4. apps/api/src/middleware/errorHandler.ts

Routes:
  5. apps/api/src/routes/alerts.ts
  6. apps/api/src/routes/incidents.ts  (GET / and GET /:id — both endpoints)
  7. apps/api/src/routes/approve.ts
  8. apps/api/src/routes/analytics.ts  (GET /mttr)
  9. apps/api/src/routes/knowledge.ts  (GET /conflicts — requireRole sre_lead)

Server + entry point (create BOTH together since index.ts imports server.ts):
  10. apps/api/src/server.ts
  11. apps/api/src/index.ts — first line: import './lib/otel'; second line: import 'dotenv/config';

All files exist in Guide 07 — copy exactly, do not improvise.
```

**Day 3 Morning Validation:**
```bash
npm run dev:api
curl http://localhost:3001/health
# Expected: { "status": "ok", "services": { "db": "ok", "redis": "ok" } }

# Now the HTTP test also works (server.ts exists):
# Use the JWT printed during Day 2 smoke-test
curl -X POST http://localhost:3001/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_FROM_DAY2>" \
  -d '{"source":"prometheus","service_id":"payments-service","alert_name":"HighErrorRate","description":"Error rate 8.2%"}'
# Expected: 202 { incidentId, status: "accepted" }
```

### Midday (3 hrs): Frontend

Paste into Cursor Composer:

```
@docs/guides/08-FRONTEND.md

Follow the setup steps at the TOP of Guide 08 FIRST before creating any files:

Step 1 — Install dependencies:
  npm install --workspace @runbook-sentinel/web tailwindcss@3 postcss autoprefixer lucide-react
  npx --prefix apps/web tailwindcss@3 init -p

Step 2 — Verify postcss.config.js was created by init -p:
  cat apps/web/postcss.config.js
  # Must contain: plugins: { tailwindcss: {}, autoprefixer: {} }
  # If missing, create it manually with that content.

Step 3 — Create directories:
  mkdir -p apps/web/lib apps/web/app/incidents/[id] apps/web/app/analytics

Step 4 — Update apps/web/tailwind.config.js with the content config from Guide 08

Step 5 — Create all page files:
  1. apps/web/lib/api.ts
  2. apps/web/app/layout.tsx
  3. apps/web/app/globals.css  ← MUST use @tailwind directives (v3), NOT @import (v4)
  4. apps/web/app/page.tsx (incidents list with 5-second auto-refresh)
  5. apps/web/app/incidents/[id]/page.tsx (detail + approve/reject)
  6. apps/web/app/analytics/page.tsx — see Guide 08 for the analytics page content

Step 6 — Verify apps/web/tsconfig.json has paths: { "@/*": ["./*"] }
  (already patched — just verify it's present)
```

**Day 3 Frontend Validation:**
```bash
npm run dev:web
# Open http://localhost:3000   → incidents list loads
# Open http://localhost:3000/analytics → MTTR chart loads (even with empty data)
# Click 'Trigger Demo Incident' → new row appears within 5 seconds
```

### Afternoon (2 hrs): Seed + End-to-End Test

```
Run: npm run seed --workspace @runbook-sentinel/api
This loads Qdrant with 3 runbooks, 5 incidents, 2 post-mortems.

End-to-end test sequence using the JWT from apps/api/scripts/test-workflow.ts:
1. POST /v1/incidents — get incidentId from response
2. Poll GET /v1/incidents/:id every 3s until status = "awaiting_approval"
3. POST /v1/incidents/:id/approve with { approved: true }
4. Poll GET /v1/incidents/:id until status = "resolved"
5. Check Qdrant: qdrant.scroll("post_mortems") — should have a new entry

If any step returns an error, show me the full error response and stack trace.
```

---

## Recovery Prompts (When the AI Gets Stuck)

### If Mastra imports fail
```
The Mastra API may have changed in the installed version. Run:
  cat node_modules/@mastra/core/package.json | grep version
Then look at the actual exported types in node_modules/@mastra/core/dist/index.d.ts
Adjust imports in incidentWorkflow.ts to match exactly what is exported.
```

### If Qdrant hybrid search (prefetch + RRF) fails
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

### If the workflow suspend/resume API doesn't match
```
Check the installed Mastra version for the correct suspend/resume API.
Try: run.resume({ stepId: 'hitl_gate', context: { approved: true, approverId: 'test' } })
If run.resume doesn't exist, check if it's: workflow.resume(runId, stepId, resumeData)
```

---

## The One Rule That Saves the Most Time

> **Never ask the AI to design — only ask it to implement.**
> Every design decision is already in `docs/guides/`. Your prompts must always start with `@docs/guides/0X-NAME.md` and say **"create exactly as specified."** The moment you ask "what should I do here?" you lose 2 hours. The answer is always in the guide.

---

## File Reference Map (Updated)

| File to Create | Source Guide | Section |
|---|---|---|
| `docker-compose.yml` | 01-SETUP | Step 2 |
| `apps/api/src/lib/db.ts` | 02-DATABASE | File section |
| `apps/api/src/lib/redis.ts` | **07-API** | Added section (was missing) |
| `apps/api/src/lib/otel.ts` | 09-OTEL | File section |
| `apps/api/src/lib/telemetry.ts` | 09-OTEL | Utility file |
| `apps/api/src/mastra/index.ts` | 05-AGENTS | Provider Setup |
| `apps/api/src/mastra/agents/*.ts` | 05-AGENTS | Agent sections |
| `apps/api/src/mastra/tools/enkryptGuardrail.ts` | 04-ENKRYPT | File section |
| `apps/api/src/mastra/tools/qdrantSearch.ts` | 03-QDRANT | File section |
| `apps/api/src/mastra/tools/qdrantUpsert.ts` | 03-QDRANT | File section |
| `apps/api/src/mastra/workflows/incidentWorkflow.ts` | 06-WORKFLOWS | Full file |
| `apps/api/src/server.ts` | 07-API | File section |
| `apps/api/src/routes/alerts.ts` | 07-API | File section |
| `apps/api/src/routes/incidents.ts` | **07-API** | Added section (was missing) |
| `apps/api/src/routes/approve.ts` | 07-API | File section |
| `apps/api/src/routes/analytics.ts` | **07-API** | Added section (was missing) |
| `apps/api/src/routes/knowledge.ts` | **07-API** | Added section (was missing) |
| `apps/api/src/middleware/*.ts` | 07-API | Middleware sections |
| `apps/web/lib/api.ts` | 08-FRONTEND | File section |
| `apps/web/app/layout.tsx` | 08-FRONTEND | File section |
| `apps/web/app/globals.css` | **08-FRONTEND** | Fixed: v3 syntax |
| `apps/web/app/page.tsx` | 08-FRONTEND | File section |
| `apps/web/app/incidents/[id]/page.tsx` | 08-FRONTEND | File section |
| `apps/api/scripts/migrate-db.ts` | 02-DATABASE | File section |
| `apps/api/scripts/seed-qdrant.ts` | 03-QDRANT | File section |
| `apps/api/scripts/test-workflow.ts` | Day 2 prompt above | — |