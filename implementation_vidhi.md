Day-by-Day Execution Plan
Day 1 — Infrastructure + Integration Layer (8 hrs)
Morning (4 hrs): Setup + DB + Docker

Open Cursor Composer and paste this prompt:

@docs/guides/01-SETUP.md @docs/guides/02-DATABASE.md
Based on these two guides, do the following:
1. Create docker-compose.yml at repo root with Postgres, Redis, Qdrant
2. Update apps/api/package.json with all dependencies from Guide 01
3. Replace apps/api/tsconfig.json with the config from Guide 01
4. Create apps/api/src/lib/db.ts exactly as specified in Guide 02
5. Create apps/api/src/lib/redis.ts (basic ioredis singleton, same pattern as db.ts)
6. Create scripts/migrate-db.ts exactly as in Guide 02
Run: npm install in apps/api. Then confirm all files exist.
Afternoon (4 hrs): Enkrypt + Qdrant tools

@docs/guides/03-QDRANT.md @docs/guides/04-ENKRYPT.md
Create these files exactly as specified:
1. apps/api/src/mastra/tools/enkryptGuardrail.ts — full file from Guide 04
2. apps/api/src/mastra/tools/qdrantSearch.ts — full file from Guide 03
3. apps/api/src/mastra/tools/qdrantUpsert.ts — full file from Guide 03
4. scripts/seed-qdrant.ts — full seed script from Guide 03
Do not summarize or shorten the code. Copy exactly.
Day 1 Validation:

bash
docker compose up -d
npm run migrate --workspace @runbook-sentinel/api
# Should see: ✅ Database migration complete
Day 2 — Agents + Workflow (8 hrs)
Morning (3 hrs): Agents

@docs/guides/05-AGENTS.md
Create these three files exactly as written in the guide. 
Do not shorten the system prompts — the full CRISPE prompt text is mandatory.
1. apps/api/src/mastra/agents/triageAgent.ts
2. apps/api/src/mastra/agents/remediationAgent.ts  
3. apps/api/src/mastra/agents/postMortemAgent.ts
4. apps/api/src/mastra/index.ts (Featherless provider + Mastra instance)
Midday (3 hrs): Workflow

@docs/guides/06-WORKFLOWS.md
This is the most critical file. Create:
apps/api/src/mastra/workflows/incidentWorkflow.ts
Important rules:
- Do not skip any step (sanitize, triage, confidence_gate, retrieval, remediation, 
  hitl_gate, post_mortem, writeback)
- Keep the getOrExecuteStep() idempotency helper exactly as written
- Keep all branch logic intact
If the file is too large to generate in one pass, generate it in two halves 
and I will combine them.
Afternoon (2 hrs): OTel + Smoke test

@docs/guides/09-OTEL.md
Create:
1. apps/api/src/lib/otel.ts — full SDK init file
2. apps/api/src/lib/telemetry.ts — withSpan helper + GenAI attributes
3. apps/api/src/index.ts — server entry point (otel import must be first line)
Then create scripts/test-workflow.ts that fires a POST /v1/incidents 
with the synthetic payments-service payload from the README and logs the response.
Day 2 Validation:

bash
npm run dev:api
# In new terminal:
npx tsx scripts/test-workflow.ts
# Should see workflow start and TriageAgent log output
Day 3 — API + Frontend + Demo Polish (8 hrs)
Morning (3 hrs): API routes

@docs/guides/07-API.md
Create all files from this guide:
1. apps/api/src/server.ts
2. apps/api/src/routes/alerts.ts
3. apps/api/src/routes/incidents.ts (GET /v1/incidents and GET /v1/incidents/:id)
4. apps/api/src/routes/approve.ts
5. apps/api/src/routes/analytics.ts (simple MTTR query from incidents table)
6. apps/api/src/middleware/auth.ts
7. apps/api/src/middleware/rateLimiter.ts
8. apps/api/src/middleware/correlationId.ts
9. apps/api/src/middleware/errorHandler.ts
Generate a test JWT using jwt.sign() with role: "incident_commander" and 
log it to console so I can use it for testing.
Midday (3 hrs): Frontend

@docs/guides/08-FRONTEND.md
Create all files from this guide:
1. apps/web/lib/api.ts
2. apps/web/app/layout.tsx
3. apps/web/app/globals.css
4. apps/web/app/page.tsx (incidents list with auto-refresh)
5. apps/web/app/incidents/[id]/page.tsx (detail + approve/reject)
Also install missing web dependencies:
npm install --workspace @runbook-sentinel/web lucide-react
Then run: npm run dev:web and confirm it loads without errors.
Afternoon (2 hrs): Seed + End-to-End Test

Run npm run seed --workspace @runbook-sentinel/api to load Qdrant.
Then do a full end-to-end test:
1. POST /v1/incidents with the demo payload
2. Poll GET /v1/incidents/:id until status = awaiting_approval
3. POST /v1/incidents/:id/approve with approved: true
4. Confirm status moves to post_mortem then resolved
5. Check Qdrant post_mortems collection has a new entry
Log each step's result. If any step fails, show me the error.
When the AI Gets Stuck — 3 Recovery Prompts
If Mastra imports break:

The Mastra API may have changed. Check the installed version of @mastra/core
and look at its actual exported types. Adjust the imports in 
incidentWorkflow.ts to match what is actually available.
If Qdrant hybrid search syntax fails:

The @qdrant/js-client-rest version installed may not support the query() method 
with prefetch. Use qdrant.search() with a single vector instead and note this 
as a simplification. The core functionality still works.
If Featherless model rejects structured output:

Some models on Featherless don't support strict JSON mode. 
Change the agent.generate() call to not use output: Schema directly.
Instead, add "Respond with valid JSON only matching this schema: " + JSON.stringify(zodToJsonSchema(Schema)) 
to the prompt, then parse the response manually with Schema.parse(JSON.parse(response.text)).
The One Rule That Saves the Most Time
Never ask the AI to design — only ask it to implement. Every design decision is already in the guides. Your prompts should always start with @docs/guides/0X-NAME.md and say "create exactly as specified." The moment you ask "what should I do here?" you lose 2 hours. The answer is always in the guide.