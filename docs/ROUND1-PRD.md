# Runbook Sentinel — Product Requirements Document (Round 1 Submission)

## 1. Executive Summary
Runbook Sentinel is an intelligent incident response and post-mortem execution platform built for modern Site Reliability Engineering (SRE) workflows. The platform is designed around a mandatory technology stack:
*   **Mastra** orchestrates multi-step agent workflows, tool execution, and human approval gates.
*   **Qdrant** stores long-term operational memory, service runbooks, and historical incident patterns.
*   **Enkrypt AI** evaluates inbound alert context and outbound recommendations to ensure safety and grounding.

Rather than providing a generic chat interface, Runbook Sentinel operates as an incident operating workspace. It automates context collection and retrieval during outages, applies safety checks before suggesting mitigation steps, and writes resolved incident details back into global memory. This ensures that every incident resolved leaves the engineering team with a stronger, more accessible repository of operational knowledge.

---

## 2. Problem Statement & Motivation
Modern production operations suffer from fragmented incident response environments. When critical **Service Level Objectives (SLOs)** are threatened, engineers must navigate disconnected log tools, wiki pages, dashboards, and chat history. Under the pressure of a burning **error budget**, this fragmentation results in several operational failures:

1.  **High Alert Fatigue and Low Signal-to-Noise Ratio**: A massive volume of alerts causes responder fatigue. Identifying root causes amidst high log noise takes too long, slowing the initial **ACK** (acknowledgement) and increasing **Mean Time to Investigate (MTTI)**.
2.  **Context Reconstruction Toil**: Manually collecting logs, trace IDs, and runbook articles during an outage is repetitive, non-trivial **toil** that scales with the number of incidents.
3.  **Ungrounded AI Suggestions**: Using generic large language models for production diagnostics introduces severe risks, including hallucinated commands, leaks of customer data, or executing destructive scripts without service context.
4.  **Delayed Post-Incident Learning**: Timeline reconstruction, mapping **contributing factors**, and defining **corrective actions** are rarely captured accurately because post-mortems are delayed or treated as administrative work.

Runbook Sentinel targets these gaps directly, with the ultimate goal of reducing **Mean Time to Restore (MTTR)** by automating investigation context, verifying recommendations through a safety gate, and capturing incident data in structured timelines.

---

## 3. Solution Description & Core Functionalities
Runbook Sentinel functions as the decision-support and memory layer for incident response teams. It combines semantic retrieval, persistent memory, and safety evaluation into one production-oriented copilot.

### 3.1 Competitive Differentiation
Unlike generic or monitoring-focused tools, Runbook Sentinel operates as a learning system:

| Capability | PagerDuty / Opsgenie | Datadog AI Assistant | Generic LLM Copilots | Runbook Sentinel |
|---|---|---|---|---|
| Alert routing & escalation | ✅ Core function | ✅ Core function | ❌ | Integration-ready (non-goal to replace) |
| Semantic search over past incidents | ❌ | ❌ | ❌ | ✅ Qdrant-backed institutional memory |
| Evidence-backed remediation | ❌ | Partial (dashboard Q&A) | Hallucination-prone | ✅ Citation-enforced with Enkrypt validation |
| Cross-incident learning | ❌ | ❌ | ❌ (stateless) | ✅ Writeback loop compounds knowledge |
| Safety evaluation on outputs | ❌ | ❌ | ❌ | ✅ Enkrypt adherence + hallucination gates |
| Multi-step workflow orchestration | ❌ | ❌ | ❌ | ✅ Mastra workflows with HITL |

### 3.2 Target Users & Roles
*   **On-Call Engineer**: The first responder paged when a service degrades. Needs low-noise diagnostic context and safe **mitigation** steps.
*   **Incident Commander (IC)**: Manages severe outages (SEV1/SEV2), establishes the **incident channel**, coordinates the **bridge call**, and authorizes high-risk actions.
*   **Scribe**: Captures timeline milestones, decisions, and action items. Runbook Sentinel automates this role by tracking all actions, retrievals, and approvals.

### 3.3 Core Feature Set
1.  **Secure Intake**: Accepts input via copy-pasted log traces, slack alerts, or webhooks, using Enkrypt AI to redact secrets and PII.
2.  **SLO Assessment**: Triages alerts to identify the target service and evaluates the threat of an SLO or SLA breach.
3.  **Semantic Retrieval**: Queries Qdrant to find matching runbook sections and similar past incidents.
4.  **Remediation Proposals**: Proposes ranked remediation actions split by risk rating, requiring evidence citations on every step.
5.  **HITL Approvals**: Suspends Mastra workflows when high-risk actions are proposed, waiting for IC review.
6.  **Knowledge Writeback**: Pushes the finalized post-mortem and validated log signatures back to Qdrant at incident closure.

### 3.4 Core User Journey: Active SEV2 Triage
1.  An on-call engineer receives an alert for elevated HTTP 5xx errors on `checkout-api`.
2.  The engineer enters the alert payload and logs into the Runbook Sentinel room.
3.  Enkrypt AI evaluates the input, blocks injection patterns, and redacts database passwords in the logs.
4.  Mastra triggers the response workflow; `TriageAgent` classifies it as a SEV2 incident threatening the latency SLO.
5.  Qdrant retrieves cache stampede runbooks and a similar incident from last month.
6.  The `RemediationAgent` recommends diagnostic steps (checking cache hits) and a mitigation step (flushing Redis keys).
7.  The engineer applies the suggestion, validates recovery, and marks the incident mitigated.
8.  The system drafts a blameless post-mortem identifying the root cause and writes the finalized patterns back to Qdrant.

---

## 4. System Context & Data Flow

![ARCH-SIMPLE.png](./ARCH-SIMPLE.png)

---

## 5. Key Technology Integrations

### 5.1 Mastra: Agent & Workflow Orchestration
Mastra coordinates multi-step operational logic using typed, durable workflows and specialized agents (`TriageAgent`, `RetrievalAgent`, `RemediationAgent`, and `PostMortemAgent`).

*   **Evidence Linking Schema**: The `RemediationAgent` output schema requires an array of source references for every recommendation.
```typescript
import { z } from 'zod';

const remediationOutputSchema = z.object({
  steps: z.array(z.object({
    action: z.string().describe('The command to execute or check to perform'),
    risk_level: z.enum(['diagnostic', 'mitigating', 'high_risk']),
    rationale: z.string().describe('Operational justification for this step'),
    confidence: z.number().min(0).max(1).describe('Confidence score'),
    evidence_refs: z.array(z.string()).min(1)
      .describe('Array of IDs linking to Qdrant runbook chunks or past incidents'),
  })),
  overall_hypothesis: z.string().describe('Primary theory behind this failure pattern'),
});
```

*   **Supervisor Agent Pattern (Round 2 Evolution)**: While explicit workflows coordinate execution during Round 1, subagents are configured to support supervisor delegation for Round 2:
```typescript
import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

const incidentSupervisor = new Agent({
  name: 'incident-supervisor',
  description: 'Supervisor responsible for managing incident response steps.',
  instructions: `You coordinate incident response. Route to triage-agent first,
    then retrieval-agent for evidence, then remediation-agent for action plans.`,
  model: openai('gpt-4o'),
  agents: { triageAgent, retrievalAgent, remediationAgent, postMortemAgent },
});
```

*   **Mastra Memory**: Workflows use thread-scoped working memory to track incident properties, while semantic recall queries local messages.
```typescript
const incidentWorkingMemory = z.object({
  severity: z.enum(['SEV1', 'SEV2', 'SEV3']).optional(),
  affectedService: z.string().optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  activeHypotheses: z.array(z.string()).default([]),
});
```

### 5.2 Qdrant: Memory & Semantic Retrieval Layer
Qdrant serves as the long-term memory system across four collections: `incidents`, `runbooks`, `log_chunks`, and `post_mortems`.
*   **Log Hybrid Search**: Since logs contain exact identifiers, the `log_chunks` collection queries both dense embeddings and sparse vectors (BM25), combining them via Reciprocal Rank Fusion (RRF):
```typescript
const results = await qdrantClient.query('log_chunks', {
  prefetch: [
    { query: denseEmbeddingVector, using: 'dense', limit: 20 },
    { query: { indices: sparseIndices, values: sparseValues }, using: 'sparse', limit: 20 },
  ],
  filter: { must: [{ key: 'service', match: { value: serviceName } }] },
  fusion: 'rrf',
  limit: 10,
});
```
*   **Vector Initialization**: Done via `@mastra/qdrant` client at startup:
```typescript
import { QdrantVector } from '@mastra/qdrant';

const incidentStore = new QdrantVector({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
  https: true,
});

await incidentStore.createIndex({ indexName: 'incidents', dimension: 3072, metric: 'cosine' });
await incidentStore.createIndex({ indexName: 'runbooks', dimension: 3072, metric: 'cosine' });
```

### 5.3 Enkrypt AI: Input & Output Safety Gating
Enkrypt AI serves as a safety firewall for the application:
*   **Input Guardrails**: Evaluates alerts and logs to block prompt injection and redact sensitive configurations, passwords, and tokens.
*   **Output Guardrails**:
    *   *Adherence*: Validates generated remediation plans against retrieved Qdrant evidence passed as `context`.
    *   *Hallucination*: Runs hallucination detectors via `POST /guardrails/hallucination` to ensure the generated commands do not introduce ungrounded assumptions.
    *   *Gating Policy*: Rejects plans with empty citations or relevancy scores below 0.70.

---

## 6. Infrastructure & Deployment Summary
*   **Frontend & UX**: Next.js dashboard presenting a structured workspace (Incident Room, Timeline, Evidence Panel, Post-Mortem Editor).
*   **Backend API**: Node.js/Express hosting the API and Mastra runtime, managing relational schema states (incidents, timeline logs, approvals).
*   **Deployment Architecture**: Next.js hosted on **Vercel**; API & Mastra Runtime hosted on **Railway** (selected for persistent workflow state and suspend/resume processing); vector stores run on managed **Qdrant Cloud** clusters.
*   **Platform Observability**: Monitored using the **Four Golden Signals**: Latency (search/generation), Traffic (active incident runs), Errors (Enkrypt rejections), and Saturation (queue depth).

---

## 7. MVP Scope & Success Metrics

### 7.1 Scope for Round 1 MVP
*   Incident ingestion from pasted alerts or logs.
*   Triage classification and severity-aware workflow branching.
*   Qdrant semantic retrieval over seeded incident and runbook collections.
*   Enforced citation mapping and Enkrypt safety check gates.
*   HITL approval flow for high-risk actions.
*   Incident timeline tracking and blameless post-mortem draft generation.

### 7.2 Success Metrics
*   **Time to Actionable Suggestion (MTTI)**: P75 < 8 seconds.
*   **Retrieval Latency**: P75 < 3 seconds.
*   **Post-Mortem Draft Coverage**: ≥ 90% of incidents within 5 minutes.
*   **Retrieval Precision@5**: ≥ 0.80 (required before hallucination checks execute).
*   **Enkrypt First-Pass Rate**: ≥ 85% safety checks passed.

### 7.3 High-Impact Risks & Mitigations
*   *Risk: Hallucinated Commands*: Mitigated by Zod output schema constraints, Enkrypt adherence evaluations, and IC human approval checkpoints.
*   *Risk: Hallucination Check on Stale/Bad Data*: If Qdrant retrieval results are poor, ungrounded recommendations might pass adherence checks. Mitigated by applying a precision@5 threshold gate; search relevance scoring below 0.80 flags the degradation and halts generation.
*   *Risk: Sensitive Data Leaks*: Mitigated by Enkrypt input detectors scanning and redacting telemetry before processing.

---

## 8. Future Enhancements
*   PagerDuty webhook integration to automate alert ingestion.
*   Bi-directional Slack integration to sync incident timelines with Slack channels.
*   Interactive log search tools to query active log streams directly from the incident workspace.
*   Automated checks to verify if a mitigation step resolved the target error.
