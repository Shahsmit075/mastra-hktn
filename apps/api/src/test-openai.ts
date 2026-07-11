import 'dotenv/config';
import { mastra } from './mastra';
import { TriageSchema } from './mastra/agents/triageAgent';

async function test() {
  console.log("Testing triageAgent generation with output schema...");
  try {
    const triageAgent = mastra.getAgent('triageAgent');
    console.log("triageAgent.generate source:", triageAgent.generate.toString());
    const response = await triageAgent.generate("High error rate on payments service. Error rate is 10%.", {
      output: TriageSchema,
    });
    console.log("Response object keys:", Object.keys(response));
    console.log("Response text:", response.text);
    console.log("Response object:", response.object);
    console.log("Response warnings:", response.warnings);
    console.log("Response error:", response.error);

    try {
      const parsed = JSON.parse(response.text);
      const valResult = TriageSchema.safeParse(parsed);
      if (!valResult.success) {
        console.error("Zod validation failed:", valResult.error.format());
      } else {
        console.log("Zod validation succeeded!", valResult.data);
      }
    } catch (e: any) {
      console.error("JSON parse or validation crashed:", e.message);
    }
  } catch (err: any) {
    console.error("Error calling agent:", err);
  }
}

test();
