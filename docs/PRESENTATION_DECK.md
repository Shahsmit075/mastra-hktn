# Runbook Sentinel — Hackathon Presentation Deck
---

## Slide 1: Title
**Headline:** Runbook Sentinel
**Tagline:** The Self-Healing SRE Knowledge Loop.
**Subtitle:** An always-available AI SRE teammate built for modern infrastructure.
**Visual:** Abstract node flow (pulsing blue node representing an active agent).
**Speaking Points:** 
* "Runbook Sentinel isn't just an alert router—it orchestrates the entire incident lifecycle."
* "From initial alert triage, to safety-guarded remediation, to blameless post-mortems and automated knowledge base reconciliation."

## Slide 2: The Business Reality
**Headline:** Downtime is expensive. MTTR is stuck.
**Tagline:** The bottleneck isn't finding the bug; it's finding the context.
**Visual:** Highlighting "45+ Minutes" (Average time spent purely on context reconstruction).
**Speaking Points:**
* "In modern distributed systems, complexity has outpaced human memory."
* "When a SEV1 incident hits, engineers lose critical minutes digging through Slack, old Jira tickets, and fragmented dashboards."
* "Resolution is delayed not by lack of skill, but by lack of accessible knowledge."

## Slide 3: The Human Cost
**Headline:** Systems evolve. Runbooks do not.
**Tagline:** Outdated documentation actively damages incident response.
**Visual:** Three columns of stark metrics (30%, 40%, 0%).
**Speaking Points:**
* **30% Stale Knowledge Drift:** Escalations happen because engineers follow instructions from runbooks written years ago.
* **40% Alert Fatigue:** High-volume noise masks critical signals, causing burnout and turnover.
* **0% Compliance on Generic LLMs:** Standard chatbots lack infrastructure context and pose high risks of hallucinating destructive commands.

## Slide 4: The Solution
**Headline:** An AI teammate that never sleeps.
**Tagline:** Bridging the gap between observability and resolution.
**Visual:** A simulated terminal/console view showing the AI analyzing alerts and finding root causes in real-time.
**Speaking Points:**
* "Runbook Sentinel listens to monitoring tools, triages the issue, and formulates a safe remediation plan based on past successes."
* "It provides instant context before you even open your laptop."
* "Crucially, it guarantees absolute control: it executes nothing without human authorization."

## Slide 5: The Workflow
**Headline:** The Compounding Knowledge Loop.
**Tagline:** Every outage makes the system smarter.
**Visual:** A 4-step interactive lifecycle flow (Detect -> Triage -> Act -> Learn).
**Speaking Points:**
* "Instead of treating incidents as isolated events, we treat them as training data."
* "This is a compounding loop: resolution inherently writes the documentation for the next crisis."
* "Every time an incident is closed, our vector database gets smarter."

## Slide 6: Technical Foundation 1 (Mastra)
**Headline:** Technical Foundation 1: Durable Orchestration.
**Tagline:** Powered by Mastra Workflow State Machines.
**Visual:** State persistence tracker showing a workflow suspended at a HITL authorization gate.
**Speaking Points:**
* "Standard AI chatbots lose context if you refresh the page. Runbook Sentinel uses Mastra to orchestrate durable, Postgres-backed workflows."
* "If an agent proposes a high-risk change, the workflow safely suspends itself."
* "It waits securely in the database indefinitely until the Incident Commander clicks approve."

## Slide 7: Technical Foundation 2 (Qdrant)
**Headline:** Technical Foundation 2: Hybrid Memory.
**Tagline:** Finding the needle in the haystack with Qdrant.
**Visual:** Hybrid Retrieval System diagram combining Dense (Semantic) and Sparse (Keyword) search.
**Speaking Points:**
* "Finding the right historical incident requires more than simple keyword matching."
* "We utilize Qdrant Vector DB for Hybrid Search."
* "By combining Dense Semantic Embeddings (understanding meaning) with Sparse BM25 (exact matching of specific error codes), the agent surfaces the exact runbook needed in milliseconds."

## Slide 8: Technical Foundation 3 (Enkrypt AI)
**Headline:** Technical Foundation 3: Absolute Safety.
**Tagline:** Guardrails provided by Enkrypt AI.
**Visual:** The Security Perimeter diagram showing input and output guardrail points.
**Speaking Points:**
* "Enterprises cannot hand the keys of production infrastructure to a naked LLM."
* "Enkrypt AI forms a hard security perimeter around the agent cluster."
* "Input guardrails block prompt injections and redact PII. Output guardrails validate plans to ensure the LLM hasn't hallucinated commands."

## Slide 9: User Experience
**Headline:** Clarity over decoration under stress.
**Tagline:** The spotlight interface designed for 3:00 AM incident commanders.
**Visual:** Spotlight Trace comparing clean Signal/Threshold logic vs raw AI JSON output.
**Speaking Points:**
* "During high-severity incidents, SRE leads do not need bloated dashboards."
* "The Spotlight Trace strips out raw, chaotic log telemetry and renders sequential, staggered logical beats explaining the agent's logic."
* "It requires a manual click to proceed with state-mutating commands."

## Slide 10: Knowledge Freshness
**Headline:** The Knowledge Gardener.
**Tagline:** Proactively pruning outdated runbooks to avoid human mistakes.
**Visual:** Conflict resolution view showing an old 2022 runbook vs a new 2026 post-mortem.
**Speaking Points:**
* "As infrastructure changes, older runbooks naturally drift. Our Knowledge Freshness Service acts as an automatic background gardener."
* "It detects contradictions between newly written post-mortems and older vector runbooks."
* "A SynthesisAgent automatically writes a unified runbook draft for Lead approval."

## Slide 11: ROI & Value
**Headline:** The Business Value.
**Tagline:** Measurable impact on reliability and team health.
**Visual:** 3 core ROI metrics (-80% MTTR, 100% Knowledge Retention, Zero Rogue Actions).
**Speaking Points:**
* "**Faster Resolution:** Eliminating the initial 45 minutes of context-gathering."
* "**Knowledge Retention:** No more lost lessons. Every incident generates a blameless post-mortem."
* "**Zero Rogue Actions:** Enterprise-grade safety guarantees that AI never modifies infrastructure unchecked."

## Slide 12: Conclusion
**Headline:** Always available. Always accurate.
**Tagline:** The future of Site Reliability Engineering.
**Visual:** A powerful, centered mission statement with a call-to-action button to enter the War Room.
**Speaking Points:**
* "Runbook Sentinel doesn't replace engineers."
* "It removes the toil of context gathering, protects them from stale documentation, and empowers them to make critical decisions with perfect historical memory."
