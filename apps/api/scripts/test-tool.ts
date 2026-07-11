import 'dotenv/config';
import { mastra } from '../src/mastra/index';
import { enkryptInputGuardrailTool } from '../src/mastra/tools/enkryptGuardrail';

async function main() {
  const guardrailResult = await enkryptInputGuardrailTool.execute!({ text: 'test' } as any);
  console.log('Result type:', typeof guardrailResult);
  console.log('Result:', guardrailResult);
  process.exit(0);
}
main();
