import { Pool } from 'pg';

// Singleton pool — shared across the entire API process
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres client error', err);
});

export { pool };

// Helper: run query with automatic client release
export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.LOG_LEVEL === 'debug') {
    console.debug('query executed', { text, duration, rows: result.rowCount });
  }
  return result;
}

// Helper: check DB connectivity
export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
