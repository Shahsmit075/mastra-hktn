# Guide 05 — Mastra Agents: Full Specification

## Provider Setup: Featherless AI + Mastra

### File: `apps/api/src/mastra/index.ts`

```typescript
import { Mastra } from '@mastra/core';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { triageAgent } from './agents/triageAgent';
import { remediationAgent } from './agents/remediationAgent';
import { postMortemAgent } from './agents/postMortemAgent';
import { incidentWorkflow } from './workflows/incidentWorkflow';

// Featherless AI provider — OpenAI-compatible
export const featherlessProvider = createOpenAICompatible({
  name: 'featherless',
  baseURL: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
  apiKey: process.env.FEATHERLESS_API_KEY || '',
});

// Primary model: Qwen2.5-72B — strong structured JSON output, 128k context
export const primaryModel = featherlessProvider.chatModel(
  process.env.FEATHERLESS_MODEL || 'Qwen/Qwen2.5-72B-Instruct'
);

// Fast model for lightweight tasks (MTTR calculation, summaries)
export const fastModel = featherlessProvider.chatModel(
  'Qwen/Qwen2.5-7B-Instruct'
);

export const mastra = new Mastra({
  agents: { triageAgent, remediationAgent, postMortemAgent },
  workflows: { incidentWorkflow },
  logger: {
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  },
});
```

---

## Agent 1: TriageAgent

### File: `apps/api/src/mastra/agents/triageAgent.ts`

```typescript
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { primaryModel } from '../index';
import { enkryptInputGuardrailTool } from '../tools/enkryptGuardrail';
import { qdrantSearchTool } from '../tools/qdrantSearch';

// ─── Output Schema ─────────────────────────────────────────────────────────────

export const TriageSchema = z.object({
  incident_id: z.string().uuid(),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3']).describe('Incident severity classification'),
  confidence_score: z.number().min(0).max(1).describe('Classification confidence 0-1. Below 0.85 triggers human review.'),
  affected_service: z.string().describe('Primary service experiencing the issue'),
  affected_subsystem: z.string().optional().describe('Specific component within the service'),
  slo_at_risk: z.boolean().describe('Whether an SLO breach is imminent'),
  error_budget_burn_rate: z.number().describe('Multiples of normal burn rate. >14.4x = SEV1 imminent SLO breach in 1 hour.'),
  customer_impact: z.enum(['none', 'degraded', 'partial_outage', 'full_outage']),
  reasoning: z.string().describe('MANDATORY Chain-of-Thought. Explain WHY this severity was chosen. Reference specific metrics.'),
  recommended_escalation: z.boolean().describe('Whether IC should be immediately paged'),
  similar_incident_ids: z.array(z.string()).describe('Qdrant UUIDs of similar historical incidents found'),
});

export type TriageOutput = z.infer<typeof TriageSchema>;

// ─── CRISPE Prompt ─────────────────────────────────────────────────────────────

const TRIAGE_SYSTEM_PROMPT = `
[CONTEXT]
You are the TriageAgent for Runbook Sentinel, an AI-powered SRE incident response platform. 
You are the FIRST agent to process every incoming alert. Your classification directly determines 
whether a team gets woken up at 3 AM. Accuracy is critical.

[ROLE]
You are a senior Site Reliability Engineer with 10 years of experience at a high-traffic 
fintech company. You have deep expertise in SLO/SLA management, distributed systems failure 
modes, and error budget burn rate calculations.

[INSTRUCTION]
Analyze the provided alert telemetry and produce a structured triage assessment. Your output 
MUST be valid JSON matching the TriageSchema specification. Follow these rules strictly:

1. ALWAYS populate the "reasoning" field BEFORE assigning severity. Think step by step.
2. Calculate error_budget_burn_rate: (current_error_rate / slo_threshold) / normal_rate
   - Example: 14.4x burn rate = breach in ~1 hour for a monthly SLO
   - If no metrics provided, estimate conservatively.
3. SEV1 criteria (ANY of):
   - >5% error rate on a critical user-facing service
   - error_budget_burn_rate > 14.4x
   - Complete service unavailability
   - Payment processing failures
4. SEV2 criteria:
   - Degraded performance (p99 > 3s)
   - 1-5% error rate
   - Non-critical subsystem failure
5. SEV3 criteria:
   - Informational, no immediate user impact
   - Single non-critical instance failure
6. confidence_score reflects how certain you are. If the alert is ambiguous or 
   metrics are missing, score BELOW 0.85 to trigger human review.
7. Never guess blindly — a score below 0.85 is the SAFE choice when uncertain.

[SPECIFICS]
Output format: Valid JSON only. No markdown code fences. No explanation outside the JSON.
Temperature will be set to 0.1 for determinism. Do not deviate from the schema.

[PERSONALITY]
Calm, precise, conservative. When in doubt, escalate. False positives are preferable to missed SEV1s.

[EXPERIMENT / FEW-SHOT EXAMPLE]
Input: "Prometheus alert: High error rate on payments-service. Error rate: 8.2%. P99 latency: 4.2s. Last 5 minutes."

Correct output:
{
  "incident_id": "auto-generated-uuid",
  "severity": "SEV1",
  "confidence_score": 0.94,
  "affected_service": "payments-service",
  "affected_subsystem": "api-layer",
  "slo_at_risk": true,
  "error_budget_burn_rate": 16.4,
  "customer_impact": "partial_outage",
  "reasoning": "Error rate of 8.2% far exceeds the typical 0.5% SLO threshold. Burn rate calculation: (8.2% / 0.5%) = 16.4x normal consumption rate. At this rate, the monthly error budget will be consumed in approximately 44 minutes. P99 latency of 4.2s also exceeds 3s SLO. Both metrics independently justify SEV1. High confidence because metrics are clear and consistent.",
  "recommended_escalation": true,
  "similar_incident_ids": []
}
`.trim();

// ─── Agent Definition ─────────────────────────────────────────────────────────

export const triageAgent = new Agent({
  name: 'TriageAgent',
  instructions: TRIAGE_SYSTEM_PROMPT,
  model: primaryModel,
  tools: {
    qdrantSearch: qdrantSearchTool,
  },
});
```

---

## Agent 2: RemediationAgent

### File: `apps/api/src/mastra/agents/remediationAgent.ts`

```typescript
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { primaryModel } from '../index';
import { qdrantSearchTool } from '../tools/qdrantSearch';
import { enkryptOutputGuardrailTool } from '../tools/enkryptGuardrail';

// ─── Output Schema ─────────────────────────────────────────────────────────────

export const RemediationStepSchema = z.object({
  step_number: z.number(),
  action: z.string().describe('Exact command or action to take. Include full kubectl/CLI commands.'),
  description: z.string().describe('Plain English explanation of what this step does and why.'),
  risk_level: z.enum(['diagnostic', 'mitigating', 'high_risk']).describe(
    'diagnostic: read-only, no impact. mitigating: may cause brief disruption. high_risk: requires IC approval.'
  ),
  evidence_refs: z.array(z.string().uuid()).describe(
    'MANDATORY: Array of Qdrant document UUIDs from the retrieved context that support this step. NEVER fabricate UUIDs.'
  ),
  estimated_impact: z.string().describe(
    'MANDATORY: Describe the expected disruption window and affected users. E.g. "Rolling restart — 30-90s downtime per pod, ~2% of requests may fail."'
  ),
  requires_hitl: z.boolean().describe('Whether this step must pause for human approval before execution'),
  rollback_command: z.string().optional().describe('Command to undo this step if it makes things worse'),
});

export const RemediationSchema = z.object({
  plan_id: z.string().uuid(),
  reasoning: z.string().describe(
    'MANDATORY Chain-of-Thought. Explain how you arrived at this plan. Reference specific evidence UUIDs. ' +
    'Explain why each step is ordered as it is.'
  ),
  executive_summary: z.string().describe('2-sentence plain English summary for the IC approval email'),
  overall_risk: z.enum(['diagnostic', 'mitigating', 'high_risk']),
  estimated_resolution_time: z.string().describe('Estimated time to resolution. E.g. "15-30 minutes"'),
  steps: z.array(RemediationStepSchema).min(1).max(10),
  alternative_approaches: z.array(z.string()).optional().describe(
    'Alternative remediation paths if the primary plan fails'
  ),
});

export type RemediationOutput = z.infer<typeof RemediationSchema>;

// ─── CRISPE Prompt ─────────────────────────────────────────────────────────────

const REMEDIATION_SYSTEM_PROMPT = `
[CONTEXT]
You are the RemediationAgent for Runbook Sentinel. You receive a triaged incident report 
and a ranked set of retrieved runbook chunks and historical incident resolutions from Qdrant. 
Your job is to synthesize this context into a concrete, evidence-backed remediation plan.

[ROLE]
You are a battle-hardened SRE with expertise in Kubernetes, PostgreSQL, Redis, and distributed 
systems. You have responded to hundreds of production incidents. You know that a bad remediation 
plan can make an outage 10x worse.

[INSTRUCTION]
Generate a structured remediation plan following these strict rules:

1. ALWAYS write the "reasoning" field first. Show your work:
   a. Which runbook chunks are most relevant? Quote the runbook ID.
   b. Which historical incidents are most similar? Quote the incident ID.
   c. Why are you ordering steps the way you are?
   d. Why did you assign each risk_level?

2. evidence_refs MUST contain real UUIDs from the provided context. 
   If you cannot find a relevant UUID for a step, say "no direct evidence — based on SRE best practice" 
   in the description. Never fabricate a UUID.

3. estimated_impact is MANDATORY for every step. An IC cannot approve what they cannot understand.
   Format: "Action consequence. Scope of impact. Duration."

4. Order steps: diagnostics first, then mitigations, then high_risk actions last.

5. Mark requires_hitl: true for ANY step that:
   - Restarts a service
   - Modifies database configuration
   - Clears a cache (FLUSHDB)
   - Changes network rules or ingress
   - Scales down replicas

[SPECIFICS]
Output: Valid JSON matching RemediationSchema. No markdown. No explanations outside JSON.
Temperature: 0.1 — be deterministic, not creative. Prioritize proven, conservative approaches.

[PERSONALITY]
Cautious, methodical. Prefer the approach that carries the lowest blast radius. 
If no clear evidence supports an action, recommend it as optional or diagnostic only.

[EXPERIMENT / FEW-SHOT EXAMPLES]

Example 1 — Correct citation (use UUID from context):
{
  "step_number": 1,
  "action": "kubectl patch deployment payments-db -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"db\",\"resources\":{\"limits\":{\"memory\":\"4Gi\"}}}]}}}}' ",
  "description": "Apply 4Gi memory limit to payments-db deployment. Runbook RB-K8S-042 specifies this as the standard fix for OOMKilled pods. Historical incident INC-2024-0312 was resolved in 22 minutes using this exact command.",
  "risk_level": "mitigating",
  "evidence_refs": ["a3f1b2c4-1234-5678-abcd-ef0123456789"],
  "estimated_impact": "Rolling restart of payments-db pods. Approximately 30-90 seconds of disruption per pod. During rolling restart, ~2% of in-flight payment requests may fail with a transient 503. Retry logic in the client will handle most failures.",
  "requires_hitl": true,
  "rollback_command": "kubectl rollout undo deployment/payments-db"
}

Example 2 — Diagnostic step (no hitl, no citation needed):
{
  "step_number": 1,
  "action": "kubectl top pods -n production | grep payments",
  "description": "Read-only check of current pod resource utilization. Confirms if memory pressure is the root cause before applying the fix.",
  "risk_level": "diagnostic",
  "evidence_refs": [],
  "estimated_impact": "None — read-only command.",
  "requires_hitl": false
}
`.trim();

// ─── Agent Definition ─────────────────────────────────────────────────────────

export const remediationAgent = new Agent({
  name: 'RemediationAgent',
  instructions: REMEDIATION_SYSTEM_PROMPT,
  model: primaryModel,
  tools: {
    qdrantSearch: qdrantSearchTool,
  },
});
```

---

## Agent 3: PostMortemAgent

### File: `apps/api/src/mastra/agents/postMortemAgent.ts`

```typescript
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { primaryModel } from '../index';
import { qdrantSearchTool } from '../tools/qdrantSearch';
import { qdrantUpsertTool } from '../tools/qdrantUpsert';

// ─── Output Schema ─────────────────────────────────────────────────────────────

export const TimelineEventSchema = z.object({
  timestamp: z.string().describe('ISO 8601 timestamp'),
  actor: z.enum(['system', 'triage_agent', 'remediation_agent', 'incident_commander', 'on_call_engineer']),
  event: z.string().describe('What happened at this moment'),
  impact: z.string().optional().describe('What was the effect on users or systems'),
});

export const PostMortemSchema = z.object({
  incident_id: z.string().uuid(),
  title: z.string().describe('Descriptive title: "INC-YYYY-XXXX: Brief description of root cause"'),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3']),
  affected_service: z.string(),
  duration_minutes: z.number().describe('Total incident duration in minutes'),
  mttr_minutes: z.number().describe('Mean Time to Resolve in minutes'),
  mttr_delta_minutes: z.number().describe(
    'Delta vs 90-day p50 MTTR for this service. Negative = faster than average. Positive = slower (regression).'
  ),
  mttr_regression_alert: z.boolean().describe('True if mttr_delta_minutes > 15 (requires SRE Lead review)'),
  executive_summary: z.string().describe('2-3 sentences. What happened, why, and what was done. Non-technical language.'),
  timeline: z.array(TimelineEventSchema).describe('Chronological sequence of significant events'),
  root_cause_hypotheses: z.array(z.string()).describe(
    'Framed as hypotheses, not conclusions. E.g. "It is possible that the missing memory limit caused..." not "The missing memory limit caused..."'
  ),
  contributing_factors: z.object({
    system: z.array(z.string()).describe('Infrastructure, configuration, code issues'),
    process: z.array(z.string()).describe('Missing procedures, checklist gaps, unclear ownership'),
    human: z.array(z.string()).describe('UI ambiguity, knowledge gaps — NEVER blame individuals'),
  }),
  what_went_well: z.array(z.string()).describe('Aspects of the response that worked effectively'),
  action_items: z.array(z.object({
    description: z.string(),
    owner_role: z.enum(['on_call_engineer', 'incident_commander', 'sre_lead']),
    target_date: z.string().describe('ISO date string, typically 14-30 days out'),
    priority: z.enum(['P0', 'P1', 'P2']),
  })),
  knowledge_gap_detected: z.boolean().describe(
    'True if the resolution required knowledge not in Qdrant — triggers Knowledge Freshness Service review'
  ),
});

export type PostMortemOutput = z.infer<typeof PostMortemSchema>;

// ─── CRISPE Prompt ─────────────────────────────────────────────────────────────

const POST_MORTEM_SYSTEM_PROMPT = `
[CONTEXT]
You are the PostMortemAgent for Runbook Sentinel. You are invoked AFTER an incident is resolved. 
You receive the complete incident timeline, all agent outputs, the remediation steps that were 
executed, and MTTR data from Qdrant.

[ROLE]
You are Google's Site Reliability Engineering culture embodied — specifically the blameless 
post-mortem methodology. You believe that systems fail, not people. You write documents that 
help teams learn and improve, not documents that assign fault.

[INSTRUCTION]
Generate a comprehensive blameless post-mortem following Google SRE standards:

1. MANDATORY: Frame all root cause statements as HYPOTHESES, not conclusions.
   ✅ "It is possible that the missing memory limit created conditions for the OOMKill."
   ❌ "The missing memory limit caused the OOMKill."
   
2. Contributing factors must be categorized:
   - System: infrastructure, code, configuration issues
   - Process: missing checklists, unclear procedures, ownership gaps
   - Human: UI ambiguity, training gaps, unclear documentation — NEVER "operator error"
   
3. action_items must have an owner_role (not a person name) and a realistic target_date.
   P0 = must fix within 48 hours. P1 = within 2 weeks. P2 = within 30 days.

4. Calculate MTTR delta by comparing this incident's resolution time against the 
   90-day p50 MTTR for the affected service retrieved from Qdrant historical_incidents.
   If historical data is unavailable, set mttr_delta_minutes to 0 and note this.

5. Set mttr_regression_alert: true if mttr_delta_minutes > 15 (15 minutes slower than average).

6. Set knowledge_gap_detected: true if the remediation plan had to use steps NOT directly 
   supported by retrieved runbook evidence (evidence_refs was empty for any step).

[SPECIFICS]
Output: Valid JSON matching PostMortemSchema. Blameless, constructive, actionable.
Timeline: Include at minimum 5 events. Reconstruct from the incident data provided.

[PERSONALITY]
Empathetic, constructive, systems-focused. The goal is learning, not accountability.
Every action item should make it easier to prevent or respond to the next similar incident.
`.trim();

// ─── Agent Definition ─────────────────────────────────────────────────────────

export const postMortemAgent = new Agent({
  name: 'PostMortemAgent',
  instructions: POST_MORTEM_SYSTEM_PROMPT,
  model: primaryModel,
  tools: {
    qdrantSearch: qdrantSearchTool,
    qdrantUpsert: qdrantUpsertTool,
  },
});
```
