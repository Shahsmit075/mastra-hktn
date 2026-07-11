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
    } catch (err: any) {
      console.error(err);
      setMessage(`Failed to load incident details: ${err.message}`);
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
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold">{incident.service_id}</h1>
          {incident.severity && <span className="text-red-400 font-bold border border-red-400 px-2 py-0.5 rounded text-sm">{incident.severity}</span>}
        </div>

        {/* Status */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
          <p className="text-gray-400 text-sm">Status</p>
          <p className="text-white font-semibold capitalize">{incident.status?.replace(/_/g, ' ')}</p>
        </div>

        {/* Triage Result */}
        {triage && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
            <h2 className="text-lg font-semibold mb-3">Triage Assessment</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400">Confidence</p>
                <p className="font-medium">{(triage.confidence_score * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-gray-400">Burn Rate</p>
                <p className="font-medium">{triage.error_budget_burn_rate?.toFixed(1)}x</p>
              </div>
              <div>
                <p className="text-gray-400">Customer Impact</p>
                <p className="font-medium capitalize">{triage.customer_impact?.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-gray-400">SLO At Risk</p>
                <p className={`font-medium ${triage.slo_at_risk ? 'text-red-400' : 'text-green-400'}`}>
                  {triage.slo_at_risk ? 'YES' : 'NO'}
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-gray-800 rounded text-sm text-gray-300">
              <p className="text-gray-400 text-xs mb-1">Agent Reasoning (CoT)</p>
              {triage.reasoning}
            </div>
          </div>
        )}

        {/* Remediation Plan */}
        {plan && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
            <h2 className="text-lg font-semibold mb-3">Remediation Plan</h2>
            <div className="p-3 bg-gray-800 rounded text-sm text-gray-300 mb-4">
              <p className="text-gray-400 text-xs mb-1">Executive Summary</p>
              {plan.executive_summary}
            </div>
            <div className="space-y-3">
              {plan.steps?.map((step: any, i: number) => (
                <div key={i} className="border border-gray-700 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-400 text-sm">Step {step.step_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      step.risk_level === 'high_risk' ? 'bg-red-900 text-red-300' :
                      step.risk_level === 'mitigating' ? 'bg-yellow-900 text-yellow-300' :
                      'bg-green-900 text-green-300'
                    }`}>{step.risk_level}</span>
                    {step.requires_hitl && <span className="text-xs px-2 py-0.5 rounded bg-orange-900 text-orange-300">Requires Approval</span>}
                  </div>
                  <code className="block text-xs bg-gray-950 p-2 rounded text-green-300 mb-2 overflow-x-auto">
                    {step.action}
                  </code>
                  <p className="text-sm text-gray-300">{step.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Impact: {step.estimated_impact}</p>
                  {step.evidence_refs?.length > 0 && (
                    <p className="text-xs text-blue-400 mt-1">Evidence: {step.evidence_refs.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HITL Approval Buttons */}
        {incident.status === 'awaiting_approval' && (
          <div className="bg-gray-900 border border-yellow-600 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">Incident Commander Decision</h2>
            {message ? (
              <p className="text-green-400">{message}</p>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => handleDecision(true)}
                  disabled={approving}
                  className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {approving ? 'Processing...' : 'Approve Plan'}
                </button>
                <button
                  onClick={() => handleDecision(false)}
                  disabled={approving}
                  className="flex-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Reject Plan
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
