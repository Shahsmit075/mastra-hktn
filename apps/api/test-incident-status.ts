import 'dotenv/config';
import { pool } from './src/lib/db';

async function test() {
  try {
    const res = await pool.query(`SELECT status FROM incidents WHERE id = '96ca0e33-8c75-448f-aa32-6f0eed7eae8e'`);
    console.log('Incident status:', res.rows[0].status);
  } finally {
    await pool.end();
  }
}
test();
