import { Mastra } from '@mastra/core';
import { PostgresStore } from '@mastra/pg';
import type { AnyWorkflow } from '@mastra/core/workflows';

// Import providers and models from extracted models.ts
export * from './models';

import { triageAgent } from './agents/triageAgent';
import { remediationAgent } from './agents/remediationAgent';
import { postMortemAgent } from './agents/postMortemAgent';
import { synthesisAgent } from './agents/synthesisAgent';
import { incidentWorkflow } from './workflows/incidentWorkflow';

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: 'runbook-sentinel',
    connectionString: process.env.DATABASE_URL || 'postgresql://sentinel:sentinel_dev_pass@localhost:5432/runbook_sentinel',
  }),
  agents: { triageAgent, remediationAgent, postMortemAgent, synthesisAgent },
  workflows: { 'incident-response': incidentWorkflow },
});

export async function getMastra() { return mastra; }

