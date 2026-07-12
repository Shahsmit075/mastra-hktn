# Runbook Sentinel

> **HiDevs x Mastra Hackathon — Track 5: Incident Response & Post-Mortem Agent**  
> **Round 2 Submission**

Runbook Sentinel is a production-grade AI-native SRE incident response and post-mortem platform. It orchestrates the full incident lifecycle — from alert ingestion through to knowledge writeback — using a safety-critical, human-in-the-loop architecture.

---

## 🏗️ Technology Stack

| Technology | Role |
|---|---|
| **Mastra** | Durable agent orchestration, multi-step workflows, tools |
| **Qdrant** | Hybrid semantic + keyword vector search, long-term RAG memory |
| **Enkrypt AI** | Input sanitization, output hallucination detection, safety guardrails |
| **OpenAI / Featherless AI** | LLM inference (gpt-4o-mini / Qwen2.5-72B-Instruct, configurable via `.env`) |
| **PostgreSQL** | Workflow state, incidents, audit logs |
| **Redis** | Rate limiting, session cache |
| **Next.js 15 + Framer Motion** | High-performance React Frontend + Showcase UI |
| **Express + TypeScript** | Backend API |

---

## 🌟 Key Hackathon Features Built

During this hackathon, we built out the following core features that take this from a standard LLM wrapper to a true AI teammate:

1. **The Knowledge Gardener (Synthesis Agent)**: A proactive background agent that detects semantic drift between legacy runbooks and new post-mortems. It reads both documents and synthesizes a unified, corrected draft for human review, ensuring your runbooks never go stale.
2. **Enkrypt AI Guardrails Perimeter**: A pre-execution safety layer integrated directly into the Mastra workflow. It intercepts incoming alert payloads (which attackers can manipulate via Prometheus) and blocks prompt injections while redacting PII *before* the payload reaches the LLM.
3. **Semantic Caching**: During an alert storm, thousands of identical alerts fire. We implemented a Qdrant-backed semantic caching layer that embeds the alert and returns a cached response if a >0.98 similarity match is found, dropping execution time from ~14s to ~40ms and saving massive LLM token costs.
4. **Interactive Showcase UI**: A beautifully designed, live-connected React interface using Framer Motion that demonstrates these three exact features interacting with the real backend.

---

## 🏛️ Architecture

```text
Alert → API Gateway (JWT + Helmet + Redis Rate Limit)
      → Enkrypt AI Input Guardrail (PII redact, injection block)
      → Mastra Orchestrator (10-step durable workflow)
          ├── Semantic Cache    → Short-circuit duplicate alerts via Qdrant
          ├── TriageAgent       → SEV classification + confidence gate
          ├── Qdrant Search     → Hybrid Dense+BM25+RRF retrieval
          ├── RemediationAgent  → Evidence-backed plan (Zod validated)
          ├── Enkrypt Output    → Hallucination + citation check
          ├── HITL Gate         → IC approval (workflow.suspend/resume)
          └── PostMortemAgent   → Blameless report + Qdrant writeback
      → Knowledge Gardener      → Proactive conflict detection + synthesis
```

---

## 🚀 Quick Start (Running the Live Showcase Demo)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (Add OPENAI_API_KEY, ENKRYPT_API_KEY, QDRANT_URL, etc.)
cp .env.example apps/api/.env

# 3. Start the API (Terminal 1)
cd apps/api
npm run dev

# 4. Start the Frontend (Terminal 2)
cd apps/web
npm run dev

# 5. Open the UI Showcase
# Navigate to http://localhost:3000/showcase in your browser
```

### 💻 CLI Fallback Demos
If you prefer the terminal, you can run the exact same logic directly from the `apps/api` folder:
- `npm run demo:gardener` — Watch the Knowledge Gardener detect drift and synthesize a new runbook.
- `npm run demo:red-team` — See Enkrypt AI intercept and block a malicious Prometheus alert payload.
- `npm run demo:caching` — Watch the Semantic Cache short-circuit an alert storm.

---

# 📐 Retrieval & Ranking Mathematics (The Science)

We don't just rely on basic RAG. Our Qdrant integration uses state-of-the-art hybrid search.

## 1. BM25 (Sparse Retrieval)
```text
BM25(q, D) = Σ over t in q of:
    IDF(t) * [ f(t,D) * (k1 + 1) ] / [ f(t,D) + k1 * (1 - b + b * |D| / avgdl) ]
```

## 2. Dense Embeddings & Cosine Similarity
Each document is converted into a **768-dimensional dense vector** using a sentence-embedding model (`BAAI/bge-base-en-v1.5`). Qdrant matches these using:
```text
Cosine(q, d) = (q · d) / (||q|| * ||d||)
```

## 3. Reciprocal Rank Fusion (RRF)
Qdrant performs parallel retrieval (Dense + Sparse) and merges the results using RRF to get the absolute best context for the LLM.
```text
RRF(d) = Σ over retrievers i of: 1 / (k + r_i(d))
```

## 4. Confidence Score & Thresholds
Our Mastra agents calculate a confidence score before acting:
```text
Confidence = RelevantChunks / RetrievedChunks
```
If `Cosine ≥ 0.85`, it's highly relevant. If `Cosine < 0.70`, it is discarded. If the final confidence is low, the Mastra workflow suspends and requests Human-In-The-Loop (HITL) approval.

---

## 📦 End-to-End Execution Equation

```text
Final_Remediation = LLM( Guardrail( TopK( RRF( BM25, CosineSimilarity ) ) ) )
```

---

## 📁 Project Structure

```text
mastra-hktn/
├── apps/
│   ├── api/          
│   │   ├── src/routes/demo.ts       # Hackathon demo API endpoints
│   │   ├── src/mastra/agents/       # Synthesis, Triage, Remediation agents
│   │   ├── src/mastra/tools/        # Enkrypt & Caching tools
│   │   └── scripts/                 # CLI demo scripts
│   └── web/          
│       ├── app/showcase/page.tsx    # Live React Showcase UI
│       └── app/layout.tsx           # Global Next.js layout
├── docs/
│   ├── IMPLEMENTATION_GUIDE.md      # Master implementation guide
│   └── ARCHITECTURE_DIAGRAM.md      # Mermaid diagrams
└── .env.example                     # Environment variables
```

---

## API Endpoints

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| `GET` | `/health` | None | Service health check |
| `POST` | `/v1/demo/*` | None | Open endpoints for UI Showcase |
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
