import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { primaryModel } from '../models.js';

// ─── Output Schema ─────────────────────────────────────────────────────────────

export const SynthesisSchema = z.object({
  conflict_detected: z.boolean().describe(
    'True if the post-mortem explicitly contradicts instructions or assumptions in the older runbook.'
  ),
  conflict_description: z.string().describe(
    'Briefly describe what changed. E.g., "Replica count scaled to 10 instead of 5" or "N/A"'
  ),
  unified_runbook_draft: z.string().describe(
    'A fully rewritten markdown draft of the new runbook incorporating the post-mortem lessons.'
  ),
  confidence_score: z.number().min(0).max(1).describe(
    'Confidence level in the accuracy of the synthesis (0.0 to 1.0)'
  ),
  human_review_required: z.boolean().describe(
    'True if the changes are highly destructive or complex, necessitating Staff SRE review before replacing the old runbook.'
  )
});

export type SynthesisOutput = z.infer<typeof SynthesisSchema>;

// ─── System Prompt ─────────────────────────────────────────────────────────────

const SYNTHESIS_SYSTEM_PROMPT = `
[CONTEXT]
You are the SynthesisAgent (The Knowledge Gardener) for Runbook Sentinel. 
You run asynchronously in the background. Your job is to pull a newly completed 
incident Post-Mortem and compare it against the original Runbook that was used 
during the incident.

[ROLE]
You act as a Staff SRE maintaining the "Knowledge Freshness" of the system. 
Runbooks naturally drift as infrastructure evolves. When a team resolves an incident 
and writes a post-mortem, they often discover that the old runbook was out-of-date 
(e.g., they had to increase a connection pool to 40 instead of 20).

[INSTRUCTION]
1. Read the provided [OLD_RUNBOOK] and [NEW_POST_MORTEM].
2. Detect if there are any conflicts or new learnings in the post-mortem that render 
   parts of the old runbook obsolete.
3. If a conflict is detected, set conflict_detected to true and describe it.
4. Rewrite the old runbook into a highly structured, markdown unified_runbook_draft.
   - Retain the solid structural integrity and safe commands of the old runbook.
   - Inject the new empirical findings, updated limits, or new commands from the post-mortem.
5. If the updates are massive or high-risk, set human_review_required to true.

[SPECIFICS]
Output must be strict JSON matching the SynthesisSchema.
The unified_runbook_draft should be ready to be merged directly into the vector database 
once approved by an Incident Commander.
`.trim();

// ─── Agent Definition ─────────────────────────────────────────────────────────

export const synthesisAgent = new Agent({
  id: 'synthesisAgent',
  name: 'Synthesis Agent',
  instructions: SYNTHESIS_SYSTEM_PROMPT,
  model: primaryModel,
});
