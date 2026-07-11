import 'dotenv/config';
import { pool } from './src/lib/db';

async function test() {
  try {
    const snaps = await pool.query(`SELECT snapshot FROM mastra_workflow_snapshot WHERE run_id = '940308e4-bea9-44a5-93ce-b550781e2f8a'`);
    console.log(JSON.stringify(snaps.rows[0].snapshot.error, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
test();
