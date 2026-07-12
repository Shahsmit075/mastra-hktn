import 'dotenv/config';
import { getMastra } from '../src/mastra';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../src/lib/db';

async function main() {
  const mastra = await getMastra();
  const incidentWorkflow = mastra.getWorkflow('incident-response');

  const alertPayload = JSON.stringify({
    alertname: 'HighCPU',
    service: 'payments-db',
    severity: 'critical',
    description: 'CPU utilization over 95% for 10 minutes on payments-db-primary.',
  }, null, 2);

  // 1. First execution (Cache Miss)
  console.log('----------------------------------------');
  console.log('🔄 RUN 1: Simulating Alert (Expected Cache Miss & Full LLM execution)...');
  const incidentId1 = uuidv4();
  const startTime1 = Date.now();
  
  await pool.query(
    `INSERT INTO incidents (id, title, status, severity, affected_service)
     VALUES ($1, 'HighCPU on payments-db', 'triaging', 'critical', 'payments-db')`,
    [incidentId1]
  );

  await incidentWorkflow.execute({
    triggerData: {
      rawPayload: alertPayload,
      incidentId: incidentId1,
      correlationId: `demo-cache-${Date.now()}-1`,
    }
  });
  
  const duration1 = Date.now() - startTime1;
  console.log(`⏱️ Run 1 Completed in ${duration1}ms`);

  console.log('\n----------------------------------------');
  console.log('🔄 RUN 2: Simulating IDENTICAL Alert Storm (Expected Cache Hit)...');
  const incidentId2 = uuidv4();
  const startTime2 = Date.now();

  await pool.query(
    `INSERT INTO incidents (id, title, status, severity, affected_service)
     VALUES ($1, 'HighCPU on payments-db', 'triaging', 'critical', 'payments-db')`,
    [incidentId2]
  );

  await incidentWorkflow.execute({
    triggerData: {
      rawPayload: alertPayload,
      incidentId: incidentId2,
      correlationId: `demo-cache-${Date.now()}-2`,
    }
  });

  const duration2 = Date.now() - startTime2;
  console.log(`⏱️ Run 2 Completed in ${duration2}ms`);

  console.log('\n----------------------------------------');
  console.log(`🚀 PERFORMANCE GAIN: ${Math.round(duration1 / duration2)}x faster!`);
  
  process.exit(0);
}

main().catch(console.error);
