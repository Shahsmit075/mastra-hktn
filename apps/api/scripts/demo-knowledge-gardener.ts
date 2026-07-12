import 'dotenv/config';
import { mastra } from '../src/mastra';
import { SynthesisSchema } from '../src/mastra/agents/synthesisAgent';

async function runDemo() {
  console.log('🌱 Starting Knowledge Gardener (SynthesisAgent) Demo...\n');

  const oldRunbook = `
# RUNBOOK: Database Connection Pool Exhaustion
Last Updated: 2022-04-15

## Symptoms
- P99 Latency > 3s
- Error rate spiking
- Logs show "Timeout acquiring connection from pool"

## Mitigation
1. Identify the offending service (usually payments-db).
2. Manually restart the deployment to flush connections:
   \`kubectl rollout restart deployment payments-db\`
3. DO NOT scale the connection pool limit past 20, as it causes memory limits to trip.
  `;

  const newPostMortem = `
# POST-MORTEM: INC-2026-084 - Payments DB Pool Exhaustion
Date: 2026-07-12

## Timeline
- 03:00 AM: P99 Latency exceeded 4s.
- 03:05 AM: Attempted to restart deployment as per runbook. Immediate recurrence.
- 03:15 AM: Identified that memory limits were upgraded in Q1 2025. 
- 03:20 AM: Successfully increased connection pool limit to 40. Stability restored.

## Learnings
The old runbook explicitly forbid scaling the pool past 20. However, the database nodes were upgraded 
to 64GB RAM last year, so the limit of 20 is a legacy constraint. The correct remediation is now 
to dynamically patch the deployment and increase the max pool size to 40.
  `;

  console.log('📖 OLD RUNBOOK:\n', oldRunbook.trim());
  console.log('\n----------------------------------------\n');
  console.log('🚨 NEW POST-MORTEM:\n', newPostMortem.trim());
  console.log('\n----------------------------------------\n');
  
  console.log('🤖 Agent synthesizing unified runbook... (this may take a moment)\n');

  const synthesisAgent = mastra.getAgent('synthesisAgent');
  
  try {
    const result = await synthesisAgent.generate(
      [
        { role: 'user', content: `[OLD_RUNBOOK]\n${oldRunbook}\n\n[NEW_POST_MORTEM]\n${newPostMortem}` }
      ],
      { output: SynthesisSchema }
    );

    console.log('✅ SYNTHESIS COMPLETE!\n');
    let outputText = result.text || '';
    if (outputText.startsWith('```json')) {
      outputText = outputText.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    try {
      console.log(JSON.stringify(JSON.parse(outputText), null, 2));
    } catch {
      console.log(outputText);
    }

  } catch (error) {
    console.error('❌ Synthesis failed:', error);
  }
}

runDemo();
