import 'dotenv/config';
import { pool } from './src/lib/db';

async function test() {
  try {
    const res = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    console.log(res.rows.map(r => r.table_name));
    
    // Also let's check mastra_workflow_snapshot
    const snaps = await pool.query(`SELECT * FROM mastra_workflow_snapshot`);
    console.log('Snapshots:', snaps.rows);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
test();
