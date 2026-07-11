'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { WorkflowGraph, WorkflowStatus } from '@/components/WorkflowGraph';
import { SeverityBadge } from '@/components/SeverityBadge';

function SpotlightTrace({ reasoning, resolved }: { reasoning: string, resolved: boolean }) {
  const [revealed, setRevealed] = useState<number>(resolved ? 99 : 0);
  
  const beats = useMemo(() => {
    return reasoning.split('. ').map(s => {
      let label = 'Insight';
      if (s.toLowerCase().includes('error rate') || s.toLowerCase().includes('latency')) label = 'Signal';
      else if (s.toLowerCase().includes('burn rate') || s.toLowerCase().includes('pool') || s.toLowerCase().includes('slo')) label = 'Threshold';
      else if (s.toLowerCase().includes('justify') || s.toLowerCase().includes('sev') || s.toLowerCase().includes('confidence')) label = 'Conclusion';
      return { label, detail: s.trim().replace(/\.$/, '') };
    }).filter(b => b.detail.length > 0);
  }, [reasoning]);

  useEffect(() => {
    if (resolved) return;
    const interval = setInterval(() => {
      setRevealed(r => {
        if (r >= beats.length) {
          clearInterval(interval);
          return r;
        }
        return r + 1;
      });
    }, 480);
    return () => clearInterval(interval);
  }, [beats.length, resolved]);

  return (
    <div className="bg-surface border border-border-strong rounded-xl shadow-elevated overflow-hidden flex flex-col font-mono text-sm">
      {/* BACKSTAGE */}
      <div 
        className="bg-sunken px-4 py-2 border-b border-border-hairline text-text-muted text-xs flex gap-4 overflow-hidden relative"
        style={{ WebkitMaskImage: 'linear-gradient(to right, black 80%, transparent 100%)', maskImage: 'linear-gradient(to right, black 80%, transparent 100%)' }}
      >
         <div className="animate-[pulse_4s_infinite] whitespace-nowrap">
           p99=4.2s  err=0.08%  pool=19/20  cpu=78%  mem=2.1GB  req/s=1024  active_conns=842  latency_ms=4200
         </div>
      </div>
      
      {/* SPOTLIGHT */}
      <div className="p-4 space-y-3 min-h-[120px]">
         {beats.map((beat, i) => {
           const isVisible = i < revealed || resolved;
           const isCurrent = i === revealed - 1 && !resolved;
           if (!isVisible) return null;
           
           return (
             <div key={i} className={`flex items-start gap-3 transition-opacity duration-slow ${isCurrent ? 'opacity-100' : 'opacity-70'}`}>
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-accent shadow-[0_0_8px_var(--accent-muted)]' : 'bg-text-muted'}`} />
                <div className="flex flex-col sm:flex-row sm:gap-2 sm:items-start">
                  <span className={`font-bold uppercase tracking-[0.04em] min-w-[80px] ${isCurrent ? 'text-accent' : 'text-text-muted'}`}>{beat.label}</span>
                  <span className={`text-xs sm:text-sm ${isCurrent ? 'text-text-primary' : 'text-text-secondary'} max-w-[280px]`}>{beat.detail}</span>
                </div>
             </div>
           );
         })}
      </div>
    </div>
  );
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const data = await api.getIncident(id);
      setIncident(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [id]);

  async function handleDecision(approved: boolean) {
    setApproving(true);
    try {
      await api.approveIncident(id, approved, approved ? undefined : 'IC rejected — re-planning');
      setMessage(approved ? 'Plan approved! Executing remediation...' : 'Plan rejected. Incident marked failed.');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-base text-text-muted flex items-center justify-center font-mono tracking-[0.04em] uppercase text-sm">INITIALIZING_FEED...</div>;
  if (!incident) return <div className="min-h-screen bg-base text-critical flex items-center justify-center font-mono tracking-[0.04em] uppercase text-sm">INCIDENT_NOT_FOUND</div>;

  const plan = incident.workflow?.remediationPlan;
  const triage = incident.workflow?.triageResult;

  return (
    <div className="min-h-screen bg-base p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div>
          <button onClick={() => router.push('/dashboard')} className="text-text-muted hover:text-text-primary transition-colors text-sm font-medium flex items-center gap-2 mb-6 font-ui">
            &larr; Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary font-ui">{incident.service_id}</h1>
            <SeverityBadge severity={incident.severity} />
          </div>
        </div>

        {/* Workflow Visualization */}
        <div className="bg-surface border border-border-hairline rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-6 text-text-muted uppercase tracking-[0.04em] font-mono">Automated Remediation Workflow</h2>
          <WorkflowGraph status={incident.status as WorkflowStatus} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Remediation Plan */}
            {plan && (
              <div className="bg-surface border border-border-hairline rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border-hairline bg-elevated flex items-center gap-3">
                  <span className="w-2 h-2 bg-info rounded-full" />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-[0.04em] font-mono">Proposed Remediation Plan</h2>
                </div>
                
                <div className="p-6">
                  <div className="mb-6 p-4 bg-sunken rounded-lg border border-border-hairline">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-[0.04em] font-mono mb-2">Executive Summary</p>
                    <p className="text-sm text-text-primary leading-relaxed font-ui">{plan.executive_summary}</p>
                  </div>
                  
                  <div className="space-y-4">
                    {plan.steps?.map((step: any, i: number) => (
                      <div key={i} className="border border-border-hairline rounded-lg p-5 hover:border-border-strong transition-colors bg-surface shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold tracking-[0.04em] uppercase bg-elevated border border-border-hairline px-2 py-1 rounded-sm text-text-primary">Step {step.step_number}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-sm tracking-[0.04em] font-mono border ${
                              step.risk_level === 'high_risk' ? 'bg-critical-muted text-critical border-critical/30' :
                              step.risk_level === 'mitigating' ? 'bg-warning-muted text-warning border-warning/30' :
                              'bg-healthy-muted text-healthy border-healthy/30'
                            }`}>{step.risk_level.replace('_', ' ')}</span>
                          </div>
                          {step.requires_hitl && <span className="text-[10px] uppercase font-bold px-2 py-1 tracking-[0.04em] font-mono bg-warning-muted text-warning border border-warning/30 rounded-sm animate-pulse">Requires Approval</span>}
                        </div>
                        
                        <div className="bg-sunken border border-border-strong rounded-sm p-3 mb-4 font-mono text-xs flex justify-between items-start gap-4">
                          <code className="text-text-primary block flex-1 break-all">
                            <span className="text-text-muted select-none mr-3">$</span>
                            {step.action}
                          </code>
                          <span className={`flex-shrink-0 text-[10px] uppercase font-bold tracking-[0.04em] px-2 py-0.5 rounded-sm border ${step.requires_hitl ? 'bg-critical-muted text-critical border-critical/30' : 'bg-info-muted text-info border-info/30'}`}>
                            {step.requires_hitl ? 'Mutates State' : 'Read-Only'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-text-secondary mb-3 font-ui">{step.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-xs font-ui">
                          <span className="text-text-muted"><span className="font-semibold text-text-secondary">Impact:</span> {step.estimated_impact}</span>
                          {step.evidence_refs?.length > 0 && (
                            <span className="text-text-muted"><span className="font-semibold text-text-secondary">Evidence:</span> {step.evidence_refs.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* HITL Approval Buttons */}
            {incident.status === 'awaiting_approval' && (
              <div className="bg-surface border-2 border-warning/50 rounded-xl p-6 shadow-[0_0_15px_var(--warning-muted)]">
                <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-text-primary font-ui">
                  <span className="w-2 h-2 bg-warning animate-ping rounded-full" />
                  Awaiting Authorization
                </h2>
                <p className="text-sm text-text-secondary mb-6 font-ui">Review the remediation plan above. Execution is paused pending your approval.</p>
                {message ? (
                  <div className="p-4 bg-healthy-muted border border-healthy/20 rounded-md text-healthy font-medium text-sm">
                    {message}
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleDecision(true)}
                      disabled={approving}
                      className="flex-1 bg-text-primary text-text-on-accent hover:opacity-90 disabled:opacity-50 font-bold text-sm py-3 rounded-md transition-all shadow-sm font-ui"
                    >
                      {approving ? 'Authorizing...' : 'Approve Plan'}
                    </button>
                    <button
                      onClick={() => handleDecision(false)}
                      disabled={approving}
                      className="flex-1 bg-transparent border border-border-strong hover:bg-critical-muted hover:border-critical/50 hover:text-critical text-text-primary disabled:opacity-50 font-bold text-sm py-3 rounded-md transition-all font-ui"
                    >
                      Reject Plan
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar / Reasoning Column */}
          <div className="space-y-8">
            {triage && (
              <>
                {/* Triage Assessment KPI */}
                <div className="bg-surface border border-border-hairline rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold mb-6 text-text-primary flex items-center gap-2 font-mono uppercase tracking-[0.04em]">
                    <span className="w-2 h-2 bg-accent rounded-full" />
                    Triage Assessment
                  </h2>
                  <div className="space-y-4 font-ui">
                    <div className="flex justify-between items-center pb-4 border-b border-border-hairline">
                      <span className="text-sm text-text-secondary">Confidence</span>
                      <span className="font-bold text-text-primary">{(triage.confidence_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-border-hairline">
                      <span className="text-sm text-text-secondary">Burn Rate</span>
                      <span className="font-bold text-text-primary">{triage.error_budget_burn_rate?.toFixed(1)}x</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-border-hairline">
                      <span className="text-sm text-text-secondary">Customer Impact</span>
                      <span className="font-bold text-text-primary capitalize">{triage.customer_impact?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">SLO At Risk</span>
                      <span className={`font-bold ${triage.slo_at_risk ? 'text-critical' : 'text-healthy'}`}>
                        {triage.slo_at_risk ? 'YES' : 'NO'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Spotlight Trace (Replaces CoT Block) */}
                <SpotlightTrace reasoning={triage.reasoning} resolved={incident.status === 'resolved'} />
              </>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
