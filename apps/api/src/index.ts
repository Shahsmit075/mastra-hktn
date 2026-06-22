type HealthResponse = {
  name: string;
  status: "ok";
  mission: string;
};

export function getHealth(): HealthResponse {
  return {
    name: "runbook-sentinel-api",
    status: "ok",
    mission: "Coordinate incident-response workflows across Mastra, Qdrant, and Enkrypt AI.",
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(getHealth(), null, 2));
}
