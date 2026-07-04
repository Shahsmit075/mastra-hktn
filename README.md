# Runbook Sentinel

> **HiDevs x Mastra Hackathon — Track 5: Incident Response & Post-Mortem Agent**  
> **Round 2 Submission**

Runbook Sentinel is a production-grade AI-native SRE incident response and post-mortem platform. It orchestrates the full incident lifecycle — from alert ingestion through to knowledge writeback — using a safety-critical, human-in-the-loop architecture.

---

## Technology Stack

| Technology | Role |
|---|---|
| **Mastra** | Durable agent orchestration, multi-step workflows, tools |
| **Qdrant** | Hybrid semantic + keyword vector search, long-term RAG memory |
| **Enkrypt AI** | Input sanitization, output hallucination detection, safety guardrails |
| **Featherless AI** | OpenAI-compatible LLM inference (Qwen2.5-72B-Instruct) |
| **PostgreSQL** | Workflow state, incidents, audit logs |
| **Redis** | Rate limiting, session cache |
| **Next.js 15** | HITL Dashboard frontend |
| **Express + TypeScript** | Backend API |

---

## Architecture

```
Alert → API Gateway (JWT + Helmet + Redis Rate Limit)
      → Enkrypt AI Input Guardrail (PII redact, injection block)
      → Mastra Orchestrator (10-step durable workflow)
          ├── TriageAgent       → SEV classification + confidence gate
          ├── Qdrant Search     → Hybrid Dense+BM25+RRF retrieval
          ├── RemediationAgent  → Evidence-backed plan (Zod validated)
          ├── Enkrypt Output    → Hallucination + citation check
          ├── HITL Gate         → IC approval (workflow.suspend/resume)
          └── PostMortemAgent   → Blameless report + Qdrant writeback
      → Knowledge Freshness Service (conflict detection + synthesis)
```

---

## Project Structure

```
mastra-hktn/
├── apps/
│   ├── api/          # Express backend + Mastra runtime
│   └── web/          # Next.js HITL Dashboard
├── scripts/          # DB migration + Qdrant seed scripts
├── docs/
│   ├── IMPLEMENTATION_GUIDE.md   # Master implementation guide
│   ├── ARCHITECTURE_DIAGRAM.md   # 7 Mermaid diagrams
│   ├── TRACEABILITY.md           # IEEE 830 FR matrix
│   └── guides/
│       ├── 01-SETUP.md           # Dependencies + Docker setup
│       ├── 02-DATABASE.md        # Postgres schema
│       ├── 03-QDRANT.md          # Collections + hybrid search
│       ├── 04-ENKRYPT.md         # Safety guardrail wrapper
│       ├── 05-AGENTS.md          # Agent prompts + schemas
│       ├── 06-WORKFLOWS.md       # Mastra workflow (all steps)
│       ├── 07-API.md             # Express routes + middleware
│       ├── 08-FRONTEND.md        # Next.js dashboard pages
│       └── 09-OTEL.md            # OTel instrumentation
├── .env.example                  # All required environment variables
└── docker-compose.yml            # Local dev: Postgres + Redis + Qdrant
```

---

## Quick Start

```bash
# 1. Start local infrastructure
docker compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example apps/api/.env
# Fill in FEATHERLESS_API_KEY, QDRANT_URL, QDRANT_API_KEY, ENKRYPT_API_KEY, JWT_SECRET

# 4. Run database migration
npm run migrate --workspace @runbook-sentinel/api

# 5. Seed Qdrant with synthetic incident data
npm run seed --workspace @runbook-sentinel/api

# 6. Start the API
npm run dev:api

# 7. Start the frontend (new terminal)
npm run dev:web

# 8. Trigger a demo incident
curl -X POST http://localhost:3001/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "source": "prometheus",
    "service_id": "payments-service",
    "alert_name": "HighErrorRate",
    "description": "Payments service error rate 8.2%. P99 latency: 4.2s.",
    "metrics": { "error_rate": 0.082, "p99_latency_ms": 4200 }
  }'
```

---

## Key Features

1. **Durable Agentic Workflows** — Mastra 10-step state machine persisted in PostgreSQL. Crash-safe via idempotency keys (`incidentId:stepName`).
2. **Hybrid RAG Retrieval** — Qdrant Dense (768-dim) + BM25 sparse + RRF fusion (k=60) + temporal decay + trust score filter across 4 collections.
3. **Enkrypt AI Safety Perimeter** — Input: PII redaction, injection blocking. Output: hallucination detection, citation UUID validation.
4. **Confidence Gate** — TriageAgent scores below 0.85 route to dual human review instead of autonomous execution.
5. **HITL with OTel Continuity** — `workflow.suspend()` serializes W3C `traceparent` to PostgreSQL. Resumed spans link back to the original trace.
6. **Knowledge Freshness Service** — Proactive conflict detection between new post-mortems and existing runbooks using a weighted Conflict Score formula.
7. **Blameless Post-Mortems** — Google SRE standard reports with MTTR regression alerts and automated Qdrant writeback.

---

## API Endpoints

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| `GET` | `/health` | None | Service health check |
| `POST` | `/v1/incidents` | Any | Ingest alert/telemetry |
| `GET` | `/v1/incidents/:id` | Any | Get workflow status |
| `POST` | `/v1/incidents/:id/approve` | `incident_commander` | Resume HITL gate |
| `GET` | `/v1/analytics/mttr` | Any | MTTR trends |
| `GET` | `/v1/knowledge/conflicts` | `sre_lead` | Stale content queue |

---

## Documentation

- [Implementation Guide](docs/IMPLEMENTATION_GUIDE.md) — Start here
- [Architecture Diagrams](docs/ARCHITECTURE_DIAGRAM.md) — 7 Mermaid diagrams
- [Traceability Matrix](docs/TRACEABILITY.md) — IEEE 830 FR mapping
- [Agent Specifications](docs/guides/05-AGENTS.md) — CRISPE prompts + Zod schemas
- [Workflow Specification](docs/guides/06-WORKFLOWS.md) — All 10 workflow steps

---

## Demo Flow (3 minutes)

1. Open HITL Dashboard — `http://localhost:3000`
2. Click **"Trigger Demo Incident"** — fires a Payments-DB OOMKill alert
3. Watch TriageAgent classify **SEV1** with CoT reasoning in real-time
4. See Qdrant return matching runbooks with hybrid search scores
5. RemediationAgent generates a plan with `evidence_refs` citations
6. HITL gate suspends — click **Approve** as Incident Commander
7. PostMortemAgent generates blameless report + writes to Qdrant
8. Knowledge Freshness Service flags stale 2022 runbook contradiction
