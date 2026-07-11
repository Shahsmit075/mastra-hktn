import 'dotenv/config';
import { mastra } from './src/mastra/index';
import { pool } from './src/lib/db';

async function test() {
  try {
    const incidentId = '96ca0e33-8c75-448f-aa32-6f0eed7eae8e';
    const state = await pool.query(
      `SELECT result_json FROM workflow_state WHERE incident_id = $1 AND idempotency_key = $2`,
      [incidentId, `${incidentId}:run_id`]
    );
    const runId = state.rows[0].result_json.runId;
    console.log('Run ID:', runId);

    const workflow = mastra.getWorkflow('incident-response');
    const run = await workflow.createRun({ runId });
    console.log('Resuming run...', runId);

    const result = await run.resume({
      step: 'hitl_gate',
      resumeData: {
        approved: true,
        approverId: 'test-user',
      },
    });
    console.log('Result:', result);
  } catch (err: any) {
    console.error('Error:', err.message, err.stack);
  } finally {
    await pool.end();
  }
}
test();
