'use client';

import Link from 'next/link';
import { WorkflowGraph } from '@/components/WorkflowGraph';
import { ShieldAlert, Activity, GitCommit, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-base text-text-primary">
      {/* Background Decorators */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-b from-surface to-base pointer-events-none" />
      <div className="absolute -top-64 -right-64 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Navigation */}
      <nav className="relative z-10 border-b border-border-hairline bg-surface/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-accent w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">Runbook Sentinel</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/analytics" className="text-sm font-mono tracking-[0.04em] text-text-muted hover:text-text-primary transition-colors uppercase">Analytics</Link>
            <Link href="/dashboard" className="text-sm font-mono tracking-[0.04em] text-accent border border-accent/30 hover:bg-accent-muted px-4 py-2 rounded-md transition-colors uppercase">Enter War Room</Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-surface border border-border-strong mb-8 shadow-elevated">
            <span className="w-2 h-2 rounded-full bg-healthy animate-pulse" />
            <span className="text-xs font-mono tracking-[0.04em] text-text-muted uppercase">System Active & Monitoring</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            Your always-available <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-strong">AI SRE teammate.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto mb-10 leading-relaxed font-sans">
            Runbook Sentinel accelerates incident triage, validates root causes, and generates remediation plans to keep your applications running optimally. It bridges the gap between observability and resolution with human-in-the-loop safety gates.
          </p>
          
          <div className="flex justify-center gap-4">
            <Link href="/dashboard" className="group relative inline-flex items-center justify-center bg-accent text-text-on-accent font-bold px-8 py-4 rounded-md transition-all overflow-hidden hover:scale-105 active:scale-95 shadow-[0_0_20px_var(--accent-muted)]">
              <span className="relative z-10 font-mono text-sm tracking-[0.04em] flex items-center gap-2 uppercase">
                Enter the War Room <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </section>

        {/* Graph Section */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="bg-surface border border-border-strong rounded-xl p-8 relative overflow-hidden shadow-elevated">
            <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
            <h2 className="text-xl font-bold mb-2 font-mono uppercase tracking-[0.04em] text-text-primary">Automated Workflow Execution</h2>
            <p className="text-text-muted text-sm mb-12 font-sans">End-to-end incident lifecycle management powered by Mastra AI Agents.</p>
            
            {/* The Interactive Workflow Graph */}
            <WorkflowGraph status="idle" className="mb-8" />
            
          </div>
        </section>

        {/* Value Props Grid */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-surface border border-border-hairline p-8 rounded-xl hover:border-border-strong transition-colors shadow-sm">
              <div className="w-12 h-12 bg-accent-muted rounded-full flex items-center justify-center mb-6">
                <Activity className="text-accent w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-text-primary">Sub-second Triage</h3>
              <p className="text-text-secondary text-sm leading-relaxed">Instantly analyzes Prometheus metrics and APM traces to calculate error budget burn rates and confidence scores before humans even wake up.</p>
            </div>
            
            <div className="bg-surface border border-border-hairline p-8 rounded-xl hover:border-border-strong transition-colors shadow-sm">
              <div className="w-12 h-12 bg-accent-muted rounded-full flex items-center justify-center mb-6">
                <ShieldAlert className="text-accent w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-text-primary">Enkrypt Guardrails</h3>
              <p className="text-text-secondary text-sm leading-relaxed">All generated remediation plans are validated through strict LLM guardrails, ensuring no destructive commands (like dropping tables) are ever proposed.</p>
            </div>
            
            <div className="bg-surface border border-border-hairline p-8 rounded-xl hover:border-border-strong transition-colors shadow-sm">
              <div className="w-12 h-12 bg-accent-muted rounded-full flex items-center justify-center mb-6">
                <GitCommit className="text-accent w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-text-primary">Blameless Post-Mortems</h3>
              <p className="text-text-secondary text-sm leading-relaxed">Automatically generates SRE-compliant post-mortems with timeline reconstructions and action items assigned to the correct technical owners.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
