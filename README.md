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
# 📐 Retrieval & Ranking Mathematics

---

## 1. BM25 (Sparse Retrieval)

\[
\text{BM25}(q,D)=
\sum_{t\in q}
IDF(t)
\times
\frac{
f(t,D)(k_1+1)
}{
f(t,D)+k_1\left(1-b+b\frac{|D|}{avgdl}\right)
}
\]

### Parameters

| Symbol | Description |
|---------|-------------|
| \(f(t,D)\) | Term frequency |
| \(k_1\) | Term frequency scaling (1.2–2.0) |
| \(b\) | Length normalization (0.75) |
| \(|D|\) | Document length |
| \(avgdl\) | Average document length |

---

## 2. Inverse Document Frequency (IDF)

\[
IDF(t)=
\log\left(
\frac{N-n_t+0.5}
{n_t+0.5}+1
\right)
\]

| Symbol | Description |
|---------|-------------|
| \(N\) | Total documents |
| \(n_t\) | Documents containing term |

---

# 🧠 OpenAI Embeddings

Each document is converted into a **1536-dimensional dense vector** using **text-embedding-3-large**.

\[
Document
\rightarrow
EmbeddingModel
\rightarrow
\vec{d}\in\mathbb{R}^{1536}
\]

Similarly,

\[
Query
\rightarrow
EmbeddingModel
\rightarrow
\vec{q}\in\mathbb{R}^{1536}
\]

---

# 📏 Cosine Similarity

Used by Qdrant for Dense Vector Search.

\[
Cosine(\vec q,\vec d)=
\frac{\vec q\cdot\vec d}
{||\vec q||\times||\vec d||}
\]

Higher score ⇒ Higher semantic similarity.

---

# 🗂️ Qdrant Hybrid Search

Qdrant performs parallel retrieval.

\[
Query
\rightarrow
\begin{cases}
Dense\ Search\\
Sparse\ Search
\end{cases}
\]

Result Sets

\[
Dense=
\{d_1,d_2,...,d_k\}
\]

\[
Sparse=
\{s_1,s_2,...,s_k\}
\]

---

# 🔀 Reciprocal Rank Fusion (RRF)

Qdrant merges Dense and Sparse results using RRF.

\[
RRF(d)
=
\sum_i
\frac{1}
{k+r_i(d)}
\]

Where

- \(k=60\)
- \(r_i(d)\) = Rank returned by retriever *i*

---

# ⚖️ Hybrid Score

Weighted fusion of BM25 and Dense Search.

\[
Score
=
\alpha\times BM25
+
(1-\alpha)\times CosineSimilarity
\]

Example

\[
\alpha=0.4
\]

\[
Dense=0.6
\]

---

# 🧩 Context Ranking

Top documents are sorted by

\[
FinalRank=
RRF
\times
TrustScore
\times
TemporalWeight
\]

where

\[
TemporalWeight=
1+\lambda e^{-t}
\]

---

# 🧠 Context Window

Top-K retrieved chunks

\[
Context=
Top_k(Documents)
\]

\[
k=8\sim12
\]

---

# ✂️ Chunking

Document

\[
D
=
\{c_1,c_2,...,c_n\}
\]

Typical Configuration

```
Chunk Size     = 512 Tokens
Chunk Overlap  = 50 Tokens
```

---

# ☁️ Qdrant Vector Index

```
Vector Size : 1536

Distance Metric : Cosine

Index : HNSW

Payload : Metadata + UUID + Trust Score
```

---

# 🌐 HNSW Search

Approximate Nearest Neighbor

Graph Complexity

\[
O(M\times N)
\]

Search Complexity

\[
O(logN)
\]

where

- M = Graph Connectivity
- N = Number of Vectors

---

# 🧮 Confidence Score

\[
Confidence=
\frac{
RelevantChunks
}
{
RetrievedChunks
}
\]

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

\[
W=
\{S_1,S_2,...,S_n\}
\]

State Transition

\[
S_{i+1}=f(S_i,Input)
\]

Checkpoint

\[
Checkpoint=
(State,
Context,
Memory,
TraceID)
\]

Resume

\[
WorkflowResume=
Checkpoint
\rightarrow
NextState
\]

---

# 📝 Memory Update

\[
Memory_{new}
=
Memory_{old}
+
NewKnowledge
\]

---

# 🔍 Retrieval Pipeline

\[
Query
\rightarrow
Embedding
\rightarrow
Qdrant
\rightarrow
HybridSearch
\rightarrow
RRF
\rightarrow
TopK
\rightarrow
LLM
\]

---

# 📦 End-to-End Retrieval Equation

\[
Answer
=
LLM
\left(
TopK
\left(
RRF
\left(
BM25,
CosineSimilarity
\right)
\right)
\right)
\]

---

# 🚀 Technology Stack (Mathematical View)

| Component | Formula / Algorithm |
|-----------|----------------------|
| BM25 | Probabilistic Ranking Function |
| OpenAI Embeddings | \(x \rightarrow \mathbb{R}^{1536}\) |
| Qdrant | Cosine Similarity + HNSW |
| Hybrid Search | Sparse + Dense Retrieval |
| Rank Fusion | Reciprocal Rank Fusion (RRF) |
| Chunking | 512 Tokens + 50 Overlap |
| Retrieval | Top-K Similarity Search |
| Mastra | Workflow State Transition \(S_{i+1}=f(S_i)\) |
| Memory | \(M_{new}=M_{old}+Knowledge\) |
| Final Answer | \(LLM(RRF(BM25+Dense))\) |
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
