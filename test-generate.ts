import 'dotenv/config';
import { getMastra } from './apps/api/src/mastra/index';
import { RemediationSchema } from './apps/api/src/mastra/agents/remediationAgent';

async function main() {
  const mastra = await getMastra();
  const agent = mastra.getAgent('remediationAgent');
  
  const res = await agent.generate("Test incident: CPU spike on payment-db", {
    output: RemediationSchema,
    temperature: 0.1
  });
  
  console.log("OBJECT:", JSON.stringify(res.object, null, 2));
  console.log("TEXT:", res.text);
}

main().catch(console.error);
