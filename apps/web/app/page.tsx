'use client';

import Link from 'next/link';
import { WorkflowGraph } from '@/components/WorkflowGraph';
import { ShieldAlert, Activity, GitCommit, CheckCircle, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background Decorators */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-b from-surface to-background pointer-events-none" />
      <div className="absolute -top-64 -right-64 w-[800px] h-[800px] bg-amber/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Navigation */}
      <nav className="relative z-10 border-b border-gray-800 bg-surface/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-amber w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">Runbook Sentinel</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/analytics" className="text-sm font-mono text-gray-400 hover:text-white transition-colors">ANALYTICS</Link>
            <Link href="/dashboard" className="text-sm font-mono text-amber border border-amber/30 hover:bg-amber/10 px-4 py-2 transition-colors">ENTER_WAR_ROOM</Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-gray-800 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-gray-400 uppercase">System Active & Monitorings</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            Your always-available <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber to-high">AI SRE teammate.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed font-sans">
            Runbook Sentinel accelerates incident triage, validates root causes, and generates remediation plans to keep your applications running optimally. It bridges the gap between observability and resolution with human-in-the-loop safety gates.
          </p>
          
          <div className="flex justify-center gap-4">
            <Link href="/dashboard" className="group relative inline-flex items-center justify-center bg-amber text-background font-bold px-8 py-4 transition-all overflow-hidden hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(232,168,56,0.3)]">
              <span className="relative z-10 font-mono text-sm tracking-wide flex items-center gap-2">
                ENTER THE WAR ROOM <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </section>

        {/* Graph Section */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="bg-surface border border-gray-800 p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber" />
            <h2 className="text-xl font-bold mb-2 font-mono uppercase tracking-wider">Automated Workflow Execution</h2>
            <p className="text-gray-500 text-sm mb-12 font-sans">End-to-end incident lifecycle management powered by Mastra AI Agents.</p>
            
            {/* The Interactive Workflow Graph */}
            <WorkflowGraph status="idle" className="mb-8" />
            
          </div>
        </section>

        {/* Value Props Grid */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-surface border border-gray-800 p-8 hover:border-gray-600 transition-colors">
              <Activity className="text-high w-8 h-8 mb-4" />
              <h3 className="text-lg font-bold mb-3 font-mono">Sub-second Triage</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Instantly analyzes Prometheus metrics and APM traces to calculate error budget burn rates and confidence scores before humans even wake up.</p>
            </div>
            
            <div className="bg-surface border border-gray-800 p-8 hover:border-gray-600 transition-colors">
              <ShieldAlert className="text-medium w-8 h-8 mb-4" />
              <h3 className="text-lg font-bold mb-3 font-mono">Enkrypt Guardrails</h3>
              <p className="text-gray-400 text-sm leading-relaxed">All generated remediation plans are validated through strict LLM guardrails, ensuring no destructive commands (like dropping tables) are ever proposed.</p>
            </div>
            
            <div className="bg-surface border border-gray-800 p-8 hover:border-gray-600 transition-colors">
              <GitCommit className="text-low w-8 h-8 mb-4" />
              <h3 className="text-lg font-bold mb-3 font-mono">Blameless Post-Mortems</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Automatically generates SRE-compliant post-mortems with timeline reconstructions and action items assigned to the correct technical owners.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
