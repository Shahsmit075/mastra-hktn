# Runbook Sentinel — Comprehensive Architecture Document
  
**Track:** Track 5 — Incident Response & Post-Mortem Agent  
**Status:** Final Submission  

This document provides the complete system architecture for Runbook Sentinel across seven dedicated diagrams, each covering a distinct layer of the platform. Together they describe the full lifecycle of a production incident — from alert ingestion to institutional knowledge writeback — and the proactive Knowledge Freshness Service that keeps the system's memory accurate over time.

---

## Diagram 1: Full System Architecture Overview

The highest-level view of the platform showing all layers, components, and their relationships.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#1F2937', 'edgeLabelBackground':'#111827', 'tertiaryColor': '#111827'}}}%%
flowchart TB

    subgraph Ingress [Ingress & Security Layer]
        TS[Telemetry Sources<br>Prometheus / PagerDuty / Webhooks]
        UI[HITL Dashboard<br>React / Tailwind / Vercel]
        GW[API Gateway<br>Node.js / Express]
        AS[Auth Service<br>OAuth2 / JWT]
        RL[Rate Limiter<br>Redis Sliding Window]
    end

    subgraph Safety [Enkrypt AI Safety Perimeter]
        EIN{Enkrypt AI<br>Input Guardrail}
        EOUT{Enkrypt AI<br>Output Guardrail}
    end

    subgraph Orchestration [Mastra Orchestration Layer]
        MO[Mastra Orchestrator<br>Durable Workflow State Machine]
        PG[(PostgreSQL<br>workflow_state / incidents / audit_logs)]
    end

    subgraph Agents [Agent Cluster]
        TA[TriageAgent<br>SEV Classification + Burn Rate]
        RW[Retrieval Workflow<br>Hybrid Search Coordinator]
        RA[RemediationAgent<br>CoT Plan Generator]
        PM[PostMortemAgent<br>Blameless Report Generator]
    end

    subgraph Memory [Qdrant Vector Memory]
        QD[(Qdrant Cloud<br>4 Collections)]
    end

    subgraph KFS [Knowledge Freshness Service]
        KW[KFS Worker<br>Mastra Background Agent]
        SA[SynthesisAgent<br>Conflict Reconciler]
        SCQ[Stale Content Queue<br>HITL Dashboard Feed]
    end

    subgraph Observability [OpenTelemetry Stack]
        OC[OTel Collector<br>Phase 2]
        OB[Honeycomb / Datadog<br>Phase 2]
    end

    TS --> GW
    UI --> GW
    GW --> AS
    GW --> RL
    GW --> EIN

    EIN -->|Safe| MO
    EIN -->|Block| GW

    MO --> TA
    MO --> RW
    MO --> RA
    MO --> PM
    MO <--> PG

    RW <-->|Hybrid Search Query| QD
    RA --> EOUT
    EOUT -->|Pass| UI
    EOUT -->|Block| RA

    PM --> QD
    PM --> PG

    QD --> KW
    PG --> KW
    UI --> KW
    KW --> SA
    SA --> EOUT
    KW --> SCQ
    SCQ --> UI
    SA --> QD

    MO --> OC
    TA --> OC
    RA --> OC
    PM --> OC
    OC -.->|Phase 2| OB

    style EIN fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style EOUT fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style MO fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style QD fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style KW fill:#581C87,stroke:#A855F7,stroke-width:2px,color:#FFF
    style SA fill:#581C87,stroke:#A855F7,stroke-width:2px,color:#FFF
    style PG fill:#1C1917,stroke:#78716C,stroke-width:2px,color:#FFF
```

### Layer Descriptions

| Layer | Components | Responsibility |
|:---|:---|:---|
| **Ingress & Security** | API Gateway, Auth Service, Redis Rate Limiter | Authenticates requests, enforces rate limits, injects `x-correlation-id` |
| **Safety Perimeter** | Enkrypt AI Input + Output | Blocks prompt injection, redacts PII/secrets, validates citations against context |
| **Orchestration** | Mastra Orchestrator, PostgreSQL | Manages durable 10-step workflow state, persists `traceparent` for OTel |
| **Agent Cluster** | Triage, Retrieval, Remediation, PostMortem | Specialized AI agents each with a strict Zod output schema |
| **Vector Memory** | Qdrant Cloud (4 collections) | Hybrid semantic + keyword retrieval across runbooks, incidents, post-mortems |
| **Knowledge Freshness** | KFS Worker, SynthesisAgent, Stale Queue | Proactively detects and resolves conflicts between new and existing knowledge |
| **Observability** | OTel Collector, Honeycomb/Datadog | Captures every LLM span with GenAI semantic conventions |

---

## Diagram 2: Incident Lifecycle — End-to-End Data Flow

The full incident journey from alert trigger to knowledge writeback, showing every agent, safety gate, and decision branch.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#1F2937', 'edgeLabelBackground':'#111827'}}}%%
flowchart TB

    subgraph Step1 [1. Ingestion & Safety Gate]
        AlertIn[Raw Alert / Log / Telemetry Input]
        EI{Enkrypt AI Input Guardrail}
        PIIRedact[PII Redaction & Secret Removal]
        InjBlock[Prompt Injection Block]
    end

    subgraph Step2 [2. Triage & Confidence Gate]
        TRIAGE[TriageAgent<br>Severity: SEV1-3<br>Burn Rate Calculation]
        CONFGATE{Confidence Score}
        ManualReview[Dual Human Review<br>confidence < 0.85]
    end

    subgraph Step3 [3. Hybrid Retrieval]
        RW[Retrieval Workflow]
        QD_Dense[Qdrant Dense Search<br>text-embedding-3-large<br>1536 dims / Cosine]
        QD_Sparse[Qdrant Sparse Search<br>BM25 Keyword Matching]
        RRF[RRF Fusion k=60<br>Temporal Decay 1.2x<br>Trust Score Filter > 0.5]
    end

    subgraph Step4 [4. Remediation Planning]
        RA[RemediationAgent<br>CRISPE + CoT + Few-Shot<br>temp=0.1 top_p=0.9]
        EO{Enkrypt AI Output Guardrail<br>Hallucination & Citation Check}
    end

    subgraph Step5 [5. HITL Approval Gate]
        HITL[HITL Dashboard<br>Incident Commander Review]
        SUSPEND[workflow.suspend<br>traceparent → Postgres]
        APPROVE{IC Decision}
        RESUME[workflow.resume<br>Re-link OTel Child Span]
    end

    subgraph Step6 [6. Execution & Post-Mortem]
        EXEC[Execute Approved Steps<br>Idempotency Key Check]
        PM[PostMortemAgent<br>Blameless Report<br>MTTR Regression Delta]
        WB[Qdrant Writeback<br>512 token chunks<br>50 token overlap]
    end

    AlertIn --> EI
    EI -->|PII detected| PIIRedact --> TRIAGE
    EI -->|Injection detected| InjBlock
    EI -->|Clean| TRIAGE

    TRIAGE --> CONFGATE
    CONFGATE -->|score < 0.85| ManualReview
    CONFGATE -->|score >= 0.85| RW

    RW --> QD_Dense
    RW --> QD_Sparse
    QD_Dense --> RRF
    QD_Sparse --> RRF
    RRF --> RA

    RA --> EO
    EO -->|Citation valid| HITL
    EO -->|Hallucination detected| RA

    HITL --> SUSPEND
    SUSPEND --> APPROVE
    APPROVE -->|Approved| RESUME --> EXEC
    APPROVE -->|Rejected| RA

    EXEC --> PM
    PM --> WB

    style EI fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style EO fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style TRIAGE fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style RA fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style PM fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style QD_Dense fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style QD_Sparse fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style WB fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
```

---

## Diagram 3: Mastra Workflow State Machine

The deterministic 10-step state machine showing all execution states, transition conditions, and failure branches.

```mermaid
%%{init: {'theme': 'dark'}}%%
stateDiagram-v2
    [*] --> ingest : Alert received at API Gateway

    ingest --> sanitize : Raw telemetry payload
    sanitize --> triage : Enkrypt AI cleared input

    triage --> confidence_gate : TriageAgent output (Zod validated)

    confidence_gate --> manual_review : confidence_score < 0.85
    confidence_gate --> retrieval : confidence_score >= 0.85

    manual_review --> [*] : IC manually assigns and closes

    retrieval --> remediation : Top-K ranked context from Qdrant
    remediation --> hitl_gate : RemediationAgent plan (Enkrypt validated)

    hitl_gate --> execute : IC Approved (workflow.resume called)
    hitl_gate --> remediation : IC Rejected (re-plan with feedback)

    execute --> post_mortem : Actions applied, incident marked resolved
    post_mortem --> writeback : Blameless report generated

    writeback --> kfs_trigger : Post-mortem upserted to Qdrant
    kfs_trigger --> [*] : Knowledge Freshness Service activated

    note right of sanitize
        Enkrypt AI: PII REDACT
        Injection BLOCK
        Secret REDACT
    end note

    note right of hitl_gate
        workflow.suspend()
        traceparent serialized to Postgres
        IC notified via Dashboard
    end note

    note right of execute
        Idempotency check:
        incidentId + stepName
        query workflow_state table
    end note
```

### Step-by-Step State Definitions

| Step | Input | Output | Failure Handling |
|:---|:---|:---|:---|
| `ingest` | Raw webhook/telemetry | Parsed payload | Return 400, log to audit_logs |
| `sanitize` | Raw payload | Cleaned payload | Block and suspend if injection detected |
| `triage` | Cleaned payload | `TriageSchema` (Zod) | If LLM error, retry ×3 then manual_review |
| `confidence_gate` | confidence_score | Branch decision | Below 0.85 always routes to manual_review |
| `retrieval` | Service context | Top-20 RRF chunks | If Qdrant unavailable, continue with empty context + flag |
| `remediation` | Context chunks | `RemediationSchema` (Zod) | If Enkrypt blocks output, retry with reduced temperature |
| `hitl_gate` | Remediation plan | IC decision | Timeout after 4 hours triggers re-escalation alert |
| `execute` | Approved steps | Execution log | Idempotency key prevents duplicate runs |
| `post_mortem` | Full trace | `PostMortemSchema` (Zod) | Draft saved even if MTTR delta query fails |
| `writeback` | Post-mortem doc | Qdrant upsert | Queue for retry if Qdrant write fails |

---

## Diagram 4: Knowledge Freshness Service — Active Curation Flow

The background Mastra worker that prevents knowledge drift by proactively detecting and resolving conflicts between new post-mortems and existing runbooks.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#1F2937'}}}%%
flowchart LR

    subgraph Triggers [4 Trigger Mechanisms]
        T1[Post-Mortem Closure<br>Event-Driven]
        T2[IC Rejection Events<br>Feedback-Driven]
        T3[Weekly Cron<br>Schedule-Driven]
        T4[Stale Content Queue<br>Manual-Driven]
    end

    subgraph KFSCore [Knowledge Freshness Service Core]
        KW[KFS Worker<br>Mastra Background Step]
        CD{Cross-Collection<br>Conflict Detection<br>cosine > 0.85}
        CS[Conflict Score<br>Calculator]
    end

    subgraph ConflictRes [Tiered Conflict Resolution]
        T1R[Tier 1: Auto-Resolve<br>Score A > 1.5x Score B<br>Winner supersedes loser]
        T2R[Tier 2: Synthesis<br>SynthesisAgent generates<br>Reconciled Draft]
        T3R[Tier 3: Human Review<br>Safety-critical contradiction<br>Side-by-side diff in HITL]
        T4R[Tier 4: Prefer Newer<br>Semantically identical<br>temporal update only]
    end

    subgraph SafetyCheck [Safety Backstop]
        EO{Enkrypt AI Output<br>Guardrail Check}
        PR[Pending Review State<br>Qdrant synthesis_drafts]
        HL[Flag for Tier 3<br>Human Review]
    end

    subgraph Output [Knowledge Base Updates]
        QDU[Qdrant Update<br>Supersede / Merge / Archive]
        SCQ[Stale Content Queue<br>HITL Dashboard]
        FL[Feedback Log<br>IC rejection patterns<br>trust_score downgrade]
    end

    T1 --> KW
    T2 --> KW
    T3 --> KW
    T4 --> KW

    KW --> CD
    CD --> CS

    CS -->|Score A > 1.5x B| T1R
    CS -->|Scores within 1.5x| T2R
    CS -->|Safety-critical terms| T3R
    CS -->|Identical content| T4R

    T2R --> EO
    EO -->|Pass| PR --> QDU
    EO -->|Fail - hallucination| HL --> T3R

    T1R --> QDU
    T3R --> SCQ
    T4R --> QDU
    T2 --> FL

    style KW fill:#581C87,stroke:#A855F7,stroke-width:2px,color:#FFF
    style CD fill:#581C87,stroke:#A855F7,stroke-width:2px,color:#FFF
    style EO fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style QDU fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
```

### Conflict Score Formula

Every document pair in conflict is evaluated using a weighted composite score:

```
Score = (1 / days_since_created × 0.4)
      + (approval_rate × usage_count × 0.4)
      + (source_authority × 0.2)

Where:
  days_since_created  = calendar days since document was created
  approval_rate       = fraction of IC approvals citing this document
  usage_count         = number of times retrieved in active incidents
  source_authority    = 1.0 if verified by sre_lead, 0.6 otherwise
```

| Tier | Condition | Resolution | Human Required |
|:---|:---|:---|:---|
| **Tier 1** | Score A > 1.5× Score B | Auto-supersede. Loser tagged `superseded`. | No |
| **Tier 2** | Scores within 1.5× of each other | SynthesisAgent generates reconciled draft, Enkrypt validates, enters `pending_review`. | No (async) |
| **Tier 3** | Safety-critical keywords in conflict | Side-by-side diff surfaced on HITL Dashboard. Options: Keep / Trust PM / Approve Synthesis. | Yes |
| **Tier 4** | Semantically identical, different timestamps | Newer document replaces older. No synthesis needed. | No |

---

## Diagram 5: Qdrant Memory & Hybrid Retrieval Strategy

How Runbook Sentinel queries, ranks, and filters its four Qdrant collections to produce the most relevant and trustworthy context for the RemediationAgent.

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR

    subgraph Query [Query Construction]
        CTX[Incident Context<br>service + severity + log snippet]
        DE[Dense Embedding<br>text-embedding-3-large<br>1536 dims]
        SP[Sparse Encoding<br>BM25 keyword weights]
    end

    subgraph Fetch [Parallel Prefetch]
        QD1[(runbooks<br>service_id, version<br>verified_by, last_used_at)]
        QD2[(historical_incidents<br>severity, root_cause<br>resolution_status)]
        QD3[(post_mortems<br>mttr, author<br>action_items, trace_id)]
        QD4[(synthesis_drafts<br>source_uuids, conflict_score<br>status: pending/approved)]
    end

    subgraph Fusion [Re-Ranking & Filtering]
        RRF[Reciprocal Rank Fusion<br>k = 60<br>Dense 20 + Sparse 20]
        TD[Temporal Decay<br>created_at within 30 days<br>score × 1.2x multiplier]
        TS[Trust Score Filter<br>trust_score > 0.5<br>Stale content de-ranked]
    end

    subgraph Output [Top-K Context Window]
        TOP[Top 8-12 Chunks<br>Ranked by composite score<br>with Qdrant UUID preserved]
    end

    CTX --> DE
    CTX --> SP

    DE -->|limit: 20| QD1
    DE -->|limit: 20| QD2
    DE -->|limit: 20| QD3
    DE -->|limit: 20| QD4
    SP -->|limit: 20| QD1
    SP -->|limit: 20| QD2

    QD1 --> RRF
    QD2 --> RRF
    QD3 --> RRF
    QD4 --> RRF

    RRF --> TD --> TS --> TOP

    style QD1 fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style QD2 fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style QD3 fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style QD4 fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style RRF fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
```

### Collection Schema Reference

| Collection | Vector Size | Distance | Key Metadata Fields |
|:---|:---|:---|:---|
| `runbooks` | 1536 | Cosine | `service_id`, `version`, `verified_by`, `last_used_at`, `trust_score` |
| `historical_incidents` | 1536 | Cosine | `severity`, `root_cause`, `resolution_status`, `incident_id`, `mttr` |
| `post_mortems` | 1536 | Cosine | `mttr_delta`, `author`, `action_items`, `trace_id`, `affected_service` |
| `synthesis_drafts` | 1536 | Cosine | `source_uuids`, `conflict_score`, `status` (pending/approved) |

---

## Diagram 6: Enkrypt AI Safety Decision Tree

All possible input and output states, and what action Enkrypt AI takes for each.

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TD

    IN[Incoming Data<br>Input or LLM Output]

    IN --> CHK1{PII Detected?<br>email / IP / phone}
    CHK1 -->|Yes| REDACT1[REDACT<br>Replace with token<br>e.g. user@corp.com → REDACTED_EMAIL<br>Audit log entry created]
    CHK1 -->|No| CHK2

    CHK2{Secret / API Key<br>Detected?}
    CHK2 -->|Yes| REDACT2[REDACT<br>Remove key from payload<br>e.g. sk-abc123 → REDACTED_SECRET<br>Security alert fired]
    CHK2 -->|No| CHK3

    CHK3{Prompt Injection<br>Detected?}
    CHK3 -->|Yes| BLOCK1[BLOCK<br>Workflow suspended<br>Incident flagged for manual review<br>No LLM call made]
    CHK3 -->|No| CHK4

    CHK4{Output: Hallucinated<br>UUID in evidence_refs?}
    CHK4 -->|Yes| BLOCK2[BLOCK<br>Plan rejected<br>Agent retries with original context<br>Max 3 retries then HITL escalation]
    CHK4 -->|No| CHK5

    CHK5{Output: Synthesis Draft<br>Hallucination Check}
    CHK5 -->|Fail| BLOCK3[BLOCK<br>Draft not stored<br>Conflict escalated to Tier 3 Human Review]
    CHK5 -->|Pass| PASS[PASS<br>Data delivered to next step<br>gen_ai.prompt.hash logged to OTel]

    REDACT1 --> CHK2
    REDACT2 --> CHK3

    style REDACT1 fill:#92400E,stroke:#F59E0B,stroke-width:2px,color:#FFF
    style REDACT2 fill:#92400E,stroke:#F59E0B,stroke-width:2px,color:#FFF
    style BLOCK1 fill:#7F1D1D,stroke:#EF4444,stroke-width:2px,color:#FFF
    style BLOCK2 fill:#7F1D1D,stroke:#EF4444,stroke-width:2px,color:#FFF
    style BLOCK3 fill:#7F1D1D,stroke:#EF4444,stroke-width:2px,color:#FFF
    style PASS fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
```

---
<img width="1663" height="945" alt="image" src="https://github.com/user-attachments/assets/711eecef-71d2-4e95-a5bb-25a7c32553fb" />

## Diagram 7: OpenTelemetry Observability Flow

How traces, spans, and GenAI metrics flow from every agent through to the observability backend, including how HITL suspension is handled without breaking trace continuity.

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR

    subgraph Services [Instrumented Services]
        GW[API Gateway<br>Injects x-correlation-id<br>Starts root span]
        TA[TriageAgent<br>Child span]
        RW[Retrieval Workflow<br>Child span]
        RA[RemediationAgent<br>Child span]
        PM[PostMortemAgent<br>Child span]
        KW[KFS Worker<br>Child span]
    end

    subgraph Attrs [Mandatory Span Attributes]
        A1[gen_ai.request.model<br>e.g. gpt-4o]
        A2[gen_ai.request.temperature<br>e.g. 0.1]
        A3[gen_ai.usage.input_tokens]
        A4[gen_ai.usage.output_tokens]
        A5[gen_ai.prompt.hash<br>SHA-256 of prompt<br>No PII in traces]
        A6[incident.correlation_id<br>Propagated from Gateway]
        A7[service.name<br>e.g. triage-service]
    end

    subgraph HITL_Trace [HITL Trace Persistence]
        SUSP[workflow.suspend<br>Serialize traceparent<br>to workflow_state table]
        WAIT[Hours pass...<br>IC reviews on Dashboard]
        RESM[workflow.resume<br>Deserialize traceparent<br>Create linked child span]
    end

    subgraph Export [Export Pipeline]
        OC[OTel Collector<br>Phase 2]
        OB[Honeycomb / Datadog<br>Phase 2]
        LOCAL[Local OTel SDK<br>Phase 1 MVP]
    end

    GW --> TA --> RW --> RA --> SUSP
    SUSP --> WAIT --> RESM --> PM --> KW

    TA --> A1
    TA --> A2
    TA --> A3
    TA --> A4
    TA --> A5
    TA --> A6
    TA --> A7

    GW --> LOCAL
    TA --> LOCAL
    RA --> LOCAL
    PM --> LOCAL
    KW --> LOCAL

    LOCAL -.->|Phase 2| OC
    OC -.->|Phase 2| OB

    style SUSP fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style RESM fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style A5 fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style OC fill:#374151,stroke:#6B7280,stroke-width:2px,color:#AAA
    style OB fill:#374151,stroke:#6B7280,stroke-width:2px,color:#AAA
```

### HITL Trace Continuity Mechanism

The HITL suspension creates a time gap of hours in an incident trace. Rather than keeping an in-memory span open (which would time out or exhaust resources), Runbook Sentinel uses a **Trace Persistence** pattern:

1. **Suspend**: When `workflow.suspend()` is called, the current `traceparent` (W3C format: `00-traceId-spanId-flags`) is serialized and stored in the `workflow_state.traceparent` column in PostgreSQL alongside the workflow checkpoint.
2. **Wait**: The OTel span technically ends here. The trace appears "incomplete" in the backend but the traceId is preserved.
3. **Resume**: When the IC approves via the Dashboard, `workflow.resume()` retrieves the stored `traceparent`, extracts the `traceId`, and starts the next span as an explicit child of the original trace context using the OTel propagation API.
4. **Result**: Honeycomb/Datadog shows a single connected trace for the full incident lifecycle with a visible time gap during the human review window — a feature, not a bug.

---

## High-Level MVP Critical Path

A simplified view of the mandatory hackathon stack integration for the Round 1 submission.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#1F2937', 'edgeLabelBackground':'#111827', 'tertiaryColor': '#111827'}}}%%
flowchart LR
    Ingestion[1. Ingestion<br>Raw logs, alerts, notes] -->|Telemetry| EnkryptInput[2. Enkrypt AI<br>Input Guardrails]
    EnkryptInput -->|Sanitized Context| MastraOrch[3. Mastra Orchestration<br>Workflows & Agents]

    MastraOrch <-->|Retrieval & Writeback| QdrantMem[(4. Qdrant Memory<br>Runbooks, Incidents, PMs)]
    MastraOrch <-->|LLM Inference| LLM[OpenAI GPT-4o<br>temp=0.1 top_p=0.9]

    MastraOrch -->|Remediation Proposal| EnkryptOutput[5. Enkrypt AI<br>Output Guardrails]
    EnkryptOutput -->|Verified Citations| SecureOutput[6. HITL Dashboard<br>Actionable Guidance]
    SecureOutput -->|IC Approval| MastraOrch

    MastraOrch -->|Post-Mortem + KFS| KFSLoop[7. Knowledge Freshness<br>Active Curation Loop]
    KFSLoop -->|Updated Knowledge| QdrantMem

    style EnkryptInput fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style EnkryptOutput fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style MastraOrch fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style QdrantMem fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style LLM fill:#475569,stroke:#94A3B8,stroke-width:2px,color:#FFF
    style KFSLoop fill:#581C87,stroke:#A855F7,stroke-width:2px,color:#FFF
```
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/09d3dc67-b5a6-4e67-a505-57d952d80b7e" />
