import { Router } from 'express';
import { getMastra } from '../mastra';
import { SynthesisSchema } from '../mastra/agents/synthesisAgent';
import { enkryptInputGuardrailTool } from '../mastra/tools/enkryptGuardrail';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../lib/db';

const router = Router();

// 1. Knowledge Gardener Demo
router.post('/gardener', async (req, res) => {
  try {
    const { oldRunbook, newPostMortem } = req.body;
    
    if (!oldRunbook || !newPostMortem) {
      return res.status(400).json({ error: 'Missing runbook data' });
    }

    const mastra = await getMastra();
    const synthesisAgent = mastra.getAgent('synthesisAgent');
    
    const result = await synthesisAgent.generate(
      [
        { role: 'user', content: `[OLD_RUNBOOK]\n${oldRunbook}\n\n[NEW_POST_MORTEM]\n${newPostMortem}` }
      ],
      { output: SynthesisSchema }
    );

    let outputText = result.text || '';
    const match = outputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      outputText = match[1];
    }

    try {
      const parsed = JSON.parse(outputText);
      res.json(parsed);
    } catch {
      res.json({ rawText: outputText });
    }
  } catch (error: any) {
    console.error('Gardener error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Enkrypt Guardrail Demo
router.post('/enkrypt', async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing payload' });

    // We pass the string directly into the tool
    const result: any = await enkryptInputGuardrailTool.execute!({
      text: payload,
      contextRefs: []
    }, null as any);

    res.json({
      passed: result.passed,
      risk: result.risk,
      flags: result.flags || []
    });
  } catch (error: any) {
    console.error('Enkrypt error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Semantic Caching Demo
router.post('/caching', async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing payload' });

    const mastra = await getMastra();
    const incidentWorkflow = mastra.getWorkflow('incident-response');
    const incidentId = uuidv4();

    await pool.query(
      `INSERT INTO incidents (id, title, status, severity, affected_service)
       VALUES ($1, 'Demo Alert', 'triaging', 'critical', 'demo-service')`,
      [incidentId]
    );

    const startTime = Date.now();

    const executionResult = await incidentWorkflow.execute({
      triggerData: {
        rawPayload: payload,
        incidentId,
        correlationId: `demo-cache-${Date.now()}`,
      }
    });

    const duration = Date.now() - startTime;
    
    // Determine if cache hit occurred by checking the execution trace or just passing it back.
    // For simplicity, we can just infer it from duration or we could extract it from workflow state if needed.
    // Let's just return duration and let UI decide (e.g. < 500ms is a hit)
    // Or we could check if executionResult contains cacheHit.
    
    // In our workflow, semanticCacheCheckStep sets data.cacheHit = true. 
    // Wait, the workflow execute() returns { runId, ... } and we'd have to inspect state.
    // Let's rely on duration for the demo as it's visibly obvious.

    res.json({
      durationMs: duration,
      incidentId
    });
  } catch (error: any) {
    console.error('Caching error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
