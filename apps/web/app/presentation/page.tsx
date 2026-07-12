'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  ArrowLeft, 
  Terminal, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  Database, 
  CheckCircle,
  HelpCircle,
  Play,
  BrainCircuit,
  UserCheck
} from 'lucide-react';

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    // Slide 1: Title
    {
      title: "Runbook Sentinel",
      tagline: "The Self-Healing SRE Knowledge Loop.",
      subtitle: "An always-available AI SRE teammate built for modern infrastructure.",
      content: (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-12 mt-16 w-full">
          <div className="flex-1 space-y-6 max-w-xl">
            <p className="text-sm font-mono tracking-[0.08em] text-blue-600 uppercase font-semibold">
              Project Presentation // Hackathon
            </p>
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              Runbook Sentinel orchestrates the entire incident lifecycle—from initial alert triage and safety-guarded remediation plans to blameless post-mortems and automated knowledge base reconciliation.
            </p>
            <div className="pt-4 flex gap-4">
              <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 py-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md font-mono text-sm tracking-[0.04em] transition-all uppercase">
                Enter War Room <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="relative w-80 h-80 rounded-full border border-zinc-100 flex items-center justify-center bg-zinc-50/30">
              <div className="absolute inset-4 rounded-full border border-dashed border-zinc-200 animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-12 rounded-full border border-zinc-200 flex items-center justify-center">
                <Cpu className="w-10 h-10 text-blue-600" />
              </div>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-600 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.4)]" />
              <div className="absolute bottom-8 right-8 w-2 h-2 bg-zinc-400 rounded-full" />
            </div>
          </div>
        </div>
      )
    },
    // Slide 2: The Business Reality
    {
      title: "Downtime is expensive. MTTR is stuck.",
      tagline: "The bottleneck isn't finding the bug; it's finding the context.",
      content: (
        <div className="flex flex-col md:flex-row gap-12 mt-16 w-full items-center">
          <div className="flex-1 space-y-6 max-w-xl">
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              In modern distributed systems, infrastructure complexity has outpaced human memory. When a SEV1 incident hits, engineers lose critical minutes digging through Slack, old Jira tickets, and fragmented dashboards just to understand what they are looking at.
            </p>
            <p className="text-zinc-900 font-semibold text-lg font-sans">
              Resolution is delayed not by lack of skill, but by lack of accessible knowledge.
            </p>
          </div>
          <div className="flex-1 w-full flex flex-col gap-4">
            <div className="bg-zinc-50 border border-zinc-100 p-6 rounded-xl flex items-center gap-4">
              <div className="w-2 h-12 bg-red-500 rounded-full" />
              <div>
                <h4 className="font-bold text-zinc-900">45+ Minutes</h4>
                <p className="text-sm text-zinc-600">Average time spent purely on context reconstruction during a SEV1.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 3: The Human Cost
    {
      title: "Systems evolve. Runbooks do not.",
      tagline: "Outdated documentation actively damages incident response.",
      content: (
        <div className="grid md:grid-cols-3 gap-8 mt-16 w-full">
          <div className="bg-zinc-50 border border-zinc-100 p-8 rounded-xl shadow-sm space-y-4">
            <p className="text-4xl font-bold text-zinc-950 font-sans tracking-tight">30%</p>
            <h4 className="text-md font-bold text-zinc-900 font-sans">Stale Knowledge Drift</h4>
            <p className="text-sm text-zinc-600 leading-relaxed font-sans">
              Escalations often occur because engineers faithfully follow instructions from runbooks that were written years ago and never updated.
            </p>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 p-8 rounded-xl shadow-sm space-y-4">
            <p className="text-4xl font-bold text-zinc-950 font-sans tracking-tight">40%</p>
            <h4 className="text-md font-bold text-zinc-900 font-sans">Alert Fatigue</h4>
            <p className="text-sm text-zinc-600 leading-relaxed font-sans">
              High-volume noise masks critical signals. Pager burnout is one of the leading causes of turnover in Site Reliability teams.
            </p>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 p-8 rounded-xl shadow-sm space-y-4">
            <p className="text-4xl font-bold text-blue-600 font-sans tracking-tight">0%</p>
            <h4 className="text-md font-bold text-zinc-900 font-sans">Compliance on Generic LLMs</h4>
            <p className="text-sm text-zinc-600 leading-relaxed font-sans">
              Standard chatbots lack infrastructure context and pose high risks of hallucinating destructive commands like dropping critical tables.
            </p>
          </div>
        </div>
      )
    },
    // Slide 4: The Solution
    {
      title: "An AI teammate that never sleeps.",
      tagline: "Bridging the gap between observability and resolution.",
      content: (
        <div className="flex flex-col md:flex-row gap-12 mt-16 w-full items-center">
          <div className="flex-1 space-y-6 max-w-xl">
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              Runbook Sentinel is not just a chatbot. It is a proactive agent that listens to your monitoring tools, triages the issue, formulates a safe remediation plan based on past successes, and waits for your final approval.
            </p>
            <ul className="space-y-4 font-sans text-sm text-zinc-700 mt-6">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" /> 
                <span><strong>Instant Context:</strong> Reads the alert, checks the metrics, and retrieves historical data before you even open your laptop.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" /> 
                <span><strong>Absolute Control:</strong> Generates the exact CLI commands or API calls, but executes nothing without human authorization.</span>
              </li>
            </ul>
          </div>
          <div className="flex-1 w-full flex justify-center">
             <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 text-zinc-300 font-mono text-sm w-full shadow-elevated">
               <div className="text-zinc-500 mb-4 border-b border-zinc-800 pb-2 uppercase text-[10px] tracking-wider">Automated Assessment</div>
               <p><span className="text-blue-400">►</span> Analyzing Alert: High Error Rate</p>
               <p><span className="text-blue-400">►</span> Correlating Traces: 4.2s P99 Latency</p>
               <p><span className="text-green-400">►</span> Root Cause Found: Connection Pool Exhausted</p>
               <p className="mt-4 text-amber-400 animate-pulse">Waiting for Human Approval to patch deployment...</p>
             </div>
          </div>
        </div>
      )
    },
    // Slide 5: The Workflow
    {
      title: "The Compounding Knowledge Loop.",
      tagline: "Every outage makes the system smarter.",
      content: (
        <div className="flex flex-col items-center mt-12 w-full space-y-12">
          <p className="text-zinc-600 text-lg text-center max-w-3xl font-sans">
            Instead of treating incidents as isolated events, we treat them as training data. Resolution inherently writes the documentation for the next crisis.
          </p>
          <div className="flex items-center justify-between w-full max-w-4xl text-xs font-mono">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-sm">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <span className="uppercase text-center">1. Detect<br/><span className="text-zinc-400">Telemetry Ingest</span></span>
            </div>
            <ArrowRight className="w-6 h-6 text-zinc-300" />
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-sm">
                <BrainCircuit className="w-6 h-6 text-blue-600" />
              </div>
              <span className="uppercase text-center">2. Triage<br/><span className="text-zinc-400">AI Context</span></span>
            </div>
            <ArrowRight className="w-6 h-6 text-zinc-300" />
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </div>
              <span className="uppercase text-center">3. Act<br/><span className="text-zinc-400">Human Gate</span></span>
            </div>
            <ArrowRight className="w-6 h-6 text-zinc-300" />
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-blue-600 border border-blue-700 rounded-full flex items-center justify-center shadow-sm">
                <Database className="w-6 h-6 text-white" />
              </div>
              <span className="uppercase text-center font-bold">4. Learn<br/><span className="text-zinc-500">Vector Writeback</span></span>
            </div>
          </div>
        </div>
      )
    },
    // Slide 6: Tech - Mastra
    {
      title: "Technical Foundation 1: Durable Orchestration.",
      tagline: "Powered by Mastra Workflow State Machines.",
      content: (
        <div className="flex flex-col md:flex-row gap-12 mt-16 w-full items-center">
          <div className="flex-1 space-y-6 max-w-xl">
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              Standard AI chatbots lose context if you refresh the page. Runbook Sentinel uses <strong>Mastra</strong> to orchestrate durable, Postgres-backed workflows.
            </p>
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              If an agent proposes a high-risk change, the workflow executes a <code>.suspend()</code> method. It waits securely in the database indefinitely until the Incident Commander clicks approve, at which point it executes <code>.resume()</code>. 
            </p>
          </div>
          <div className="flex-1 w-full bg-zinc-50 border border-zinc-100 p-6 rounded-xl">
            <h4 className="text-sm font-mono tracking-[0.04em] text-zinc-400 uppercase mb-4">State Persistence</h4>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center p-3 bg-white border border-zinc-200 rounded">
                <span className="text-zinc-600">Step 1: Sanitize Input</span>
                <span className="text-green-600 font-bold">COMPLETED</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white border border-zinc-200 rounded">
                <span className="text-zinc-600">Step 2: Generate Remediation</span>
                <span className="text-green-600 font-bold">COMPLETED</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded shadow-[0_0_10px_rgba(37,99,235,0.1)]">
                <span className="text-blue-800 font-bold">Step 3: HITL Authorization Gate</span>
                <span className="text-blue-600 font-bold animate-pulse">SUSPENDED</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 7: Tech - Qdrant
    {
      title: "Technical Foundation 2: Hybrid Memory.",
      tagline: "Finding the needle in the haystack with Qdrant.",
      content: (
        <div className="flex flex-col md:flex-row gap-12 mt-16 w-full items-center">
          <div className="flex-1 space-y-6 max-w-xl">
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              Finding the right historical incident requires more than simple keyword matching. We utilize <strong>Qdrant Vector DB</strong> for Hybrid Search.
            </p>
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              By combining Dense Semantic Embeddings (understanding the *meaning* of the error) with Sparse BM25 (exact matching of specific error codes like <code>ERR_CONN_05</code>), the agent surfaces the exact runbook needed in milliseconds.
            </p>
          </div>
          <div className="flex-1 w-full flex justify-center">
            <div className="relative w-full max-w-sm h-64 border border-zinc-200 rounded-xl bg-zinc-50 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-sm">
               <Database className="w-12 h-12 text-blue-600 mb-4" />
               <p className="font-mono text-sm font-bold text-zinc-900">Hybrid Retrieval System</p>
               <div className="flex gap-4 mt-4 w-full">
                 <div className="flex-1 bg-white p-2 border border-zinc-200 rounded text-[10px] font-mono text-zinc-500">Dense (Semantic)</div>
                 <div className="flex-1 bg-white p-2 border border-zinc-200 rounded text-[10px] font-mono text-zinc-500">Sparse (Keyword)</div>
               </div>
               <div className="mt-4 w-full bg-blue-100 p-2 rounded border border-blue-200 text-[10px] font-mono text-blue-800 font-bold">
                 Reciprocal Rank Fusion (RRF)
               </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 8: Tech - Enkrypt AI
    {
      title: "Technical Foundation 3: Absolute Safety.",
      tagline: "Guardrails provided by Enkrypt AI.",
      content: (
        <div className="grid md:grid-cols-2 gap-12 mt-16 w-full items-center">
          <div className="space-y-6">
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              Enterprises cannot hand the keys of production infrastructure to a naked LLM. 
              <strong>Enkrypt AI</strong> forms a hard security perimeter around the agent cluster.
            </p>
            <ul className="space-y-4 font-sans text-sm text-zinc-700">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">1</span>
                <span><strong>Input Guardrails:</strong> Blocks prompt injections from compromised logs and redacts customer PII before it hits the LLM.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">2</span>
                <span><strong>Output Guardrails:</strong> Validates generated remediation plans to ensure the LLM hasn't hallucinated commands or cited fake documentation.</span>
              </li>
            </ul>
          </div>
          <div className="border border-zinc-100 rounded-xl p-8 bg-zinc-50/50 space-y-4 shadow-sm">
            <h4 className="text-sm font-mono tracking-[0.04em] text-zinc-400 uppercase text-center mb-6">The Security Perimeter</h4>
            <div className="flex justify-between items-center bg-white border border-zinc-200 rounded p-3 text-xs font-mono">
              <span>Alert Payload</span>
              <ArrowRight className="w-4 h-4 text-zinc-300" />
              <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold border border-amber-200">Enkrypt Input</span>
              <ArrowRight className="w-4 h-4 text-zinc-300" />
              <span>Mastra LLM</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-zinc-200 rounded p-3 text-xs font-mono">
              <span>Mastra Output</span>
              <ArrowRight className="w-4 h-4 text-zinc-300" />
              <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold border border-amber-200">Enkrypt Output</span>
              <ArrowRight className="w-4 h-4 text-zinc-300" />
              <span>Execution</span>
            </div>
          </div>
        </div>
      )
    },
    // Slide 9: User Experience
    {
      title: "Clarity over decoration under stress.",
      tagline: "The spotlight interface designed for 3:00 AM incident commanders.",
      content: (
        <div className="flex flex-col md:flex-row gap-12 mt-16 w-full items-center">
          <div className="flex-1 space-y-6 max-w-xl">
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              During high-severity incidents, SRE leads do not need bloated dashboards. The **Spotlight Trace** strips out raw, chaotic log telemetry and renders sequential, staggered logical beats explaining the agent's logic.
            </p>
            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-lg font-mono text-xs text-zinc-700 shadow-sm">
              <span className="text-blue-600 font-bold uppercase mr-2">Signal:</span> Error rate of 8.2% exceeds 0.5% SLO threshold
              <br/><br/>
              <span className="text-blue-600 font-bold uppercase mr-2">Threshold:</span> Burn rate calculation indicates exhaustion in 44 minutes
            </div>
          </div>
          <div className="flex-1 w-full bg-zinc-950 text-zinc-400 p-6 rounded-xl border border-zinc-800 font-mono text-xs shadow-elevated space-y-4">
            <div className="flex justify-between items-center text-[10px] uppercase text-zinc-500 border-b border-zinc-800 pb-2">
              <span>Agent Console (CoT)</span>
              <span className="text-amber-500">Awaiting Authorization</span>
            </div>
            <div className="space-y-2">
              <p className="text-zinc-200">{"{"}</p>
              <p className="pl-4">"action": <span className="text-green-400">"kubectl patch deployment payments-db..."</span>,</p>
              <p className="pl-4">"risk_level": <span className="text-amber-500">"mitigating"</span>,</p>
              <p className="pl-4">"requires_hitl": <span className="text-blue-400">true</span></p>
              <p className="text-zinc-200">{"}"}</p>
            </div>
            <div className="pt-2 text-[10px] text-zinc-500 flex items-center gap-2">
              <UserCheck className="w-3 h-3" /> Requires manual click to proceed.
            </div>
          </div>
        </div>
      )
    },
    // Slide 10: Knowledge Freshness
    {
      title: "The Knowledge Gardener.",
      tagline: "Proactively pruning outdated runbooks to avoid human mistakes.",
      content: (
        <div className="grid md:grid-cols-2 gap-12 mt-16 w-full items-center">
          <div className="space-y-6">
            <p className="text-zinc-600 text-lg leading-relaxed font-sans">
              As infrastructure changes, older runbooks naturally drift. Our **Knowledge Freshness Service** acts as an automatic background gardener.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center font-mono text-xs font-bold text-zinc-700">1</span>
                <div>
                  <h5 className="font-bold text-zinc-900 font-sans text-sm">Conflict Detection</h5>
                  <p className="text-xs text-zinc-500 font-sans">Detects contradictions between newly written post-mortems and older vector runbooks.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center font-mono text-xs font-bold text-zinc-700">2</span>
                <div>
                  <h5 className="font-bold text-zinc-900 font-sans text-sm">Synthesis Draft</h5>
                  <p className="text-xs text-zinc-500 font-sans">SynthesisAgent automatically writes a unified runbook draft for Lead approval.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 p-8 rounded-xl space-y-4 shadow-sm">
            <h4 className="text-sm font-mono tracking-[0.04em] text-zinc-400 uppercase">Knowledge Base Conflict Resolution</h4>
            <div className="border border-zinc-200 rounded-lg p-4 bg-white space-y-3 font-sans text-xs">
              <p className="text-red-500 font-semibold flex items-center gap-1">
                <span>⚠️ Conflict:</span> Old Runbook vs. Incident INC-2026
              </p>
              <div className="grid grid-cols-2 gap-4 text-[10px] font-mono p-2 bg-zinc-50 rounded">
                <div>
                  <span className="text-zinc-400">2022 Runbook:</span>
                  <p className="text-zinc-600 mt-1">Scale up replica count</p>
                </div>
                <div className="border-l border-zinc-200 pl-4">
                  <span className="text-zinc-400">2026 Post-Mortem:</span>
                  <p className="text-zinc-900 mt-1 font-semibold">Increase pool limit to 40</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] text-zinc-400">Synthesis draft ready</span>
                <span className="text-[10px] font-mono text-blue-600 uppercase font-bold">Approve Synthesis &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 11: ROI & Value
    {
      title: "The Business Value.",
      tagline: "Measurable impact on reliability and team health.",
      content: (
        <div className="grid md:grid-cols-3 gap-8 mt-16 w-full">
          <div className="space-y-4">
            <h4 className="text-3xl font-bold text-zinc-950 font-sans tracking-tight">-80% MTTR</h4>
            <h5 className="text-sm font-bold text-zinc-900 font-sans uppercase tracking-widest text-blue-600">Faster Resolution</h5>
            <p className="text-sm text-zinc-600 leading-relaxed font-sans">
              Eliminating the initial 45 minutes of context-gathering. The agent provides the state, the history, and the plan immediately.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-3xl font-bold text-zinc-950 font-sans tracking-tight">100%</h4>
            <h5 className="text-sm font-bold text-zinc-900 font-sans uppercase tracking-widest text-blue-600">Knowledge Retention</h5>
            <p className="text-sm text-zinc-600 leading-relaxed font-sans">
              No more lost lessons. Every incident generates a blameless post-mortem and automatically updates the Qdrant knowledge base.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-3xl font-bold text-zinc-950 font-sans tracking-tight">Zero</h4>
            <h5 className="text-sm font-bold text-zinc-900 font-sans uppercase tracking-widest text-blue-600">Rogue Actions</h5>
            <p className="text-sm text-zinc-600 leading-relaxed font-sans">
              Enterprise-grade safety. Mastra suspend logic and Enkrypt AI guardrails guarantee that AI never modifies infrastructure unchecked.
            </p>
          </div>
        </div>
      )
    },
    // Slide 12: Conclusion
    {
      title: "Always available. Always accurate.",
      tagline: "The future of Site Reliability Engineering.",
      content: (
        <div className="flex flex-col items-center justify-center mt-20 w-full text-center space-y-8">
          <p className="text-zinc-600 text-xl max-w-2xl leading-relaxed font-sans font-light">
            Runbook Sentinel doesn't replace engineers. It removes the toil of context gathering, protects them from stale documentation, and empowers them to make critical decisions with perfect historical memory.
          </p>
          <div className="pt-8 flex gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md font-mono text-sm tracking-[0.04em] transition-all uppercase shadow-elevated">
              Experience the War Room <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const slide = slides[currentSlide];

  return (
    <div className="min-h-screen bg-white text-zinc-900 relative overflow-hidden flex flex-col justify-between p-8 md:p-16 select-none font-sans">
      {/* Background Soft Ambient Glow Accents (Apple/DeepMind style) */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-blue-300/10 via-cyan-300/5 to-violet-300/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-violet-300/10 via-cyan-300/5 to-blue-300/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          <span className="font-bold text-zinc-900 tracking-tight text-sm font-sans uppercase">Runbook Sentinel</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xs font-mono tracking-[0.08em] text-zinc-500 hover:text-zinc-950 transition-colors uppercase">
            War Room &rarr;
          </Link>
        </div>
      </header>

      {/* Main Slide Container */}
      <main className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full relative z-10 py-12 md:py-20">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-950 font-sans max-w-2xl">
            {slide.title}
          </h2>
          <p className="text-md font-mono tracking-[0.04em] text-blue-600 uppercase font-semibold">
            {slide.tagline}
          </p>
        </div>

        {/* Slide Body */}
        <div className="w-full flex-1 flex items-center min-h-[320px]">
          {slide.content}
        </div>
      </main>

      {/* Footer controls */}
      <footer className="flex justify-between items-center relative z-10 pt-8 border-t border-zinc-100">
        <div className="text-xs font-mono text-zinc-400">
          Slide {currentSlide + 1} of {slides.length}
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrev}
            className="w-10 h-10 border border-zinc-200 rounded-full flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 transition-all active:scale-95"
            aria-label="Previous slide"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleNext}
            className="w-10 h-10 border border-zinc-200 rounded-full flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 transition-all active:scale-95"
            aria-label="Next slide"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.08em] hidden sm:block">
          Use Arrow Keys or Space to navigate
        </div>
      </footer>
    </div>
  );
}
