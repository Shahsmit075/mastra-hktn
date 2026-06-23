# Runbook Sentinel — Comprehensive Architecture Diagram

This document contains the standalone system and data flow architecture diagram for Runbook Sentinel, showing the full incident lifecycle across **Mastra**, **Qdrant**, and **Enkrypt AI**.

## Incident Lifecycle and Data Flow

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#1F2937', 'edgeLabelBackground':'#111827', 'tertiaryColor': '#111827'}}}%%
flowchart TB
    %% User Roles & Client
    subgraph Client [Client & Roles]
        OnCall[On-Call Engineer]
        IC[Incident Commander]
        Comms[Communications Lead]
        ScribeClient[Automated Scribe Dashboard]
    end

    %% Intake & Security Gate
    subgraph Intake [Ingestion & Safety Gateway]
        AlertIntake[Alert / Log / Notes Ingestion]
        EnkryptInput{Enkrypt AI: Input Guardrail}
        PIIRedact[PII Redaction & Injection Block]
    end

    %% Mastra Orchestration Layer
    subgraph Mastra [Mastra Orchestration Runtime]
        Triage[TriageAgent]
        RetFlow[Retrieval Workflow]
        Remediation[RemediationAgent]
        WorkflowState[(Durable State Store)]
        PostMortemAgent[PostMortemAgent]
    end

    %% Storage & Retrieval Layer
    subgraph Storage [Memory & Persistent Storage]
        Qdrant[(Qdrant Vector DB)]
        RelationalDB[(Postgres / LibSQL)]
    end

    %% Safety & Approval Gates
    subgraph Verification [Validation & Approval]
        EnkryptOutput{Enkrypt AI: Output Guardrail}
        HallucinationCheck[Adherence & Hallucination Check]
        HITLGate{Is Step High Risk?}
        ICApproval[IC Human Approval Gate]
    end

    %% Connect Client to Intake
    OnCall -->|1. Paste alert/logs| AlertIntake
    IC -->|1. Paste incident updates| AlertIntake
    
    %% Ingestion flow
    AlertIntake -->|2. Send input| EnkryptInput
    EnkryptInput -->|If Unsafe| PIIRedact -->|Redacted/Cleaned| Triage
    EnkryptInput -->|If Safe| Triage
    
    %% Triage to Retrieval
    Triage -->|3. Identify service & SLO risk| RetFlow
    
    %% Retrieval Workflow queries Qdrant
    RetFlow -->|4. Parallel Query dense & sparse| Qdrant
    Qdrant -->|5. Return raw chunks & scores| RetFlow
    
    %% Re-ranking inside Retrieval Workflow
    RetFlow -->|6. Score normalization & temporal decay| Remediation
    
    %% Remediation Agent uses context to build plan
    Remediation -->|7. Ranked plan with evidence_refs| EnkryptOutput
    
    %% Output Safety Checks
    EnkryptOutput -->|8. Compare to retrieved context| HallucinationCheck
    HallucinationCheck -->|Pass| HITLGate
    HallucinationCheck -->|Fail: Hallucination| Remediation
    
    %% Human-in-the-loop Gate
    HITLGate -->|Yes: risk_level == high_risk| ICApproval
    ICApproval -->|Approved| ResumeWorkflow[Resume Workflow Execution]
    ICApproval -->|Rejected| Remediation
    HITLGate -->|No: diagnostic/mitigating| ResumeWorkflow
    
    %% Execution state updates
    ResumeWorkflow -->|9. Update timeline & status| RelationalDB
    RelationalDB -->|10. Stream updates via SSE| ScribeClient
    RelationalDB -->|10. Stream updates via SSE| Comms
    
    %% Close loop & writeback
    RelationalDB -->|11. Trigger on Incident Close| PostMortemAgent
    PostMortemAgent -->|12. Draft retrospective & action items| RelationalDB
    PostMortemAgent -->|13. Commit final summary| Qdrant
```

### Flow Walkthrough

1.  **Ingestion & Input Sanitization**: The **On-Call Engineer** or **Incident Commander** inputs telemetry data. **Enkrypt AI** evaluates it for prompt injection or sensitive tokens (such as AWS keys or credentials), redacting them before they reach downstream components.
2.  **Triage**: The **Mastra `TriageAgent`** extracts the target service and estimates the incident severity, evaluating whether the incident threatens to breach active **SLOs** or consume the **error budget**.
3.  **Parallel Retrieval**: The **Mastra `RetrievalWorkflow`** initiates parallel search queries across four **Qdrant** collections (`incidents`, `runbooks`, `log_chunks`, and `post_mortems`). For logs, it uses hybrid search (combining dense vector search with sparse BM25 indexing) and Reciprocal Rank Fusion (RRF).
4.  **Re-Ranking**: Results are normalized and updated using chronological decay (prioritizing recent logs/incidents) and service boosts. The top results are sent to the **`RemediationAgent`**.
5.  **Plan Generation**: The **`RemediationAgent`** drafts remediation steps. The Zod output schema requires every recommendation to map to at least one valid source ID in `evidence_refs`.
6.  **Output Sanitization**: The generated plan and the source context are sent to **Enkrypt AI's hallucination and adherence detectors** to ensure that recommendations match verified documentation.
7.  **Human-in-the-Loop Gate**: If any step is flagged as `high_risk`, Mastra suspends execution, saving the state and waiting for the **Incident Commander** to review and approve the step.
8.  **Execution & Writeback**: When approved, execution details are saved to the relational database, and Server-Sent Events update the **Scribe** timeline and **Communications Lead** dashboard. On incident close, the **`PostMortemAgent`** builds a blameless post-mortem draft and writes the verified patterns back to **Qdrant**.

---

## High-Level MVP Integration Flow

For a high-level overview of the Round 1 submission and core MVP scope, the following diagram illustrates the critical path and the central integrations of the mandatory technology stack (**Mastra**, **Qdrant**, and **Enkrypt AI**):

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#1F2937', 'edgeLabelBackground':'#111827', 'tertiaryColor': '#111827'}}}%%
flowchart LR
    Ingestion[1. Ingestion<br>Raw logs, alerts, & notes] -->|Telemetry| EnkryptInput[2. Enkrypt AI<br>Input Guardrails]
    EnkryptInput -->|Sanitized Context| MastraOrch[3. Mastra Orchestration<br>Workflows & Agents]
    
    MastraOrch <-->|Retrieval & Writeback| QdrantMem[(4. Qdrant Memory<br>Runbooks, Logs, & Cases)]
    MastraOrch <-->|LLM Interaction| LLM[LLM / GenAI Inference]
    
    MastraOrch -->|Remediation Proposal| EnkryptOutput[5. Enkrypt AI<br>Output Guardrails]
    EnkryptOutput -->|Verified Citations| SecureOutput[6. Secure Output<br>Actionable Guidance]

    style EnkryptInput fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style EnkryptOutput fill:#A16207,stroke:#EAB308,stroke-width:2px,color:#FFF
    style MastraOrch fill:#1E3A8A,stroke:#60A5FA,stroke-width:2px,color:#FFF
    style QdrantMem fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFF
    style LLM fill:#475569,stroke:#94A3B8,stroke-width:2px,color:#FFF
```

### High-Level Critical Path Walkthrough

1.  **Ingestion**: Raw alert payloads, stack traces, and operator notes are received at the incident room interface.
2.  **Enkrypt AI (Input Guardrails)**: Blocks potential prompt injection attempts and filters out operational secrets (such as API keys and credentials) or customer PII before sending the payload downstream.
3.  **Mastra Orchestration**: Acts as the central workflows and agents orchestrator. It manages execution states, conditions, steps, tools, and the supervisor pattern configuration.
4.  **Qdrant Memory**: Provides vector semantic search capabilities. Mastra queries Qdrant to retrieve relevant runbook chunks and historical incident records.
5.  **Enkrypt AI (Output Guardrails)**: Cross-checks the generated plan against the retrieved Qdrant context to check for hallucinations and evaluate safety before displaying suggestions.
6.  **Secure Output**: Surfaces the verified, citation-grounded remediation recommendations to the engineer.

