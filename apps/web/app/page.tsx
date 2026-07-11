'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

type Incident = {
  id: string;
  status: string;
  severity: string | null;
  service_id: string;
  correlation_id: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-500',
  triaging: 'bg-blue-500 animate-pulse',
  awaiting_approval: 'bg-yellow-500 animate-pulse',
  awaiting_manual_review: 'bg-orange-500',
  executing: 'bg-purple-500 animate-pulse',
  post_mortem: 'bg-indigo-500',
  resolved: 'bg-green-500',
  failed: 'bg-red-500',
};

const SEVERITY_COLORS: Record<string, string> = {
  SEV1: 'text-red-400 border-red-400',
  SEV2: 'text-orange-400 border-orange-400',
  SEV3: 'text-yellow-400 border-yellow-400',
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  async function load() {
    try {
      const data = await api.getIncidents();
      setIncidents(data.incidents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Auto-refresh every 5 seconds
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function triggerDemoIncident() {
    setTriggering(true);
    try {
      await api.ingestIncident({
        source: 'prometheus',
        service_id: 'payments-service',
        alert_name: 'HighErrorRate',
        description: 'Payments service error rate is 8.2%. P99 latency: 4.2s. Connection pool exhausted.',
        metrics: { error_rate: 0.082, p99_latency_ms: 4200, pool_used: 19, pool_max: 20 },
        labels: { env: 'production', region: 'us-east-1' },
      });
      setTimeout(load, 1000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to trigger demo incident: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Runbook Sentinel</h1>
            <p className="text-gray-400 mt-1">AI-powered SRE Incident Response</p>
          </div>
          <button
            onClick={triggerDemoIncident}
            disabled={triggering}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {triggering ? 'Triggering...' : 'Trigger Demo Incident'}
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-12">Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <div className="text-gray-400 text-center py-12 border border-gray-800 rounded-lg">
            No incidents yet. Click &quot;Trigger Demo Incident&quot; to start a demo.
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map(incident => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[incident.status] || 'bg-gray-500'}`} />
                    <span className="font-medium text-white">{incident.service_id}</span>
                    {incident.severity && (
                      <span className={`text-xs font-bold border px-2 py-0.5 rounded ${SEVERITY_COLORS[incident.severity] || ''}`}>
                        {incident.severity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="capitalize">{incident.status.replace(/_/g, ' ')}</span>
                    <span>{new Date(incident.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Link href="/analytics" className="text-sm text-blue-400 hover:text-blue-300">MTTR Analytics →</Link>
        </div>
      </div>
    </div>
  );
}
