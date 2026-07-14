# Runbook Sentinel

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

# 📐 Retrieval & Ranking Mathematics

---

## 1. BM25 (Sparse Retrieval)

```
BM25(q, D) = Σ over t in q of:
    IDF(t) * [ f(t,D) * (k1 + 1) ] / [ f(t,D) + k1 * (1 - b + b * |D| / avgdl) ]
```

### Parameters

| Symbol | Description |
|---------|-------------|
| `f(t,D)` | Term frequency |
| `k1` | Term frequency scaling (1.2–2.0) |
| `b` | Length normalization (0.75) |
| `\|D\|` | Document length |
| `avgdl` | Average document length |

---

## 2. Inverse Document Frequency (IDF)

```
IDF(t) = log( (N - n_t + 0.5) / (n_t + 0.5) + 1 )
```

| Symbol | Description |
|---------|-------------|
| `N` | Total documents |
| `n_t` | Documents containing term |

---

# 🧠 Dense Embeddings

Each document is converted into a **768-dimensional dense vector** using a sentence-embedding model (`BAAI/bge-base-en-v1.5`).

```
Document -> EmbeddingModel -> d (vector in R^768)
Query    -> EmbeddingModel -> q (vector in R^768)
```

---

# 📏 Cosine Similarity

Used by Qdrant for Dense Vector Search.

```
Cosine(q, d) = (q · d) / (||q|| * ||d||)
```

Higher score ⇒ Higher semantic similarity.

---

# 🗂️ Qdrant Hybrid Search

Qdrant performs parallel retrieval.

```
Query -> Dense Search
      -> Sparse Search
```

Result Sets

```
Dense  = { d1, d2, ..., dk }
Sparse = { s1, s2, ..., sk }
```

---

# 🔀 Reciprocal Rank Fusion (RRF)

Qdrant merges Dense and Sparse results using RRF.

```
RRF(d) = Σ over retrievers i of: 1 / (k + r_i(d))
```

Where

- `k = 60`
- `r_i(d)` = Rank returned by retriever *i*

---

# ⚖️ Hybrid Score

Weighted fusion of BM25 and Dense Search.

```
Score = alpha * BM25 + (1 - alpha) * CosineSimilarity
```

Example: `alpha = 0.4`, `1 - alpha = 0.6`

---

# 🧩 Context Ranking

Top documents are sorted by

```
FinalRank = RRF * TrustScore * TemporalWeight
```

where

```
TemporalWeight = 1 + lambda * e^(-t)
```

---

# 🧠 Context Window

Top-K retrieved chunks

```
Context = Top_k(Documents)
k = 8 to 12
```

---

# ✂️ Chunking

Document

```
D = { c1, c2, ..., cn }
```

Typical Configuration

```
Chunk Size     = 512 Tokens
Chunk Overlap  = 50 Tokens
```

---

# ☁️ Qdrant Vector Index

```
Vector Size : 768

Distance Metric : Cosine

Index : HNSW

Payload : Metadata + UUID + Trust Score
```

---

# 🌐 HNSW Search

Approximate Nearest Neighbor

```
Graph Complexity  : O(M * N)
Search Complexity : O(log N)
```

where

- M = Graph Connectivity
- N = Number of Vectors

---

# 🧮 Confidence Score

```
Confidence = RelevantChunks / RetrievedChunks
```

Example

```
Retrieved = 20

Relevant = 18

Confidence = 0.90
```

---

# 🎯 Similarity Threshold

```
Cosine ≥ 0.85
      ↓
Highly Relevant

0.70–0.85
      ↓
Relevant

<0.70
      ↓
Discard
```

---

# 🔄 Mastra Workflow State

Workflow

```
W = { S1, S2, ..., Sn }
```

State Transition

```
S(i+1) = f(S_i, Input)
```

Checkpoint

```
Checkpoint = (State, Context, Memory, TraceID)
```

Resume

```
WorkflowResume = Checkpoint -> NextState
```

---

# 📝 Memory Update

```
Memory_new = Memory_old + NewKnowledge
```

---

# 🔍 Retrieval Pipeline

```
Query -> Embedding -> Qdrant -> HybridSearch -> RRF -> TopK -> LLM
```

---

# 📦 End-to-End Retrieval Equation

```
Answer = LLM( TopK( RRF( BM25, CosineSimilarity ) ) )
```

---

# 🚀 Technology Stack (Mathematical View)

| Component | Formula / Algorithm |
|-----------|----------------------|
| BM25 | Probabilistic Ranking Function |
| Dense Embeddings | `x -> vector in R^768` |
| Qdrant | Cosine Similarity + HNSW |
| Hybrid Search | Sparse + Dense Retrieval |
| Rank Fusion | Reciprocal Rank Fusion (RRF) |
| Chunking | 512 Tokens + 50 Overlap |
| Retrieval | Top-K Similarity Search |
| Mastra | Workflow State Transition `S(i+1) = f(S_i)` |
| Memory | `M_new = M_old + Knowledge` |
| Final Answer | `LLM(RRF(BM25 + Dense))` |

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


## Future Work
 
### Kolmogorov-Arnold Attention Networks (KAAN)
 
A proposed next-generation upgrade to the RemediationAgent and TriageAgent's attention layers, replacing standard linear Transformer projections with learnable spline functions for better handling of non-linear SRE telemetry.
 
- **Mathematical shift** — Standard Transformers project queries/keys/values with fixed linear weight matrices (`W_Q`, `W_K`, `W_V`). KAAN replaces these with learnable 1D B-spline functions (`phi_ij`, `psi_ij`, `gamma_ij`) placed on each edge of the projection, following the Kolmogorov-Arnold representation theorem:
```
  Q_i = Σ over j=1..d of: phi_ij(x_j)
  K_i = Σ over j=1..d of: psi_ij(x_j)
  V_i = Σ over j=1..d of: gamma_ij(x_j)
```
 
  Attention scores and outputs are then computed from these spline-projected Q/K/V the same way as standard scaled dot-product attention.
 
- **Non-linear alert triage** — SRE telemetry (CPU spikes, disk I/O bottleneck limits, memory page faults, network socket queue depth) often scales non-linearly near threshold boundaries. KAAN's learnable splines can model these non-linear relationships with higher sample efficiency than fixed linear projections, which matters for a system with limited historical incident data.
- **Explainable attention mapping** — Because each projection path is a visualizable 1D spline rather than an opaque weight matrix, SREs can inspect exactly which telemetry value ranges activate a given query/key — turning attention weights into human-readable "this metric threshold triggered this response" graphs.
- **Implementation blueprint** — Planned as a `KolmogorovArnoldAttention` PyTorch module (built on the `pykan` package) that drops in as a replacement for the Q/K/V projection layers in the TriageAgent's scoring head, without changing the surrounding Mastra workflow or agent interfaces.
> Status: research proposal — not yet implemented. Tracked as a candidate enhancement for a future round, pending a benchmark against the current linear-projection TriageAgent on the confidence-gate accuracy metric.
 
