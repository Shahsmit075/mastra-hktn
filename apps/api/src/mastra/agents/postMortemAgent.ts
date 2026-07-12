import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { primaryModel } from '../models.js';
import { qdrantSearchTool } from '../tools/qdrantSearch.js';
import { qdrantUpsertTool } from '../tools/qdrantUpsert.js';

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
  id: 'postMortemAgent',
  name: 'PostMortemAgent',
  instructions: POST_MORTEM_SYSTEM_PROMPT,
  model: primaryModel,
  tools: {
    qdrantSearch: qdrantSearchTool,
    qdrantUpsert: qdrantUpsertTool,
  },
});
