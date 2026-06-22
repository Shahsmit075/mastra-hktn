# Runbook Sentinel PRD

## Overview
Runbook Sentinel is an incident response and post-mortem agent built for the HiDevs x Mastra hackathon. It helps on-call engineers triage alerts, retrieve relevant institutional knowledge, generate evidence-backed remediation plans, and produce blameless post-mortems. The product is designed around the mandatory stack:

- `Mastra` orchestrates multi-step agent workflows, tool use, branching logic, and human approval gates.
- `Qdrant` stores long-term operational memory, historical incidents, runbooks, and semantic log patterns.
- `Enkrypt AI` evaluates both inbound and outbound content before any recommendation reaches an engineer.

The goal is not to build a chatbot. The goal is to build an agent system that can think, retrieve, remember, evaluate, and act during real incident workflows.

## Problem Statement
Incident response remains fragmented across dashboards, chat threads, notes, and runbook documents. During active incidents, engineers waste time reconstructing context instead of resolving customer impact. Critical lessons from previous incidents are often buried in documents that are impossible to find under pressure. After the incident ends, post-mortems are delayed, incomplete, and inconsistent because the timeline and rationale were never captured cleanly.

These gaps create four recurring failures:

1. Slow triage because engineers do not have immediate context on severity, blast radius, or historical parallels.
2. Repeated mistakes because prior incidents and runbooks are not retrieved at the moment they matter.
3. Unsafe AI usage because generic assistants can hallucinate remediation steps or expose sensitive operational data.
4. Weak organizational memory because incident knowledge is not captured and reused as a structured system.

Runbook Sentinel addresses these failures by combining workflow orchestration, semantic retrieval, persistent memory, and safety evaluation into one production-oriented incident copilot.

## Target Users
### Primary User: On-Call Engineer
- Receives alerts and needs fast guidance within the first few minutes of an incident.
- Wants retrieval of similar incidents, known fixes, and service-specific runbooks.
- Needs confidence that suggestions are grounded and safe.

### Secondary User: Incident Commander
- Needs a clear operating picture during SEV1 and SEV2 incidents.
- Wants timelines, proposed next steps, and explicit approval checkpoints for risky actions.
- Needs a consistent handoff from active incident management into post-mortem writing.

### Buyer Persona: SRE / Platform Team
- Wants institutional memory that compounds over time.
- Needs auditable workflows, safer AI outputs, and measurable incident-response improvements.
- Values a system that can fit into existing operations tools instead of replacing them.

## Product Vision
Runbook Sentinel becomes the memory and decision-support layer for incident response teams. It helps engineers move from alert to evidence-backed action faster, while preserving the safety, traceability, and human control required in production operations.

## Competitive Differentiation
Existing tools address fragments of the incident lifecycle but none combine retrieval-grounded reasoning, institutional memory, and safety evaluation into a single agent architecture:

| Capability | PagerDuty / Opsgenie | Datadog AI Assistant | Generic LLM Copilots | Runbook Sentinel |
|---|---|---|---|---|
| Alert routing & escalation | ✅ Core function | ✅ Core function | ❌ | Integration-ready (non-goal to replace) |
| Semantic search over past incidents | ❌ | ❌ | ❌ | ✅ Qdrant-backed institutional memory |
| Evidence-backed remediation | ❌ | Partial (dashboard Q&A) | Hallucination-prone | ✅ Citation-enforced with Enkrypt validation |
| Cross-incident learning | ❌ | ❌ | ❌ (stateless) | ✅ Writeback loop compounds knowledge |
| Safety evaluation on outputs | ❌ | ❌ | ❌ | ✅ Enkrypt adherence + hallucination gates |
| Multi-step workflow orchestration | ❌ | ❌ | ❌ | ✅ Mastra workflows with HITL |

**The core differentiation**: PagerDuty is a reactive alert router. Datadog AI is a dashboard Q&A tool over current metrics. Generic LLM copilots are stateless and hallucination-prone. Runbook Sentinel is a **learning system** — it compounds institutional memory through Qdrant writeback, enforces output safety through Enkrypt evaluation, and coordinates multi-step reasoning through Mastra orchestration. Each incident makes the next one faster to resolve.

## Goals
### Business Goals
- Demonstrate a production-grade AI agent architecture that uses all mandatory technologies as core infrastructure.
- Show strong hackathon alignment with Mastra orchestration depth, Qdrant retrieval quality, and Enkrypt AI safety coverage.
- Deliver a believable path from Round 1 documentation to a functional hackathon MVP.

### User Goals
- Reduce time to first actionable hypothesis during an incident.
- Surface similar incidents and runbooks without manual searching.
- Require approval before any high-risk remediation guidance is treated as actionable.
- Generate a high-quality post-mortem draft immediately after incident resolution.

### Technical Goals
- Use `Mastra` workflows, conditional routing, tool orchestration, and human-in-the-loop suspension/resume.
- Use `Qdrant` as both retrieval infrastructure and long-term institutional memory.
- Use `Enkrypt AI` on input and output paths to mitigate prompt injection, sensitive data leakage, and ungrounded recommendations.

## Non-Goals
- Fully autonomous execution of production changes.
- Replacing observability or incident management tools such as PagerDuty, Grafana, or Datadog.
- Supporting every class of incident in the first version.
- Serving as a general-purpose chat assistant outside the incident lifecycle.

## Core Product Narrative
When an incident starts, the engineer pastes an alert payload, log sample, or meeting transcript into Runbook Sentinel. The agent classifies the issue, retrieves similar past incidents and relevant runbooks, and proposes a ranked remediation plan backed by retrieved evidence. Before risky actions are surfaced as recommendations, the output is evaluated and, when appropriate, routed through a human approval gate. After the incident ends, the same system compiles an initial timeline, root-cause draft, and action items, then stores the final outcome back into long-term memory for future reuse.

## Key Features
### 1. Alert and Incident Intake
- Accept incident context from pasted logs, alert payloads, text summaries, or uploaded files.
- Normalize inputs into a common incident record.
- Detect suspicious or unsafe input before downstream reasoning begins.

### 2. Triage and Severity Classification
- Identify affected service, likely failure domain, and estimated severity.
- Distinguish between SEV1, SEV2, and lower-priority incidents to branch workflow behavior.
- Produce an initial incident summary suitable for an engineer or incident commander.

### 3. Historical Incident Retrieval
- Search semantically similar past incidents using Qdrant.
- Filter by service, environment, severity, and timeframe.
- Return previous symptoms, fixes, timelines, and post-mortem outcomes.

### 4. Runbook and Knowledge Retrieval
- Retrieve the most relevant runbook sections and supporting knowledge snippets.
- Link recommendations to specific retrieved evidence.
- Prioritize context that matches the active service and failure mode.

### 5. Evidence-Backed Remediation Planning
- Generate ranked remediation options with rationale and confidence.
- Separate low-risk investigative steps from higher-risk recovery actions.
- Require citations to incident memory and runbook retrieval before showing final guidance.

### 6. Human Approval for Risky Actions
- Pause workflow before destructive or high-impact recommendations are approved.
- Let the on-call engineer or incident commander approve, reject, or request regeneration.
- Preserve workflow state across the approval boundary.

### 7. Incident Timeline and Post-Mortem Drafting
- Generate a timeline from alerts, notes, decisions, and action history.
- Draft root cause, customer impact, mitigation, recovery, and follow-up actions.
- Support blameless language and editable collaboration before finalization.

### 8. Institutional Memory Writeback
- Store final incident summaries, post-mortem outcomes, and useful evidence into Qdrant.
- Improve future retrieval quality by preserving new operational knowledge.
- Build compounding organizational memory over time.

## User Journeys
### Journey 1: Active SEV2 Triage
1. An on-call engineer receives an alert for elevated error rates on `checkout-api`.
2. The engineer pastes the alert payload and a short log excerpt into Runbook Sentinel.
3. Enkrypt AI scans the input for prompt injection, secrets, and unsafe content.
4. Mastra runs the `incident-response` workflow and classifies the likely service, severity, and error family.
5. The system retrieves similar incidents, matching runbook sections, and relevant log signatures from Qdrant.
6. The remediation agent proposes a ranked action plan with evidence citations.
7. The engineer follows low-risk diagnostic steps immediately and approves a higher-risk mitigation if needed.
8. The system updates the live incident timeline as actions and observations accumulate.

### Journey 2: SEV1 War Room Support
1. A severe outage triggers a cross-functional war room.
2. Incident commanders paste meeting notes and evolving observations into the system during the incident.
3. The workflow branches into higher-severity behavior, including broader evidence retrieval and stricter approval gates.
4. Runbook Sentinel continuously suggests likely hypotheses, relevant past incidents, and next-step options.
5. Engineers see recommendations only after safety and relevance checks pass.
6. Approved actions and key decisions are appended to the incident timeline automatically.
7. Leadership uses the timeline and summaries for stakeholder updates while responders stay focused on resolution.

### Journey 3: Post-Incident Review
1. The incident is marked resolved.
2. Mastra triggers the `post-mortem-generation` workflow using the incident timeline, retrieved evidence, and final responder notes.
3. The post-mortem agent drafts a blameless retrospective with impact, timeline, contributing factors, root cause hypotheses, and action items.
4. The engineer edits the draft and finalizes the document.
5. The final post-mortem, along with summarized incident facts and outcomes, is written back to Qdrant for future recall.

## MVP Scope
### In Scope for the Hackathon MVP
- Incident creation from pasted text, file upload, or webhook stub
- Triage classification and severity-aware workflow branching
- Qdrant-backed retrieval for incidents, runbooks, logs, and post-mortems
- Evidence-backed remediation draft
- Human approval for risky steps
- Incident timeline view
- Auto-generated post-mortem draft
- Enkrypt AI input and output evaluation gates

### Out of Scope for MVP
- Automatic production remediation execution
- Deep two-way integrations with every incident management vendor
- Real-time log streaming from multiple observability providers
- Multi-tenant enterprise administration features
- Full analytics dashboard beyond core demo metrics

## Functional Requirements
### Incident Intake
- Users can create an incident from text input, uploaded log files, or a webhook payload stub.
- The system stores the incident record with timestamp, service, environment, and status.

### Retrieval
- The system can search semantically similar incidents in Qdrant.
- The system can retrieve relevant runbook sections and log patterns.
- The system supports metadata filtering by service, severity, environment, and recency.

### Guidance Generation
- The system must generate remediation steps with evidence references.
- The system must distinguish between diagnostic, mitigating, and risky actions.
- The system must not surface final recommendations that fail safety or relevance evaluation.

### Approval Flow
- The system pauses on risky steps until a human approves or rejects them.
- The system persists workflow state across pause and resume.

### Post-Mortem
- The system generates a post-mortem draft from incident artifacts.
- The system stores finalized outcomes as future memory.

## Non-Functional Requirements
- Low-latency triage path for the first user-facing response.
- Strong traceability of why a recommendation was produced.
- Auditability of Enkrypt evaluation results and human approvals.
- Modular TypeScript architecture suitable for local development and cloud deployment.
- Production-oriented error handling and observability.

## Success Metrics
### Product Metrics
| Metric | Description | Target |
|---|---|---|
| Time to first actionable hypothesis | Latency from incident intake to first remediation suggestion | P75 < 8 seconds |
| Time to retrieve relevant prior incident | Latency of Qdrant semantic search round-trip | P75 < 3 seconds |
| Post-mortem draft coverage | Percentage of resolved incidents with auto-generated draft within 5 min | ≥ 90% |

### Quality Metrics
| Metric | Description | Target |
|---|---|---|
| Retrieval precision@5 | Relevance of top-5 Qdrant results on seed dataset | ≥ 0.80 |
| Enkrypt first-pass rate | Percentage of outputs passing safety evaluation without regeneration | ≥ 85% |
| Citation coverage | Percentage of remediation steps with non-empty `evidence_refs` | 100% (enforced by output schema) |

### User Metrics
| Metric | Description | Target |
|---|---|---|
| Recommendation usefulness | Engineer-rated usefulness (1–5 scale) | ≥ 3.8 average |
| Post-mortem acceptance rate | Percentage of drafts accepted with minor edits only | ≥ 70% |
| Manual search reduction | Self-reported reduction in manual doc/dashboard searching during incidents | ≥ 50% reduction |

## Risks and Mitigations
### Risk: Hallucinated remediation guidance
Mitigation: Require retrieval-backed citations, use Enkrypt output evaluation, and block or regenerate unsupported responses.

### Risk: Correct hallucination check on poor retrieval
The Enkrypt hallucination detector validates the recommendation against retrieved context, not against ground truth. If the retrieval itself is poor — low precision, wrong service, stale data — the recommendation can pass the hallucination check while still being wrong advice. Mitigation: a precision@5 threshold gate is applied before remediation generation proceeds. If the top-5 retrieval results fall below the 0.80 precision target on confidence scoring, the system flags retrieval quality as degraded, returns a constrained fallback response, and alerts the engineer that manual investigation is recommended. This is why the precision@5 ≥ 0.80 success metric is a hard operational requirement, not an aspiration.

### Risk: Sensitive data leakage in logs
Mitigation: Use Enkrypt input detection for PII and suspicious patterns, redact content before storage or display, and restrict writeback payloads.

### Risk: Over-automation during active incidents
Mitigation: Keep humans in control for risky actions, make destructive guidance approval-only, and position the system as a copilot rather than an executor.

### Risk: Weak retrieval quality on sparse data
Mitigation: Seed realistic incidents and runbooks, use metadata filtering, and keep chunking strategy explicit and domain-aware.

### Risk: Demo looks like generic chat
Mitigation: Center the product around workflows, timeline state, approval checkpoints, and structured outputs instead of conversational UX.

## Assumptions
- Hackathon judges will reward clear, production-minded use of the mandatory stack over breadth of integrations.
- Synthetic or public incident data is acceptable if the architecture and workflow credibility are strong.
- Human-in-the-loop approval is a strength, not a limitation, for this use case.

## Future Expansion
- PagerDuty, Opsgenie, Slack, Grafana, and Datadog integrations
- Live incident collaboration room with streaming updates
- Automated evidence collection tools
- Enkrypt AI red-team validation before deployment
- Team-level reliability analytics and recurring incident pattern detection

## Why This Submission Should Score Well
- `Mastra` is essential because the product depends on branching workflows, tool calls, and pause/resume approval gates.
- `Qdrant` is essential because the product depends on long-term semantic incident memory and retrieval quality.
- `Enkrypt AI` is essential because unsafe or ungrounded incident guidance would make the system unusable in production.

Runbook Sentinel is a strong Round 1 submission because the architecture is feasible, the problem is meaningful, and every required technology is indispensable to the product rather than added for compliance.
