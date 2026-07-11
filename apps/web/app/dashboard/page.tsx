'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

type Incident = {
  id: string;
  status: string;
  severity: string | null;
  service_id: string;
  correlation_id: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  open: 'text-gray-500',
  triaging: 'text-amber animate-pulse font-mono',
  awaiting_approval: 'text-medium animate-pulse font-mono',
  awaiting_manual_review: 'text-high font-mono',
  executing: 'text-low animate-pulse font-mono',
  post_mortem: 'text-indigo-400 font-mono',
  resolved: 'text-green-500 font-mono',
  failed: 'text-critical font-mono',
};

const SEVERITY_BADGES: Record<string, string> = {
  SEV1: 'bg-critical text-background shadow-[0_0_8px_rgba(255,69,69,0.4)]',
  SEV2: 'bg-high text-background shadow-[0_0_8px_rgba(255,143,0,0.4)]',
  SEV3: 'bg-medium text-background',
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [triggering, setTriggering] = useState(false);

  async function load() {
    try {
      const data = await api.getIncidents();
      setIncidents(data.incidents || []);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
      load();
    } catch (err) {
      console.error('Failed to trigger demo incident:', err);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background Decorators */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-surface to-background pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-amber" />
      
      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">WAR_ROOM_FEED</h1>
            <p className="text-gray-400 font-mono text-sm uppercase tracking-widest">LIVE_INCIDENT_MONITORING</p>
          </div>
          
          <button
            onClick={triggerDemoIncident}
            disabled={triggering}
            className="group relative px-6 py-3 bg-surface border border-gray-800 hover:border-amber/50 disabled:opacity-50 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-critical/10 translate-y-full group-hover:translate-y-0 transition-transform" />
            <span className="relative z-10 font-mono text-sm tracking-wide">
              {triggering ? 'INJECTING_ALERT...' : 'TRIGGER_DEMO_INCIDENT'}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-12 font-mono text-sm">INITIALIZING_FEED...</div>
        ) : error ? (
          <div className="text-critical text-center py-16 bg-critical/10 border border-critical/50 backdrop-blur-sm">
            <span className="font-mono text-sm">API_ERROR: {error}</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="text-gray-500 text-center py-16 bg-surface/50 border border-gray-800/50 backdrop-blur-sm">
            <span className="font-mono text-sm">AWAITING_TELEMETRY</span>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map(incident => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="group block p-5 bg-surface border border-gray-800 hover:border-amber/50 transition-all shadow-lg shadow-black/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-1.5 bg-gray-600 rounded-full group-hover:bg-amber transition-colors" />
                    <span className="font-semibold tracking-wide">{incident.service_id}</span>
                    {incident.severity && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider ${SEVERITY_BADGES[incident.severity] || 'bg-gray-700 text-gray-300'}`}>
                        {incident.severity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className={`text-xs uppercase tracking-wider ${STATUS_STYLES[incident.status] || 'text-gray-500 font-mono'}`}>
                      [{incident.status.replace(/_/g, ' ')}]
                    </span>
                    <span className="font-mono text-gray-500 text-xs">
                      {new Date(incident.created_at).toLocaleTimeString([], { hour12: false })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-gray-800 flex justify-between items-center">
          <Link href="/analytics" className="text-sm font-mono text-gray-400 hover:text-amber transition-colors">
            ACCESS_MTTR_ANALYTICS →
          </Link>
          <div className="text-xs font-mono text-gray-600">SYSTEM_STATUS: NOMINAL</div>
        </div>
      </div>
    </div>
  );
}
