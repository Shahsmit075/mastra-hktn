# Runbook Sentinel — IEEE 830 Requirements Traceability Matrix

This document maps every Functional Requirement (FR) to the exact microservice, API endpoint, database table, and Qdrant collection responsible for fulfilling it. This satisfies the judge recommendation for a formal traceability matrix.

---

| FR | Requirement | Microservice / File | API Endpoint | DB Table | Qdrant Collection | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **FR-1** | Alert ingestion from Prometheus/PagerDuty/webhooks | `apps/api/src/routes/alerts.ts` | `POST /v1/incidents` | `incidents` | — | Planned |
| **FR-2** | Input sanitization: PII redaction, secret removal, injection blocking | `apps/api/src/mastra/tools/enkryptGuardrail.ts` | — | `audit_logs` (prompt_hash) | — | Planned |
| **FR-3** | Automated incident triage with SEV1/2/3 classification | `apps/api/src/mastra/agents/triageAgent.ts` | — | `workflow_state` | `historical_incidents` | Planned |
| **FR-4** | Confidence gate: <85% confidence routes to manual review | `apps/api/src/mastra/workflows/incidentWorkflow.ts` (confidenceGateStep) | `GET /v1/incidents/:id` (status: awaiting_manual_review) | `incidents.status` | — | Planned |
| **FR-5** | Hybrid RAG retrieval: Dense + BM25 + RRF + temporal decay | `apps/api/src/mastra/tools/qdrantSearch.ts` | — | — | `runbooks`, `historical_incidents`, `post_mortems` | Planned |
| **FR-6** | Evidence-backed remediation plan with mandatory `evidence_refs` UUIDs | `apps/api/src/mastra/agents/remediationAgent.ts` | — | `workflow_state` | `runbooks`, `historical_incidents` | Planned |
| **FR-7** | Output validation: hallucination blocking, citation verification | `apps/api/src/mastra/tools/enkryptGuardrail.ts` (enkryptOutputGuardrailTool) | — | `audit_logs` | — | Planned |
| **FR-8** | Human-in-the-Loop approval gate with workflow suspension | `apps/api/src/mastra/workflows/incidentWorkflow.ts` (hitlGateStep) | `POST /v1/incidents/:id/approve` | `workflow_state.traceparent` | — | Planned |
| **FR-9** | OTel trace continuity across HITL suspension/resumption | `apps/api/src/lib/telemetry.ts` + `workflow_state.traceparent` | — | `workflow_state` | — | Planned |
| **FR-10** | Blameless post-mortem generation (Google SRE standard) | `apps/api/src/mastra/agents/postMortemAgent.ts` | — | `incidents.mttr_minutes` | `post_mortems` | Planned |
| **FR-11** | Knowledge writeback: post-mortem chunked and indexed to Qdrant | `apps/api/src/mastra/tools/qdrantUpsert.ts` | — | `incidents.resolved_at` | `post_mortems` | Planned |
| **FR-12** | MTTR regression alert: delta vs 90-day p50 | `apps/api/src/mastra/agents/postMortemAgent.ts` (PostMortemSchema.mttr_regression_alert) | `GET /v1/analytics/mttr` | `incidents` | `historical_incidents` | Planned |
| **FR-13** | Knowledge Freshness Service: proactive conflict detection | `apps/api/src/mastra/workflows/kfsWorkflow.ts` | `GET /v1/knowledge/conflicts` | — | `runbooks`, `synthesis_drafts` | Planned |
| **FR-14** | Tiered conflict resolution: Conflict Score formula + SynthesisAgent | `apps/api/src/mastra/workflows/kfsWorkflow.ts` | — | — | `synthesis_drafts` | Planned |
| **FR-15** | RBAC: role-based access control (on_call_engineer / incident_commander / sre_lead) | `apps/api/src/middleware/auth.ts` (requireRole) | All `/v1/*` routes | `audit_logs.role` | — | Planned |
| **FR-16** | Idempotent workflow execution (crash-safe) | `apps/api/src/mastra/workflows/incidentWorkflow.ts` (getOrExecuteStep) | — | `workflow_state.idempotency_key` | — | Planned |
| **FR-17** | Rate limiting: 100 req/min per IP via Redis | `apps/api/src/middleware/rateLimiter.ts` | All routes | — | — | Planned |
| **FR-18** | Prompt hash audit trail (SHA-256, no PII in traces) | `apps/api/src/lib/telemetry.ts` (hashPromptForTelemetry) | — | `audit_logs.prompt_hash` | — | Planned |

---

## RBAC Permission Matrix

| Role | FR-1 (Ingest) | FR-4 (Manual Review) | FR-8 (Approve/Reject) | FR-13 (Conflicts) | FR-18 (Audit Logs) |
|:---|:---|:---|:---|:---|:---|
| `on_call_engineer` | ✅ | ✅ Read-only | ❌ | ❌ | ❌ |
| `incident_commander` | ✅ | ✅ Can assign | ✅ Full approval authority | ❌ | Read own |
| `sre_lead` | ✅ | ✅ Full | ✅ Full | ✅ Full curation | ✅ Full |
| `audit_officer` | ❌ | Read-only | Read-only | Read-only | ✅ Full read |

---

## Non-Functional Requirements (NFR) Traceability

| NFR | Requirement | Implementation |
|:---|:---|:---|
| **NFR-1** | Total triage path latency < 30 seconds | Enkrypt timeout=5s, LLM temp=0.1 for fast convergence, Qdrant SLA < 100ms |
| **NFR-2** | Zero PII in observability backends | `gen_ai.prompt.hash` (SHA-256) in OTel spans instead of raw prompts |
| **NFR-3** | Guardrail fail-open: incident response never blocked by Enkrypt outage | Local fallback in `enkryptGuardrail.ts` activates on timeout/error |
| **NFR-4** | Workflow crash safety: no duplicate LLM calls on restart | `idempotency_key` = `incidentId:stepName` in `workflow_state` table |
| **NFR-5** | OWASP API Security Top 10 compliance | Helmet.js, JWT auth, rate limiting, input validation via Zod, no secrets in logs |
| **NFR-6** | 12-Factor App principles | Config via env vars, stateless API processes, backing services via URLs |
