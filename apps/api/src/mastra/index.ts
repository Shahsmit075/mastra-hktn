import { Mastra } from '@mastra/core';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { triageAgent } from './agents/triageAgent';
import { remediationAgent } from './agents/remediationAgent';
import { postMortemAgent } from './agents/postMortemAgent';
import { incidentWorkflow } from './workflows/incidentWorkflow';

import { primaryModel, fastModel } from './models';

export { primaryModel, fastModel };

export const mastra: any = new Mastra({
  agents: { triageAgent, remediationAgent, postMortemAgent },
  workflows: { incidentWorkflow },
} as any);
