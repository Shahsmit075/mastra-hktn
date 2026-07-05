# Product Requirements Document: Runbook Sentinel

**Version:** 1.0  
**Status:** Final Submission / Production-Ready  
**Track:** Track 5: Incident Response & Post-Mortem Agent  
**Author:** Principal Product Manager & Solutions Architect  

---

## 1. Executive Summary
Runbook Sentinel is an AI-native SRE (Site Reliability Engineering) platform designed to transform incident response from a reactive, manual toil into a self-improving, agentic workflow. Unlike traditional alerting tools that merely route notifications, Runbook Sentinel orchestrates the entire incident lifecycle—from initial triage and safety-guarded remediation to blameless post-mortem generation and automated knowledge curation.

The core technical differentiator is the **Compounding Knowledge Loop**. By integrating **Mastra** for durable workflow orchestration, **Qdrant** for high-precision hybrid retrieval, and **Enkrypt AI** for multi-layer safety guardrails, the system ensures that every incident resolved becomes a permanent, validated improvement to the institutional knowledge base. The platform specifically solves the "Knowledge Drift" problem through a proactive **Knowledge Freshness Service**, ensuring that 2024 operational reality always supersedes 2022 documentation.

---

## 2. Problem Statement
Modern distributed systems have outpaced human ability to maintain manual runbooks, leading to five critical operational failures:

1.  **Context Reconstruction Toil:** SREs spend the first 15–20 minutes of a SEV1 incident gathering logs and metrics. *Metric: P50 MTTR for complex incidents exceeds 45 minutes.*
2.  **Stale Knowledge Drift:** Runbooks are often months or years out of date, leading to incorrect or dangerous remediation steps. *Metric: 30% of incident escalations are caused by following outdated documentation.*
3.  **Alert Fatigue & Triage Bottlenecks:** High-volume "noise" alerts mask critical signals, delaying response. *Metric: 40% of alerts are ignored or acknowledged without investigation.*
4.  **Unsafe AI Guidance:** Generic LLM copilots lack infrastructure context and safety guardrails, risking catastrophic "hallucinated" commands. *Metric: 0% of generic LLMs meet SRE safety-critical compliance.*
5.  **Delayed Post-Mortems:** Post-incident reviews are often deferred due to the effort required to reconstruct timelines, losing critical learning opportunities. *Metric: Average time-to-post-mortem is >10 days.*

---

## 3. Competitive Differentiation

| Capability | PagerDuty | Datadog AI | Generic LLM | **Runbook Sentinel** |
| :--- | :--- | :--- | :--- | :--- |
| **Alert Routing** | ✅ Native | ✅ Native | ❌ No | ✅ Integrated |
| **Semantic Search** | ❌ Basic | 🔶 Limited | ✅ High | ✅ Hybrid (Dense+BM25) |
| **Evidence-Backed Plans** | ❌ No | ❌ No | ❌ No | ✅ Yes (Citations) |
| **Cross-Incident Learning** | ❌ No | 🔶 Limited | ❌ No | ✅ Yes (Freshness Svc) |
| **Safety Evaluation** | ❌ No | ❌ No | ❌ No | ✅ Enkrypt AI Guardrails |
| **Multi-step Orchestration** | 🔶 Static | ❌ No | ❌ No | ✅ Mastra Durable Workflows |
| **Knowledge Writeback** | ❌ No | ❌ No | ❌ No | ✅ Automated & Tiered |

---

## 4. Target Users & Incident Roles

1.  **On-Call Engineer:** Primary responder. Needs rapid triage and low-risk remediation options. *Permissions: View incidents, execute low-risk actions.*
2.  **Incident Commander (IC):** Strategic lead for SEV1s. Approves high-risk plans. *Permissions: Full approval authority, override agent decisions.*
3.  **Communications Lead:** Manages stakeholder updates. *Permissions: View blameless timeline, generate status pages.*
4.  **SRE Lead:** Owns the knowledge base. Reviews "Knowledge Conflicts" and Synthesis drafts. *Permissions: Knowledge curation, prompt configuration.*
5.  **Compliance/Audit Officer:** Reviews immutable logs for regulatory requirements. *Permissions: Read-only access to Audit Trail and OTel traces.*

---

## 5. Product Vision & Non-Goals
**Vision:** To create a "Self-Healing Knowledge Base" where the distance between a system failure and a permanent documentation update is measured in minutes, not months.

**Non-Goals:**
*   Runbook Sentinel is **not** a replacement for monitoring (Prometheus/Datadog); it is a consumer of their alerts.
*   It will **not** execute destructive actions (e.g., `rm -rf /`, `drop database`) without explicit, multi-factor Human-in-the-Loop (HITL) approval.
*   It is **not** a general-purpose chatbot; it is a specialized SRE agent.

---

## 6. Core Product Narrative
A SEV1 alert triggers from Prometheus: "Payments-DB Connection Pool Exhausted." The **API Gateway** receives the webhook, and **Enkrypt AI** sanitizes the input. The **Mastra Orchestrator** initiates a durable workflow. The **TriageAgent** analyzes the telemetry, identifies a SEV1, and because confidence is 92%, it proceeds to the **RetrievalWorkflow**. 

The **RemediationAgent** queries **Qdrant**, finding a 2024 post-mortem that suggests increasing the pool size. It generates a plan with citations. Because the action is "Mitigating" (requires a restart), the workflow hits a **HITL Gate**, notifying the **Incident Commander** on the **Dashboard**. The IC approves; the agent executes the patch. Post-resolution, the **Post-Mortem Agent** generates a blameless report. Finally, the **Knowledge Freshness Service** detects that this new incident contradicts an older 2022 runbook and flags it for the SRE Lead to reconcile.

---

## 7. Key Features

1.  **Durable Agentic Workflows:** Mastra-powered state machine ensures incidents resume exactly where they left off after human approval.
2.  **Hybrid RAG Retrieval:** Qdrant-based search combining semantic meaning (Dense) and keyword precision (BM25).
3.  **Enkrypt AI Guardrails:** Real-time PII masking and prompt injection blocking.
4.  **Confidence-Based Branching:** Automated triage for high-confidence events; dual-human review for low-confidence (<85%).
5.  **Knowledge Freshness Service:** Proactive "Gardener" that prunes stale runbooks and resolves conflicts.
6.  **Synthesis Agent:** Automated merging of conflicting operational data into unified drafts.
7.  **Blameless Post-Mortem Engine:** Automated timeline reconstruction and MTTR regression analysis.
8.  **OTel GenAI Observability:** Full auditability of LLM calls using industry-standard semantic conventions.
9.  **Idempotent Execution:** Postgres-backed state prevents duplicate remediation actions.
10. **RBAC HITL Dashboard:** Specialized views for ICs to approve or reject agent-proposed plans.

---

## 8. User Journeys

### Journey 1: On-Call Engineer responds to a SEV1
*   **Trigger:** PagerDuty alert received.
*   **Action:** Engineer opens the Sentinel Dashboard.
*   **System:** Displays TriageAgent's analysis, severity (SEV1), and the "Remediation Plan" already generated.
*   **Outcome:** Engineer sees evidence citations from Qdrant, providing immediate trust in the proposed fix.

### Journey 2: Incident Commander approves high-risk remediation
*   **Trigger:** RemediationAgent proposes a "Rolling Restart" of a core service.
*   **Action:** IC reviews the `estimated_impact` and `risk_level` in the Dashboard.
*   **System:** Workflow is suspended in Mastra (`.suspend()`).
*   **Outcome:** IC clicks "Approve"; Mastra resumes (`.resume()`) and executes the command.

### Journey 3: SRE Lead reviews Knowledge Conflict
*   **Trigger:** Knowledge Freshness Service detects a conflict between a new Post-Mortem and an old Runbook.
*   **Action:** SRE Lead opens the "Stale Content" queue.
*   **System:** Displays a side-by-side diff and a "Synthesized Draft" generated by the SynthesisAgent.
*   **Outcome:** SRE Lead clicks "Approve Synthesis," updating the Qdrant collection.

---

## 9. System Architecture Overview

```mermaid
graph TD
    subgraph Edge_Layer
        A[Telemetry Sources] --> B[API Gateway]
        B --> C{Enkrypt AI Input}
    end

    subgraph Orchestration_Layer
        C --> D[Mastra Orchestrator]
        D --> E[Triage Agent]
        D --> F[Remediation Agent]
        D --> G[Post-Mortem Service]
    end

    subgraph Knowledge_Layer
        G --> H[RabbitMQ Broker]
        H --> I[Knowledge Freshness Service]
        I --> J[Synthesis Agent]
    end

    subgraph Persistence_Layer
        D --> K[(PostgreSQL State)]
        F --> L[(Qdrant Vector DB)]
        I --> L
        J --> L
    end

    subgraph Human_Layer
        D --> M[HITL Dashboard]
        M --> D
        I --> M
    end
```

---

## 10. Mastra Orchestration Layer

### Workflow State Machine
The workflow is defined using `createWorkflow()` with durable step execution.

```mermaid
stateDiagram-v2
    [*] --> ingest
    ingest --> sanitize
    sanitize --> triage
    triage --> confidence_gate
    confidence_gate --> manual_review : confidence < 0.85
    confidence_gate --> retrieval : confidence >= 0.85
    manual_review --> [*] : IC manually assigns
    retrieval --> remediation
    remediation --> hitl_gate
    hitl_gate --> execute : IC Approved
    hitl_gate --> remediation : IC Rejected (re-plan)
    execute --> post_mortem
    post_mortem --> writeback
    writeback --> [*]
```

### Agent Output Schemas (Zod)
```typescript
const TriageSchema = z.object({
  incident_id: z.string().uuid(),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3']),
  confidence_score: z.number().min(0).max(1),
  summary: z.string(),
  affected_services: z.array(z.string()),
  requires_immediate_escalation: z.boolean()
});

const RemediationSchema = z.object({
  plan_id: z.string().uuid(),
  reasoning: z.string(),
  risk_level: z.enum(['low', 'mitigating', 'high']),
  steps: z.array(z.object({
    action: z.string(),
    description: z.string(),
    estimated_impact: z.string(),
    evidence_refs: z.array(z.string()) // Qdrant UUIDs
  }))
});
```

### Few-Shot Example: RemediationAgent
**Example: Database Memory Pressure**
```json
{
  "reasoning": "Historical incident INC-2024-0312 showed that OOMKilled pods on the payments-db node were caused by missing memory limits. The runbook RB-DB-042 specifies setting a 4Gi memory limit.",
  "steps": [
    {
      "action": "kubectl patch deployment payments-db -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"db\",\"resources\":{\"limits\":{\"memory\":\"4Gi\"}}}]}}}}'",
      "risk_level": "mitigating",
      "evidence_refs": ["a3f1b2c4-1234-5678-abcd-ef0123456789"],
      "estimated_impact": "Rolling restart of payments-db pods. 30-90 second disruption window."
    }
  ]
}
```
*Note: `estimated_impact` is mandatory to prevent ICs from approving "blind" restarts during high-traffic SEV1 windows.*

### Idempotency & Failure Mode Analysis
*   **Pattern:** Every Mastra step is keyed by `incidentId + stepName`.
*   **Persistence:** Results are stored in the `workflow_state` table.
*   **Crash Recovery:** If the orchestrator crashes mid-step, the `workflow.commit()` check ensures the LLM is not re-called for the same step upon restart, preventing duplicate remediation commands.

---

## 11. Knowledge Freshness Service

### Conflict Score Formula
The service evaluates every document in a conflict using:
$$Score = (\frac{1}{days\_since\_created} \times 0.4) + (approval\_rate \times usage\_count \times 0.4) + (source\_authority \times 0.2)$$

### Tiered Conflict Resolution
| Tier | Conflict Type | Resolution Mechanism |
| :--- | :--- | :--- |
| **Tier 1** | Clear Winner | Automated: If Score A > 1.5x Score B, A supersedes B. |
| **Tier 2** | Medium Conflict | Synthesis: SynthesisAgent generates a reconciled draft. |
| **Tier 3** | Safety Critical | Human Review: Escalated to HITL Dashboard with side-by-side diff. |
| **Tier 4** | Temporal Only | Prefer Newer: Fallback for semantically identical updates. |

### SynthesisAgent Safety Backstop
If the SynthesisAgent generates a draft, it must pass an **Enkrypt AI Output Guardrail** check (hallucination detection) before being presented to an SRE. If it fails, the system defaults to Tier 3 (Manual Review).

---

## 12. Qdrant Memory & Retrieval

### Collection Schemas
*   **Vector Size:** 1536 (OpenAI `text-embedding-3-large`)
*   **Distance Metric:** Cosine

| Collection | Metadata Fields |
| :--- | :--- |
| `runbooks` | `service_id`, `version`, `verified_by`, `last_used_at` |
| `incidents` | `severity`, `root_cause`, `resolution_status`, `incident_id` |
| `post_mortems` | `mttr`, `author`, `action_items`, `trace_id` |
| `synthesis_drafts` | `source_uuids`, `conflict_score`, `status` (pending/approved) |

### Hybrid Search Config
```javascript
prefetch: [
  { query: denseVector, limit: 20 }, 
  { query: sparseVector, limit: 20 }
],
fusion: "rrf", // Reciprocal Rank Fusion (k=60)
filter: {
  must: [{ key: "trust_score", range: { gt: 0.5 } }]
}
```

---

## 13. Enkrypt AI Safety Layer

| Trigger | Enkrypt Action | Outcome |
| :--- | :--- | :--- |
| PII detected (email/IP) | **REDACT** | `user@corp.com` → `[REDACTED_EMAIL]` |
| Prompt injection | **BLOCK** | Workflow suspended, security alert fired. |
| Hallucinated UUID | **BLOCK** | Plan rejected, agent retries with context. |
| Valid Citation | **PASS** | Delivered to HITL Dashboard. |
| Secret/API Key | **REDACT** | Key removed, audit log entry created. |

**Rationale for `gen_ai.prompt.hash`:** Storing a SHA-256 hash in traces instead of raw prompts prevents PII leakage into observability backends while maintaining full audit reproducibility.

---

## 14. Security Architecture

### RBAC Matrix
| Role | Triage | Approve Plan | Curation | Audit Logs |
| :--- | :--- | :--- | :--- | :--- |
| `on_call_engineer` | ✅ | ❌ | ❌ | ❌ |
| `incident_commander` | ✅ | ✅ | ❌ | 🔶 (Own) |
| `sre_lead` | ✅ | ✅ | ✅ | ✅ |

### Infrastructure Security
*   **Rate Limiting:** Redis-backed sliding window (100 req/min per IP).
*   **Encryption:** AES-256 at-rest, TLS 1.3 in-transit.
*   **Headers:** Helmet.js configured for strict CSP and HSTS.

---

## 15. Observability Stack

**Mandatory OTel Attributes:**
*   `gen_ai.request.model`: e.g., "gpt-4o"
*   `gen_ai.usage.input_tokens` / `output_tokens`
*   `gen_ai.prompt.hash`: Audit reproducibility.
*   `incident.correlation_id`: Propagated from API Gateway.

**HITL Trace Persistence:**
The W3C `traceparent` header is serialized to the `workflow_state` table at every suspension point and deserialized upon resumption to ensure a single, continuous trace across human approval gaps.

---

## 16. API Surface

| Method | Endpoint | Auth | Description | Response |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/v1/incidents` | JWT | Ingest alert/telemetry | `202 Accepted` |
| GET | `/v1/incidents/:id` | JWT | Get workflow status | `IncidentSchema` |
| POST | `/v1/incidents/:id/approve` | JWT | Resume HITL gate | `200 OK` |
| GET | `/v1/knowledge/conflicts` | JWT | List stale content | `ConflictArray` |

---

## 17. Data Requirements

### PostgreSQL Schema
| Table | Column | Type | Description |
| :--- | :--- | :--- | :--- |
| `incidents` | `id`, `status`, `severity`, `created_at` | UUID, ENUM, TIMESTAMPTZ | Core incident record |
| `workflow_state` | `incident_id`, `step_name`, `result_json`, `traceparent` | UUID, VARCHAR, JSONB, VARCHAR | Durable state |
| `audit_logs` | `user_id`, `action`, `prompt_hash`, `timestamp` | UUID, VARCHAR, VARCHAR, TIMESTAMPTZ | Immutable audit trail |

---

## 18. Deployment Architecture
*   **Orchestrator:** Node.js microservice on Railway.
*   **Database:** Managed PostgreSQL (Supabase/Railway).
*   **Vector DB:** Qdrant Cloud (Managed).
*   **Frontend:** React/Tailwind on Vercel.
*   **CI/CD:** GitHub Actions with automated Enkrypt AI safety scans.

---

## 19. MVP Scope vs. Future Phases

| Feature | Status | Risk if Deferred |
| :--- | :--- | :--- |
| Mastra Orchestration | ✅ MVP | N/A |
| Qdrant Hybrid Search | ✅ MVP | N/A |
| Enkrypt AI Guardrails | ✅ MVP | N/A |
| RabbitMQ (Post-Mortem) | 🔶 Phase 1.5 | High load may delay PM generation. |
| OTel Collector Export | 🔶 Phase 2 | Limited long-term trace retention. |
| Multi-region Qdrant | 🔷 Phase 3 | Regional outage causes knowledge loss. |

---

## 20. Demo & Seed Data Strategy
To demonstrate the system, the following seed data is loaded:
*   **3 Synthetic Runbooks:** Database OOM, Redis Latency, Nginx 5xx.
*   **5 Historical Incidents:** Including one "Conflict" case (2022 vs 2024).
*   **2 Post-Mortems:** One with high MTTR to trigger regression alerts.

---

## 21. Success Metrics
*   **MTTR Reduction:** Target 30% reduction in P50 MTTR within 90 days.
*   **Recommendation Acceptance:** >70% of agent plans approved without modification.
*   **Safety Compliance:** 0% PII leakage into observability backends.
*   **Knowledge Growth:** 100% of SEV1 incidents result in a Qdrant writeback.

---

## 22. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| LLM Hallucination | Medium | High | Enkrypt AI Output Guardrails + HITL Gate. |
| Qdrant Stale Index | High | Medium | Knowledge Freshness Service "Gardener" pattern. |
| Token Cost at Scale | Medium | Low | Redis caching of common retrieval queries. |
| HITL Bottleneck | High | Medium | Confidence Gate (<85%) to automate low-risk tasks. |
| API Latency | Low | Medium | Phase 1.5 RabbitMQ decoupling for async tasks. |

---
**Phase 1 Delivery Confidence:** High. By leveraging Mastra's built-in durable execution and Qdrant's managed cloud, the core agentic loop is fully achievable within the hackathon timeline without over-promising on infrastructure complexity.