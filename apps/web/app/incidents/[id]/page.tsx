'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

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
      setTimeout(() => router.push('/'), 2000);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading...</div>;
  if (!incident) return <div className="min-h-screen bg-gray-950 text-red-400 flex items-center justify-center">Incident not found</div>;

  const plan = incident.workflow?.remediationPlan;
  const triage = incident.workflow?.triageResult;

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background Decorators */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-surface to-background pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-amber" />
      
      <div className="max-w-3xl mx-auto px-6 py-12 relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/')} className="text-gray-500 hover:text-amber transition-colors font-mono text-sm uppercase tracking-wider">
            [← BACK_TO_FEED]
          </button>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">{incident.service_id}</h1>
          {incident.severity && (
            <span className={`text-xs font-bold px-3 py-1 uppercase tracking-wider ${
              incident.severity === 'SEV1' ? 'bg-critical text-background shadow-[0_0_12px_rgba(255,69,69,0.5)]' :
              incident.severity === 'SEV2' ? 'bg-high text-background shadow-[0_0_12px_rgba(255,143,0,0.5)]' :
              'bg-medium text-background'
            }`}>
              {incident.severity}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="bg-surface/80 border border-gray-800 rounded-none p-5 mb-6 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber/50 group-hover:bg-amber transition-colors" />
          <p className="text-gray-500 text-xs font-mono uppercase tracking-wider mb-1">CURRENT_STATUS</p>
          <p className="text-amber font-mono text-lg uppercase tracking-widest animate-pulse">
            [{incident.status?.replace(/_/g, ' ')}]
          </p>
        </div>

        {/* Triage Result */}
        {triage && (
          <div className="bg-surface border border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <span className="w-2 h-2 bg-amber rounded-full" />
              TRIAGE_ASSESSMENT
            </h2>
            <div className="grid grid-cols-2 gap-px bg-gray-800 border border-gray-800 mb-6">
              <div className="bg-surface p-4">
                <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">Confidence</p>
                <p className="text-xl font-mono text-foreground mt-1">{(triage.confidence_score * 100).toFixed(0)}%</p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">Burn Rate</p>
                <p className="text-xl font-mono text-foreground mt-1">{triage.error_budget_burn_rate?.toFixed(1)}x</p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">Customer Impact</p>
                <p className="text-lg font-mono text-foreground uppercase mt-1">{triage.customer_impact?.replace(/_/g, ' ')}</p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">SLO At Risk</p>
                <p className={`text-xl font-mono mt-1 ${triage.slo_at_risk ? 'text-critical shadow-critical/20' : 'text-green-500'}`}>
                  {triage.slo_at_risk ? 'YES' : 'NO'}
                </p>
              </div>
            </div>
            <div className="p-4 bg-background border border-gray-800/50">
              <p className="text-amber text-xs font-mono uppercase tracking-wider mb-2">AGENT_REASONING_CoT</p>
              <p className="text-sm text-gray-400 leading-relaxed font-sans">{triage.reasoning}</p>
            </div>
          </div>
        )}

        {/* Remediation Plan */}
        {plan && (
          <div className="bg-surface border border-gray-800 p-6 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <h2 className="text-8xl font-black italic">PLAN</h2>
            </div>
            
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 relative z-10">
              <span className="w-2 h-2 bg-high rounded-full" />
              REMEDIATION_PLAN
            </h2>
            <div className="p-4 bg-background border border-gray-800/50 mb-6 relative z-10">
              <p className="text-high text-xs font-mono uppercase tracking-wider mb-2">EXECUTIVE_SUMMARY</p>
              <p className="text-sm text-gray-300 font-sans leading-relaxed">{plan.executive_summary}</p>
            </div>
            <div className="space-y-4 relative z-10">
              {plan.steps?.map((step: any, i: number) => (
                <div key={i} className="border border-gray-800 bg-background/50 p-5 group hover:border-gray-600 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-amber text-sm font-mono bg-amber/10 px-2 py-1">STEP_{step.step_number}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 tracking-wider ${
                      step.risk_level === 'high_risk' ? 'bg-critical/20 text-critical border border-critical/30' :
                      step.risk_level === 'mitigating' ? 'bg-medium/20 text-medium border border-medium/30' :
                      'bg-green-500/20 text-green-400 border border-green-500/30'
                    }`}>{step.risk_level.replace('_', ' ')}</span>
                    {step.requires_hitl && <span className="text-[10px] uppercase font-bold px-2 py-1 tracking-wider bg-high/20 text-high border border-high/30 animate-pulse">REQ_APPROVAL</span>}
                  </div>
                  <code className="block text-xs font-mono bg-[#0a0a0a] border border-gray-800 p-3 text-gray-300 mb-4 overflow-x-auto shadow-inner">
                    <span className="text-gray-600 select-none mr-2">$</span>
                    {step.action}
                  </code>
                  <p className="text-sm text-gray-400 font-sans mb-2">{step.description}</p>
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-800/50">
                    <p className="text-xs font-mono text-gray-500"><span className="text-gray-600">IMPACT:</span> {step.estimated_impact}</p>
                    {step.evidence_refs?.length > 0 && (
                      <p className="text-xs font-mono text-low"><span className="text-gray-600">EVIDENCE:</span> {step.evidence_refs.join(', ')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HITL Approval Buttons */}
        {incident.status === 'awaiting_approval' && (
          <div className="bg-surface border border-high/50 p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-high/5 animate-pulse pointer-events-none" />
            <h2 className="text-lg font-bold mb-4 flex items-center gap-3 font-mono text-high relative z-10">
              <span className="w-2 h-2 bg-high animate-ping rounded-full" />
              AWAITING_IC_AUTHORIZATION
            </h2>
            {message ? (
              <p className="text-green-400 font-mono text-sm uppercase tracking-wider relative z-10">&gt; {message}</p>
            ) : (
              <div className="flex gap-4 relative z-10">
                <button
                  onClick={() => handleDecision(true)}
                  disabled={approving}
                  className="flex-1 bg-green-600/10 border border-green-600 hover:bg-green-600/20 hover:border-green-400 hover:shadow-[0_0_15px_rgba(22,163,74,0.3)] disabled:opacity-50 text-green-400 font-mono text-sm py-4 transition-all uppercase tracking-wider"
                >
                  {approving ? 'AUTHORIZING...' : 'AUTHORIZE_PLAN'}
                </button>
                <button
                  onClick={() => handleDecision(false)}
                  disabled={approving}
                  className="flex-1 bg-critical/10 border border-critical hover:bg-critical/20 hover:border-red-400 hover:shadow-[0_0_15px_rgba(255,69,69,0.3)] disabled:opacity-50 text-critical font-mono text-sm py-4 transition-all uppercase tracking-wider"
                >
                  REJECT_PLAN
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
