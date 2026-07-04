# Runbook Sentinel — Master Implementation Guide

> **Audience:** AI coding agents and human developers implementing this system.  
> **Authority:** This document is the single source of truth. When in doubt, follow this guide over any other file.  
> **Status:** Pre-implementation. No code is written yet.

---

## 0. Before You Touch a File — Read This Entire Document First

This is a **strict implementation guide**. Every section specifies exact file paths, exact package names, exact code patterns. Do not improvise. Do not use alternative libraries unless this guide explicitly marks something as optional.

The system you are building is **Runbook Sentinel** — a production-grade AI-native SRE incident response platform built on three mandatory hackathon technologies:

1. **Mastra** — TypeScript workflow orchestration and agent runtime
2. **Qdrant** — vector database for hybrid semantic + keyword search
3. **Enkrypt AI** — LLM input/output safety guardrails (REST API)

The LLM provider is **Featherless AI** (OpenAI-compatible, `base_url: https://api.featherless.ai/v1`).

---

## 1. Repository Structure (Target State)

When implementation is complete, the repository must look exactly like this:

```
mastra-hktn/
├── apps/
│   ├── api/                          # Express backend + Mastra runtime
│   │   ├── src/
│   │   │   ├── index.ts              # Server entry point
│   │   │   ├── server.ts             # Express app factory
│   │   │   ├── routes/
│   │   │   │   ├── alerts.ts         # POST /v1/incidents
│   │   │   │   ├── incidents.ts      # GET /v1/incidents/:id
│   │   │   │   ├── approve.ts        # POST /v1/incidents/:id/approve
│   │   │   │   ├── analytics.ts      # GET /v1/analytics/mttr
│   │   │   │   └── knowledge.ts      # GET /v1/knowledge/conflicts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT verification
│   │   │   │   ├── rateLimiter.ts    # Redis sliding window
│   │   │   │   ├── correlationId.ts  # x-correlation-id injector
│   │   │   │   └── errorHandler.ts   # Global error handler
│   │   │   ├── lib/
│   │   │   │   ├── db.ts             # Postgres client (pg pool)
│   │   │   │   ├── redis.ts          # Redis client (ioredis)
│   │   │   │   └── otel.ts           # OpenTelemetry SDK init
│   │   │   └── mastra/
│   │   │       ├── index.ts          # Mastra instance export
│   │   │       ├── agents/
│   │   │       │   ├── triageAgent.ts
│   │   │       │   ├── remediationAgent.ts
│   │   │       │   └── postMortemAgent.ts
│   │   │       ├── workflows/
│   │   │       │   ├── incidentWorkflow.ts
│   │   │       │   └── kfsWorkflow.ts
│   │   │       └── tools/
│   │   │           ├── qdrantSearch.ts
│   │   │           ├── qdrantUpsert.ts
│   │   │           ├── enkryptGuardrail.ts
│   │   │           └── mttrCalculator.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                          # Next.js HITL Dashboard
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx              # Incidents list
│       │   ├── incidents/
│       │   │   └── [id]/
│       │   │       └── page.tsx      # Incident detail + approve
│       │   └── analytics/
│       │       └── page.tsx          # MTTR dashboard
│       ├── components/
│       │   ├── IncidentCard.tsx
│       │   ├── RemediationPlan.tsx
│       │   ├── ApproveButton.tsx
│       │   └── MttrChart.tsx
│       └── lib/
│           └── api.ts                # API client wrapper
├── src/
│   ├── lib/
│   │   ├── enkrypt/                  # (Replaced by apps/api/src/mastra/tools/enkryptGuardrail.ts)
│   │   ├── qdrant/                   # (Replaced by apps/api/src/mastra/tools/qdrantSearch.ts)
│   │   └── incidents/                # (Replaced by apps/api/src/routes/)
│   └── mastra/                       # (Replaced by apps/api/src/mastra/)
├── scripts/
│   ├── seed-qdrant.ts                # Seed script for Qdrant collections
│   ├── migrate-db.ts                 # Create Postgres tables
│   └── test-workflow.ts              # End-to-end smoke test
├── docs/
│   ├── IMPLEMENTATION_GUIDE.md       # This file
│   ├── ARCHITECTURE_DIAGRAM.md       # Mermaid diagrams
│   ├── TRACEABILITY.md               # IEEE 830 FR matrix
│   └── guides/
│       ├── 01-SETUP.md
│       ├── 02-DATABASE.md
│       ├── 03-QDRANT.md
│       ├── 04-ENKRYPT.md
│       ├── 05-AGENTS.md
│       ├── 06-WORKFLOWS.md
│       ├── 07-API.md
│       ├── 08-FRONTEND.md
│       └── 09-OTEL.md
├── docker-compose.yml                # Local dev: Postgres + Redis + Qdrant
├── .env.example                      # All required environment variables
└── README.md
```

---

## 2. Technology Stack (Locked — Do Not Substitute)

| Layer | Technology | Package | Notes |
|---|---|---|---|
| Orchestration | Mastra | `@mastra/core` | TypeScript only |
| LLM | Featherless AI | `@ai-sdk/openai-compatible` | OpenAI-compatible |
| Vector DB | Qdrant | `@qdrant/js-client-rest` | Cloud-hosted |
| Safety | Enkrypt AI | Native `fetch()` | REST API, no SDK |
| Database | PostgreSQL | `pg` | Connection pool |
| Cache/Queue | Redis | `ioredis` | Rate limiting + job queue |
| API | Express | `express` | With `helmet`, `cors` |
| Auth | JWT | `jsonwebtoken` | Short-lived tokens |
| Schemas | Zod | `zod` | All agent outputs |
| Observability | OpenTelemetry | `@opentelemetry/sdk-node` | GenAI semconv |
| Frontend | Next.js 15 | Already scaffolded | App Router |
| Embedding | Featherless AI | Via Mastra embed tool | `nomic-embed-text-v1.5` |

---

## 3. Environment Variables — Complete Reference

Create `.env.example` at the root. The actual `.env` goes into `apps/api/.env` (never committed).

```bash
# ─── LLM (Featherless AI) ───────────────────────────────────────────────────
FEATHERLESS_API_KEY=your_featherless_api_key_here
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
# Primary model for agents (structured output, function calling)
FEATHERLESS_MODEL=Qwen/Qwen2.5-72B-Instruct
# Embedding model for Qdrant upserts
FEATHERLESS_EMBED_MODEL=nomic-ai/nomic-embed-text-v1.5

# ─── Qdrant ─────────────────────────────────────────────────────────────────
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key_here

# ─── Enkrypt AI ──────────────────────────────────────────────────────────────
ENKRYPT_API_KEY=your_enkrypt_api_key_here
ENKRYPT_BASE_URL=https://api.enkryptai.com

# ─── PostgreSQL ──────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/runbook_sentinel
# For Supabase: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# ─── Redis ───────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
# For Redis Cloud / Upstash: redis://default:[password]@[host]:[port]

# ─── Auth ────────────────────────────────────────────────────────────────────
JWT_SECRET=minimum-32-character-random-secret-string-here
JWT_EXPIRES_IN=15m

# ─── App ─────────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# ─── OpenTelemetry ───────────────────────────────────────────────────────────
OTEL_SERVICE_NAME=runbook-sentinel-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=your_honeycomb_api_key
# Set to "true" to export to Honeycomb; "false" for local console output only
OTEL_EXPORT_ENABLED=false

# ─── Frontend (Next.js) ──────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 4. Implementation Order (Critical Path)

Follow this exact order. Each phase depends on the previous one being working.

```
Phase 0: Infrastructure (30 min)
  └── docker-compose.yml (Postgres + Redis + Qdrant local)
  └── Database migrations (3 tables)
  └── Qdrant collection creation (4 collections)

Phase 1: Core Integration Layer (Day 1)
  └── Featherless AI provider setup in Mastra
  └── Enkrypt AI HTTP wrapper (enkryptGuardrail.ts tool)
  └── Qdrant search tool (qdrantSearch.ts)
  └── Qdrant upsert tool (qdrantUpsert.ts)

Phase 2: Agents (Day 1-2)
  └── TriageAgent (with TriageSchema Zod output)
  └── RemediationAgent (with evidence_refs validation)
  └── PostMortemAgent (with MTTR delta calculation)

Phase 3: Workflow (Day 2)
  └── incidentWorkflow (10 steps, all branches)
  └── Suspend/resume HITL mechanism

Phase 4: API (Day 2-3)
  └── Express server with Helmet + CORS
  └── JWT middleware
  └── Redis rate limiter
  └── 5 route handlers

Phase 5: Frontend (Day 3-4)
  └── Incidents list page
  └── Incident detail + Approve/Reject
  └── MTTR analytics page

Phase 6: Seed Data + Testing (Day 4-5)
  └── Seed script (runbooks + incidents + post-mortems)
  └── End-to-end smoke test script
  └── Demo walkthrough rehearsal

Phase 7: Deployment (Day 5)
  └── Railway deploy (API)
  └── Vercel deploy (Web)
  └── Qdrant Cloud setup
```

---

## 5. Acceptance Criteria — Definition of Done

The system is complete when all of these pass:

### Core Loop
- [ ] POST `/v1/incidents` with a synthetic payload returns `202` with an `incidentId`
- [ ] TriageAgent runs and outputs a valid `TriageSchema` JSON within 10 seconds
- [ ] If `confidence_score < 0.85`, workflow suspends and returns status `awaiting_manual_review`
- [ ] Qdrant returns at least 3 relevant chunks for a known incident keyword
- [ ] RemediationAgent output contains `evidence_refs` with valid Qdrant UUIDs (not hallucinated)
- [ ] Enkrypt AI blocks a test prompt injection string before it reaches the LLM
- [ ] POST `/v1/incidents/:id/approve` resumes a suspended workflow
- [ ] PostMortemAgent generates a report with `contributing_factors.system` populated

### Safety
- [ ] A prompt containing `user@example.com` gets redacted to `[REDACTED_EMAIL]` before reaching LLM
- [ ] A prompt containing `Ignore previous instructions` gets BLOCKED and returns 422
- [ ] A RemediationAgent output with a fake UUID in `evidence_refs` gets rejected by the guardrail

### Observability
- [ ] Every agent call emits an OTel span with `gen_ai.request.model` and `incident.correlation_id`
- [ ] OTel spans are visible in console (Phase 1) or Honeycomb (Phase 2)

### Frontend
- [ ] HITL Dashboard loads and shows pending incidents
- [ ] Approve button resumes the suspended Mastra workflow
- [ ] MTTR page shows a chart (even with seed data)

---

## 6. Sub-System Guides

Read these in order before implementing each phase:

| Phase | Guide | Location |
|---|---|---|
| 0 | Infrastructure & Setup | `docs/guides/01-SETUP.md` |
| 0 | Database Schema | `docs/guides/02-DATABASE.md` |
| 1 | Qdrant Collections & Search | `docs/guides/03-QDRANT.md` |
| 1 | Enkrypt AI Guardrail | `docs/guides/04-ENKRYPT.md` |
| 2-3 | Mastra Agents & Workflows | `docs/guides/05-AGENTS.md` |
| 4 | Express API | `docs/guides/06-API.md` |
| 5 | Next.js Frontend | `docs/guides/07-FRONTEND.md` |
| 6 | Seed Data Scripts | `docs/guides/08-SEED.md` |
| All | OTel Instrumentation | `docs/guides/09-OTEL.md` |
