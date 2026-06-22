const architectureAreas = [
  "Incident room with severity-aware triage",
  "Evidence panel backed by Qdrant memory",
  "Approval queue for high-risk remediation steps",
  "Post-mortem editor with timeline writeback",
];

export default function HomePage() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 40, marginBottom: 12 }}>Runbook Sentinel</h1>
      <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 24 }}>
        Incident response and post-mortem agent for the HiDevs x Mastra hackathon.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Mandatory Stack</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>Mastra</strong>: orchestrates triage, retrieval, remediation, and post-mortem workflows
          </li>
          <li>
            <strong>Qdrant</strong>: stores incidents, runbooks, log signatures, and post-mortem memory
          </li>
          <li>
            <strong>Enkrypt AI</strong>: validates input and output before recommendations reach responders
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Planned Product Areas</h2>
        <ul style={{ lineHeight: 1.8 }}>
          {architectureAreas.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Round 1 Docs</h2>
        <p style={{ lineHeight: 1.6 }}>
          See <code>docs/PRD.md</code> and <code>docs/ARCHITECTURE.md</code> for the completed
          submission artifacts.
        </p>
      </section>
    </main>
  );
}
