import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { TriageSchema } from '../agents/triageAgent';
import { RemediationSchema } from '../agents/remediationAgent';
import { PostMortemSchema } from '../agents/postMortemAgent';
import { enkryptInputGuardrailTool, enkryptOutputGuardrailTool } from '../tools/enkryptGuardrail';
import { qdrantSearchTool } from '../tools/qdrantSearch';
import { qdrantUpsertTool } from '../tools/qdrantUpsert';
import { pool } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

// ─── JSON Extraction Helper ─────────────────────────────────────────────────────
function extractJSON(text: string): string {
  const trimmed = text.trim();
  // Remove markdown code fences
  const noFence = trimmed.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
  // Find first { and last }
  const start = noFence.indexOf('{');
  const end = noFence.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object found in response: ${trimmed.slice(0, 200)}`);
  return noFence.slice(start, end + 1);
}

// ─── Lazy Mastra Accessor (breaks circular dep: index.ts ↔ incidentWorkflow.ts) ──

let _mastra: any = null;
async function getMastra() {
  if (!_mastra) {
    const mod = await import('../index');
    _mastra = mod.mastra;
  }
  return _mastra;
}

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
        text: rawPayload,
      }, null as any) as any;

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
    cleanedPayload: z.string().optional(),
    incidentId: z.string().uuid().optional(),
    correlationId: z.string().optional(),
    traceparent: z.string().nullable().optional(),
    promptHash: z.string().optional(),
    'pass-through': z.any().optional(),
  }).passthrough(),
  outputSchema: z.object({
    triageResult: TriageSchema,
    incidentId: z.string().uuid(),
    correlationId: z.string(),
    traceparent: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const data = (inputData as any)['pass-through'] || inputData;
    const { cleanedPayload, incidentId, correlationId, traceparent, promptHash } = data;

    const triageResult = await getOrExecuteStep(incidentId, 'triage', traceparent, async () => {
      const mastra = await getMastra();
      const triageAgent = mastra.getAgent('triageAgent');

      // First search for similar historical incidents
      const searchResults = await qdrantSearchTool.execute!({
        query: cleanedPayload,
        collections: ['historical_incidents', 'runbooks'],
        topK: 5,
        trustScoreMin: 0.5,
      }, null as any) as any;

      const searchResultsArr = (Array.isArray(searchResults.results) ? searchResults.results : []) as any[];
      const contextText = searchResultsArr
        .map((r: any) => `[${r.collection}] ${JSON.stringify(r.payload)}`)
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

      const triageResponse = await triageAgent.generate(prompt);

      const triageJson = extractJSON(triageResponse.text || '{}');
      const triageRaw = JSON.parse(triageJson);
      const triageResult = TriageSchema.safeParse(triageRaw);
      if (!triageResult.success) {
        console.warn('[triage] Schema validation failed, filling defaults:', triageResult.error.issues.map(i => i.path.join('.')));
      }
      const parsed: z.infer<typeof TriageSchema> = triageResult.success
        ? triageResult.data
        : {
            incident_id: triageRaw.incident_id || incidentId,
            severity: (['SEV1', 'SEV2', 'SEV3'].includes(triageRaw.severity) ? triageRaw.severity : 'SEV2') as 'SEV1' | 'SEV2' | 'SEV3',
            confidence_score: typeof triageRaw.confidence_score === 'number' ? triageRaw.confidence_score : 0.7,
            affected_service: triageRaw.affected_service || 'unknown',
            affected_subsystem: triageRaw.affected_subsystem,
            slo_at_risk: triageRaw.slo_at_risk === true,
            error_budget_burn_rate: typeof triageRaw.error_budget_burn_rate === 'number' ? triageRaw.error_budget_burn_rate : 1,
            customer_impact: (['none', 'degraded', 'partial_outage', 'full_outage'].includes(triageRaw.customer_impact) ? triageRaw.customer_impact : 'degraded') as 'none' | 'degraded' | 'partial_outage' | 'full_outage',
            reasoning: triageRaw.reasoning || 'LLM output did not match schema — using fallback defaults',
            recommended_escalation: triageRaw.recommended_escalation === true,
            similar_incident_ids: Array.isArray(triageRaw.similar_incident_ids) ? triageRaw.similar_incident_ids : [],
          };

      // Write to audit log
      await pool.query(
        `INSERT INTO audit_logs (incident_id, action, prompt_hash, payload)
         VALUES ($1, 'triage_completed', $2, $3)`,
        [incidentId, promptHash, JSON.stringify(parsed)]
      );

      return parsed;
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
    triageResult: TriageSchema.optional(),
    incidentId: z.string().uuid().optional(),
    correlationId: z.string().optional(),
    traceparent: z.string().nullable().optional(),
    'confidence-pass': z.any().optional(),
  }).passthrough(),
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
    const data = (inputData as any)['confidence-pass'] || inputData;
    const { triageResult, incidentId, correlationId, traceparent } = data;

    const searchResults = await getOrExecuteStep(incidentId, 'retrieval', traceparent, async () => {
      const query = `${triageResult.affected_service} ${triageResult.severity} incident`;
      return qdrantSearchTool.execute!({
        query,
        collections: ['runbooks', 'historical_incidents', 'post_mortems'],
        topK: 8,
        serviceId: triageResult.affected_service,
        trustScoreMin: 0.5,
      }, null as any) as any;
    });

    const contextRefs = (searchResults.results as any[]).map((r: any) => r.id);

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
      const mastra = await getMastra();
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

      const remediationResponse = await remediationAgent.generate(prompt);

      const planRawJson = extractJSON(remediationResponse.text || '{}');
      const planRaw = JSON.parse(planRawJson);
      if (!planRaw.steps) planRaw.steps = [];
      if (!planRaw.plan_id) planRaw.plan_id = uuidv4();
      const planResult = RemediationSchema.safeParse(planRaw);
      if (!planResult.success) {
        console.warn('[remediation] Schema validation failed, filling defaults:', planResult.error.issues.map(i => i.path.join('.')));
      }
      const parsedPlan: z.infer<typeof RemediationSchema> = planResult.success
        ? planResult.data
        : {
            plan_id: planRaw.plan_id || uuidv4(),
            reasoning: planRaw.reasoning || 'Auto-generated fallback',
            executive_summary: planRaw.executive_summary || 'Remediation plan generated by LLM with partial data',
            overall_risk: (planRaw.overall_risk as any) || 'diagnostic',
            estimated_resolution_time: planRaw.estimated_resolution_time || 'Unknown - see steps',
            steps: planRaw.steps || [],
            alternative_approaches: planRaw.alternative_approaches,
          };

      // Enkrypt output validation — check evidence_refs are valid
      const planStr = JSON.stringify(parsedPlan);
      const outputGuardrail = await enkryptOutputGuardrailTool.execute!({
        text: planStr,
        contextRefs,
      }, null as any) as any;

      if (outputGuardrail.blocked) {
        throw new Error(`RemediationAgent output blocked: ${outputGuardrail.blockReason}`);
      }

      return parsedPlan;
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
      `INSERT INTO workflow_state (incident_id, step_name, status, idempotency_key, traceparent)
       VALUES ($1, 'hitl_gate', 'suspended', $2, $3)
       ON CONFLICT (idempotency_key) DO UPDATE SET status = 'suspended', traceparent = $3`,
      [incidentId, `${incidentId}:hitl_gate`, traceparent]
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
    remediationPlan: RemediationSchema.optional(),
    incidentId: z.string().uuid().optional(),
    correlationId: z.string().optional(),
    traceparent: z.string().nullable().optional(),
    'approved-pass': z.any().optional(),
  }).passthrough(),
  outputSchema: z.object({
    postMortem: PostMortemSchema,
    incidentId: z.string().uuid(),
  }),
  execute: async ({ inputData }) => {
    const data = (inputData as any)['approved-pass'] || inputData;
    const { remediationPlan, incidentId, correlationId, traceparent } = data;

    const postMortem = await getOrExecuteStep(incidentId, 'post_mortem', traceparent, async () => {
      const mastra = await getMastra();
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

      const postMortemResponse = await postMortemAgent.generate(prompt);

      const postMortemJson = extractJSON(postMortemResponse.text || '{}');
      const pmRaw = JSON.parse(postMortemJson);
      const pmResult = PostMortemSchema.safeParse(pmRaw);
      if (!pmResult.success) {
        console.warn('[post_mortem] Schema validation failed, filling defaults:', pmResult.error.issues.map(i => i.path.join('.')));
      }
      const parsed: z.infer<typeof PostMortemSchema> = pmResult.success
        ? pmResult.data
        : {
            incident_id: pmRaw.incident_id || incidentId,
            title: pmRaw.title || `Post-mortem for ${incidentId}`,
            severity: (['SEV1', 'SEV2', 'SEV3'].includes(pmRaw.severity) ? pmRaw.severity : 'SEV2') as 'SEV1' | 'SEV2' | 'SEV3',
            affected_service: pmRaw.affected_service || incident.rows[0]?.service_id || 'unknown',
            duration_minutes: typeof pmRaw.duration_minutes === 'number' ? pmRaw.duration_minutes : 0,
            mttr_minutes: typeof pmRaw.mttr_minutes === 'number' ? pmRaw.mttr_minutes : 0,
            mttr_delta_minutes: typeof pmRaw.mttr_delta_minutes === 'number' ? pmRaw.mttr_delta_minutes : 0,
            mttr_regression_alert: pmRaw.mttr_regression_alert === true,
            executive_summary: pmRaw.executive_summary || 'Post-mortem generated by LLM with fallback defaults',
            timeline: (Array.isArray(pmRaw.timeline) ? pmRaw.timeline : []).map((t: any) => ({
              timestamp: t?.timestamp || new Date().toISOString(),
              actor: ['system', 'triage_agent', 'remediation_agent', 'incident_commander', 'on_call_engineer'].includes(t?.actor) ? t.actor : 'system',
              event: t?.event || 'Unknown event',
              impact: t?.impact || '',
            })),
            root_cause_hypotheses: Array.isArray(pmRaw.root_cause_hypotheses) ? pmRaw.root_cause_hypotheses : ['No specific hypothesis generated — LLM output did not match schema'],
            contributing_factors: {
              system: Array.isArray(pmRaw.contributing_factors?.system) ? pmRaw.contributing_factors.system : [],
              process: Array.isArray(pmRaw.contributing_factors?.process) ? pmRaw.contributing_factors.process : [],
              human: Array.isArray(pmRaw.contributing_factors?.human) ? pmRaw.contributing_factors.human : [],
            },
            what_went_well: Array.isArray(pmRaw.what_went_well) ? pmRaw.what_went_well : [],
            action_items: (Array.isArray(pmRaw.action_items) ? pmRaw.action_items : []).map((a: any) => ({
              description: a?.description || 'Unknown action item',
              owner_role: ['on_call_engineer', 'incident_commander', 'sre_lead'].includes(a?.owner_role) ? a.owner_role : 'sre_lead',
              target_date: a?.target_date || new Date(Date.now() + 14 * 86400000).toISOString(),
              priority: ['P0', 'P1', 'P2'].includes(a?.priority) ? a.priority : 'P2',
            })),
            knowledge_gap_detected: pmRaw.knowledge_gap_detected === true,
          };
      return parsed;
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
    }, null as any);

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
    [async ({ inputData }) => inputData.blocked === true, 
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
    [async ({ inputData }) => !inputData.blocked,
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
    [async ({ inputData }) => !inputData.passed,
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
    [async ({ inputData }) => inputData.passed,
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
    [async ({ inputData }) => !inputData.approved,
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
    [async ({ inputData }) => inputData.approved,
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
