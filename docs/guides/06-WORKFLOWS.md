# Guide 06 — Mastra Workflow: incidentWorkflow

## File: `apps/api/src/mastra/workflows/incidentWorkflow.ts`

This is the most critical file in the system. Every incident flows through this workflow.

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { mastra } from '../index';
import { TriageSchema } from '../agents/triageAgent';
import { RemediationSchema } from '../agents/remediationAgent';
import { PostMortemSchema } from '../agents/postMortemAgent';
import { enkryptInputGuardrailTool, enkryptOutputGuardrailTool } from '../tools/enkryptGuardrail';
import { qdrantSearchTool } from '../tools/qdrantSearch';
import { qdrantUpsertTool } from '../tools/qdrantUpsert';
import { pool } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

// ─── Shared Idempotency Helper ─────────────────────────────────────────────────

async function getOrExecuteStep<T>(
  incidentId: string,
  stepName: string,
  traceparent: string | null,
  executor: () => Promise<T>
): Promise<T> {
  const idempotencyKey = `${incidentId}:${stepName}`;

  // Check if this step was already completed (crash recovery)
  const existing = await pool.query(
    `SELECT result_json FROM workflow_state 
     WHERE idempotency_key = $1 AND status = 'completed'`,
    [idempotencyKey]
  );

  if (existing.rows.length > 0) {
    console.log(`[idempotent] Step ${stepName} already completed, using cached result`);
    return existing.rows[0].result_json as T;
  }

  // Mark step as running
  await pool.query(
    `INSERT INTO workflow_state (incident_id, step_name, status, idempotency_key, traceparent)
     VALUES ($1, $2, 'running', $3, $4)
     ON CONFLICT (idempotency_key) DO UPDATE SET status = 'running', updated_at = NOW()`,
    [incidentId, stepName, idempotencyKey, traceparent]
  );

  // Execute the step
  const result = await executor();

  // Persist result
  await pool.query(
    `UPDATE workflow_state 
     SET status = 'completed', result_json = $1, updated_at = NOW()
     WHERE idempotency_key = $2`,
    [JSON.stringify(result), idempotencyKey]
  );

  return result;
}

// ─── Step Definitions ──────────────────────────────────────────────────────────

// Step 1: sanitize — Enkrypt AI input guardrail
const sanitizeStep = createStep({
  id: 'sanitize',
  inputSchema: z.object({
    rawPayload: z.string(),
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  outputSchema: z.object({
    cleanedPayload: z.string(),
    promptHash: z.string(),
    blocked: z.boolean(),
    blockReason: z.string().optional(),
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const { rawPayload, incidentId, correlationId, traceparent } = inputData;

    const result = await getOrExecuteStep(incidentId, 'sanitize', traceparent, async () => {
      const guardrailResult = await enkryptInputGuardrailTool.execute!({
        context: { text: rawPayload },
        runId: incidentId,
        mastra,
        agents: {},
        workflows: {},
      });

      return {
        cleanedPayload: guardrailResult.cleanedText,
        promptHash: guardrailResult.promptHash,
        blocked: guardrailResult.blocked,
        blockReason: guardrailResult.blockReason,
      };
    });

    if (result.blocked) {
      // Update incident status and halt
      await pool.query(
        `UPDATE incidents SET status = 'failed' WHERE id = $1`,
        [incidentId]
      );
    }

    return { ...result, incidentId, correlationId, traceparent };
  },
});

// Step 2: triage — TriageAgent runs
const triageStep = createStep({
  id: 'triage',
  inputSchema: z.object({
    cleanedPayload: z.string(),
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
    promptHash: z.string(),
  }),
  outputSchema: z.object({
    triageResult: TriageSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const { cleanedPayload, incidentId, correlationId, traceparent, promptHash } = inputData;

    const triageResult = await getOrExecuteStep(incidentId, 'triage', traceparent, async () => {
      const triageAgent = mastra.getAgent('triageAgent');

      // First search for similar historical incidents
      const searchResults = await qdrantSearchTool.execute!({
        context: {
          query: cleanedPayload,
          collections: ['historical_incidents', 'runbooks'],
          topK: 5,
        },
        runId: incidentId,
        mastra, agents: {}, workflows: {},
      });

      const contextText = searchResults.results
        .map(r => `[${r.collection}] ${JSON.stringify(r.payload)}`)
        .join('\n\n');

      const prompt = `
Incident Alert (cleaned by Enkrypt AI, prompt_hash: ${promptHash}):
${cleanedPayload}

Retrieved Historical Context (from Qdrant):
${contextText}

Incident ID to assign: ${incidentId}
Correlation ID: ${correlationId}

Produce a triage assessment as a JSON object matching TriageSchema.
      `.trim();

      const response = await triageAgent.generate(prompt, {
        output: TriageSchema,
      });

      // Write to audit log
      await pool.query(
        `INSERT INTO audit_logs (incident_id, action, prompt_hash, payload)
         VALUES ($1, 'triage_completed', $2, $3)`,
        [incidentId, promptHash, JSON.stringify(response.object)]
      );

      return response.object as z.infer<typeof TriageSchema>;
    });

    // Update incident severity in DB
    await pool.query(
      `UPDATE incidents SET severity = $1, status = 'triaging' WHERE id = $2`,
      [triageResult.severity, incidentId]
    );

    return { triageResult, incidentId, correlationId, traceparent };
  },
});

// Step 3: confidence_gate — branch based on confidence score
const confidenceGateStep = createStep({
  id: 'confidence_gate',
  inputSchema: z.object({
    triageResult: TriageSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  outputSchema: z.object({
    passed: z.boolean(),
    triageResult: TriageSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const { triageResult, incidentId, correlationId, traceparent } = inputData;
    const passed = triageResult.confidence_score >= 0.85;

    if (!passed) {
      await pool.query(
        `UPDATE incidents SET status = 'awaiting_manual_review' WHERE id = $1`,
        [incidentId]
      );
      console.log(`[confidence_gate] Confidence ${triageResult.confidence_score} < 0.85 — routing to manual review`);
    }

    return { passed, triageResult, incidentId, correlationId, traceparent };
  },
});

// Step 4: retrieval — Qdrant hybrid search for remediation context
const retrievalStep = createStep({
  id: 'retrieval',
  inputSchema: z.object({
    triageResult: TriageSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  outputSchema: z.object({
    retrievedContext: z.array(z.object({
      id: z.string(),
      score: z.number(),
      collection: z.string(),
      payload: z.record(z.unknown()),
    })),
    contextRefs: z.array(z.string()),
    triageResult: TriageSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const { triageResult, incidentId, correlationId, traceparent } = inputData;

    const searchResults = await getOrExecuteStep(incidentId, 'retrieval', traceparent, async () => {
      const query = `${triageResult.affected_service} ${triageResult.severity} incident`;
      return qdrantSearchTool.execute!({
        context: {
          query,
          collections: ['runbooks', 'historical_incidents', 'post_mortems'],
          topK: 8,
          serviceId: triageResult.affected_service,
          trustScoreMin: 0.5,
        },
        runId: incidentId,
        mastra, agents: {}, workflows: {},
      });
    });

    const contextRefs = searchResults.results.map(r => r.id);

    return {
      retrievedContext: searchResults.results,
      contextRefs,
      triageResult,
      incidentId,
      correlationId,
      traceparent,
    };
  },
});

// Step 5: remediation — RemediationAgent generates plan
const remediationStep = createStep({
  id: 'remediation',
  inputSchema: z.object({
    retrievedContext: z.array(z.object({ id: z.string(), score: z.number(), collection: z.string(), payload: z.record(z.unknown()) })),
    contextRefs: z.array(z.string()),
    triageResult: TriageSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  outputSchema: z.object({
    remediationPlan: RemediationSchema,
    contextRefs: z.array(z.string()),
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
    enkryptPassed: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { retrievedContext, contextRefs, triageResult, incidentId, correlationId, traceparent } = inputData;

    const remediationPlan = await getOrExecuteStep(incidentId, 'remediation', traceparent, async () => {
      const remediationAgent = mastra.getAgent('remediationAgent');

      const contextText = retrievedContext
        .map(r => `[UUID: ${r.id}] [${r.collection}] Score: ${r.score.toFixed(3)}\n${JSON.stringify(r.payload)}`)
        .join('\n\n---\n\n');

      const prompt = `
Triaged Incident:
${JSON.stringify(triageResult, null, 2)}

Retrieved Context from Qdrant (use these UUIDs in evidence_refs):
${contextText}

Plan ID to use: ${uuidv4()}

Generate a remediation plan as JSON matching RemediationSchema.
      `.trim();

      const response = await remediationAgent.generate(prompt, {
        output: RemediationSchema,
      });

      // Enkrypt output validation — check evidence_refs are valid
      const planJson = JSON.stringify(response.object);
      const outputGuardrail = await enkryptOutputGuardrailTool.execute!({
        context: { text: planJson, contextRefs },
        runId: incidentId,
        mastra, agents: {}, workflows: {},
      });

      if (outputGuardrail.blocked) {
        throw new Error(`RemediationAgent output blocked: ${outputGuardrail.blockReason}`);
      }

      return response.object as z.infer<typeof RemediationSchema>;
    });

    await pool.query(
      `UPDATE incidents SET status = 'awaiting_approval' WHERE id = $1`,
      [incidentId]
    );

    return {
      remediationPlan,
      contextRefs,
      incidentId,
      correlationId,
      traceparent,
      enkryptPassed: true,
    };
  },
});

// Step 6: hitl_gate — suspend for IC approval
const hitlGateStep = createStep({
  id: 'hitl_gate',
  inputSchema: z.object({
    remediationPlan: RemediationSchema,
    contextRefs: z.array(z.string()),
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
    enkryptPassed: z.boolean(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    approverId: z.string().optional(),
    remediationPlan: RemediationSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  execute: async ({ inputData, suspend, resumeData }) => {
    const { remediationPlan, incidentId, correlationId, traceparent } = inputData;

    // If we have resume data (IC clicked Approve/Reject), use it
    if (resumeData) {
      const { approved, approverId } = resumeData as { approved: boolean; approverId: string };

      await pool.query(
        `INSERT INTO audit_logs (incident_id, user_id, action, payload)
         VALUES ($1, $2, $3, $4)`,
        [incidentId, approverId, approved ? 'plan_approved' : 'plan_rejected', JSON.stringify({ remediationPlan })]
      );

      await pool.query(
        `UPDATE incidents SET status = $1 WHERE id = $2`,
        [approved ? 'executing' : 'failed', incidentId]
      );

      return { approved, approverId, remediationPlan, incidentId, correlationId, traceparent };
    }

    // First pass: suspend and wait for IC
    // Persist traceparent for OTel continuity across the suspension gap
    await pool.query(
      `UPDATE workflow_state SET status = 'suspended', traceparent = $1
       WHERE incident_id = $2 AND step_name = 'hitl_gate'`,
      [traceparent, incidentId]
    );

    // suspend() halts workflow execution until resume() is called from the API
    await suspend({
      message: 'Awaiting Incident Commander approval',
      remediationPlan,
      incidentId,
    });

    // This line is unreachable on first pass — control returns after resume()
    return { approved: false, remediationPlan, incidentId, correlationId, traceparent };
  },
});

// Step 7: post_mortem — generate blameless report
const postMortemStep = createStep({
  id: 'post_mortem',
  inputSchema: z.object({
    remediationPlan: RemediationSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  outputSchema: z.object({
    postMortem: PostMortemSchema,
    incidentId: z.string().uuid(),
  }),
  execute: async ({ inputData }) => {
    const { remediationPlan, incidentId, correlationId, traceparent } = inputData;

    const postMortem = await getOrExecuteStep(incidentId, 'post_mortem', traceparent, async () => {
      const postMortemAgent = mastra.getAgent('postMortemAgent');

      // Get incident timeline from DB
      const timeline = await pool.query(
        `SELECT action, timestamp, payload FROM audit_logs 
         WHERE incident_id = $1 ORDER BY timestamp ASC`,
        [incidentId]
      );

      // Get incident details
      const incident = await pool.query(
        `SELECT * FROM incidents WHERE id = $1`,
        [incidentId]
      );

      // Get 90-day p50 MTTR for this service
      const mttrData = await pool.query(
        `SELECT AVG(mttr_minutes) as avg_mttr
         FROM incidents 
         WHERE service_id = $1 
         AND resolved_at > NOW() - INTERVAL '90 days'
         AND status = 'resolved'`,
        [incident.rows[0]?.service_id]
      );

      const prompt = `
Generate a blameless post-mortem for the following incident.

Incident Details:
${JSON.stringify(incident.rows[0], null, 2)}

Remediation Plan Executed:
${JSON.stringify(remediationPlan, null, 2)}

Audit Timeline:
${JSON.stringify(timeline.rows, null, 2)}

90-day p50 MTTR for this service: ${mttrData.rows[0]?.avg_mttr || 'No historical data'} minutes

Generate a post-mortem as JSON matching PostMortemSchema.
      `.trim();

      const response = await postMortemAgent.generate(prompt, {
        output: PostMortemSchema,
      });

      return response.object as z.infer<typeof PostMortemSchema>;
    });

    return { postMortem, incidentId };
  },
});

// Step 8: writeback — upsert post-mortem to Qdrant
const writebackStep = createStep({
  id: 'writeback',
  inputSchema: z.object({
    postMortem: PostMortemSchema,
    incidentId: z.string().uuid(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    incidentId: z.string().uuid(),
    mttrRegressionAlert: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { postMortem, incidentId } = inputData;

    // Upsert to Qdrant
    await qdrantUpsertTool.execute!({
      context: {
        collection: 'post_mortems',
        content: JSON.stringify(postMortem),
        metadata: {
          incident_id: postMortem.incident_id,
          affected_service: postMortem.affected_service,
          severity: postMortem.severity,
          mttr: postMortem.mttr_minutes,
          mttr_delta: postMortem.mttr_delta_minutes,
          root_cause_category: postMortem.contributing_factors.system[0] || 'Unknown',
        },
        sourceId: postMortem.incident_id,
      },
      runId: incidentId,
      mastra, agents: {}, workflows: {},
    });

    // Update incident as resolved
    await pool.query(
      `UPDATE incidents 
       SET status = 'resolved', resolved_at = NOW(), mttr_minutes = $1
       WHERE id = $2`,
      [postMortem.mttr_minutes, incidentId]
    );

    return {
      success: true,
      incidentId,
      mttrRegressionAlert: postMortem.mttr_regression_alert,
    };
  },
});

// ─── Workflow Assembly ─────────────────────────────────────────────────────────

export const incidentWorkflow = createWorkflow({
  id: 'incident-response',
  inputSchema: z.object({
    rawPayload: z.string(),
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable().default(null),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    incidentId: z.string().uuid(),
    finalStatus: z.string(),
  }),
})
  .then(sanitizeStep)
  .branch([
    // Branch A: Blocked by Enkrypt — stop
    [({ inputData }) => inputData.blocked === true, 
     createStep({
       id: 'blocked-halt',
       inputSchema: z.any(),
       outputSchema: z.object({ success: z.boolean(), incidentId: z.string(), finalStatus: z.string() }),
       execute: async ({ inputData }) => ({
         success: false,
         incidentId: inputData.incidentId,
         finalStatus: 'blocked_by_guardrail',
       }),
     })
    ],
    // Branch B: Safe — continue to triage
    [({ inputData }) => !inputData.blocked,
     createStep({
       id: 'pass-through',
       inputSchema: z.any(),
       outputSchema: z.any(),
       execute: async ({ inputData }) => inputData,
     })
    ],
  ])
  .then(triageStep)
  .then(confidenceGateStep)
  .branch([
    // Low confidence — suspend for manual review
    [({ inputData }) => !inputData.passed,
     createStep({
       id: 'manual-review-halt',
       inputSchema: z.any(),
       outputSchema: z.object({ success: z.boolean(), incidentId: z.string(), finalStatus: z.string() }),
       execute: async ({ inputData }) => ({
         success: true,
         incidentId: inputData.incidentId,
         finalStatus: 'awaiting_manual_review',
       }),
     })
    ],
    // High confidence — proceed to retrieval
    [({ inputData }) => inputData.passed,
     createStep({
       id: 'confidence-pass',
       inputSchema: z.any(),
       outputSchema: z.any(),
       execute: async ({ inputData }) => inputData,
     })
    ],
  ])
  .then(retrievalStep)
  .then(remediationStep)
  .then(hitlGateStep)
  .branch([
    // IC rejected — stop
    [({ inputData }) => !inputData.approved,
     createStep({
       id: 'rejected-halt',
       inputSchema: z.any(),
       outputSchema: z.object({ success: z.boolean(), incidentId: z.string(), finalStatus: z.string() }),
       execute: async ({ inputData }) => ({
         success: false,
         incidentId: inputData.incidentId,
         finalStatus: 'rejected_by_ic',
       }),
     })
    ],
    // IC approved — continue to post-mortem
    [({ inputData }) => inputData.approved,
     createStep({
       id: 'approved-pass',
       inputSchema: z.any(),
       outputSchema: z.any(),
       execute: async ({ inputData }) => inputData,
     })
    ],
  ])
  .then(postMortemStep)
  .then(writebackStep)
  .commit();
```

## How to Resume a Suspended Workflow (from the API)

When an IC clicks "Approve" on the HITL Dashboard:

```typescript
// In apps/api/src/routes/approve.ts
import { mastra } from '../mastra/index';

const run = await mastra.getWorkflow('incident-response').getRunById(runId);
if (!run) throw new Error('Workflow run not found');

await run.resume({
  step: 'hitl_gate',
  resumeData: {
    approved: true,
    approverId: req.user.id, // from JWT
  },
});
```
