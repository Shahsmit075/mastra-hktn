'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Filter } from 'lucide-react';
import { SeverityBadge } from '@/components/SeverityBadge';

type Incident = {
  id: string;
  status: string;
  severity: string | null;
  service_id: string;
  correlation_id: string;
  created_at: string;
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [triggering, setTriggering] = useState(false);
  
  // Filter state
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  async function load() {
    try {
      const data = await api.getIncidents();
      setIncidents(data.incidents || []);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load incidents');
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

  const getSeveritySpineClass = (severity: string | null) => {
    if (!severity) return 'border-l-border-hairline';
    if (severity === 'SEV1') return 'border-l-critical';
    if (severity === 'SEV2') return 'border-l-warning';
    return 'border-l-healthy';
  };
  
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'awaiting_approval') {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-sm font-mono text-xs uppercase tracking-[0.04em] border bg-info-muted text-info border-info/25">
          {s.replace(/_/g, ' ')}
        </span>
      );
    }
    if (s === 'executing' || s === 'triaging') {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-sm font-mono text-xs uppercase tracking-[0.04em] border bg-accent-muted text-accent border-accent/25 gap-1">
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          {s.replace(/_/g, ' ')}
        </span>
      );
    }
    if (s === 'resolved') {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-sm font-mono text-xs uppercase tracking-[0.04em] border bg-healthy-muted text-healthy border-healthy/25">
          {s}
        </span>
      );
    }
    if (s === 'failed') {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-sm font-mono text-xs uppercase tracking-[0.04em] border bg-critical-muted text-critical border-critical/25">
          {s}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-sm font-mono text-xs uppercase tracking-[0.04em] border bg-neutral/10 text-text-muted border-neutral/25">
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  const filteredIncidents = incidents.filter(i => {
    if (filterSeverity !== 'ALL' && i.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && i.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-base p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Live Incident Monitoring</h1>
            <p className="text-text-secondary mt-1">Real-time tracking of degraded infrastructure and active alerts.</p>
          </div>
          <button
            onClick={triggerDemoIncident}
            disabled={triggering}
            className="px-4 py-2 bg-text-primary text-text-on-accent font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
          >
            {triggering ? 'Injecting Alert...' : 'Simulate Incident'}
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-surface border border-border-hairline rounded-xl shadow-sm overflow-hidden">
          
          {/* Sticky Filter Bar */}
          <div className="px-6 py-3 border-b border-border-hairline bg-bg-elevated flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-text-primary uppercase tracking-[0.04em] font-mono flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" /> Filter by:
              </span>
              <div className="flex gap-2">
                <select 
                  value={filterSeverity} 
                  onChange={e => setFilterSeverity(e.target.value)}
                  className="text-xs font-mono tracking-[0.04em] uppercase text-text-muted bg-base px-2 py-1 rounded-sm border border-border-strong cursor-pointer hover:border-accent appearance-none outline-none pr-6 relative"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .5rem top 50%', backgroundSize: '.65rem auto' }}
                >
                  <option value="ALL">Severity (All)</option>
                  <option value="SEV1">SEV1</option>
                  <option value="SEV2">SEV2</option>
                  <option value="SEV3">SEV3</option>
                </select>

                <select 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)}
                  className="text-xs font-mono tracking-[0.04em] uppercase text-text-muted bg-base px-2 py-1 rounded-sm border border-border-strong cursor-pointer hover:border-accent appearance-none outline-none pr-6 relative"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .5rem top 50%', backgroundSize: '.65rem auto' }}
                >
                  <option value="ALL">Status (All)</option>
                  <option value="awaiting_approval">Awaiting Approval</option>
                  <option value="executing">Executing</option>
                  <option value="resolved">Resolved</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.04em] text-text-muted bg-base px-2 py-1 rounded-sm border border-border-hairline hidden md:block">
              Auto-sync active
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-text-muted animate-pulse font-mono uppercase tracking-[0.04em] text-sm">Loading feed...</div>
            ) : error ? (
              <div className="p-12 text-center text-critical bg-critical-muted">
                <span className="font-semibold font-mono tracking-[0.04em] uppercase">Error:</span> {error}
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-16 text-center text-text-muted font-mono tracking-[0.04em]">
                <p className="uppercase text-sm">No incidents match criteria.</p>
                {incidents.length === 0 && <p className="text-xs mt-2 text-text-secondary">Infrastructure is nominal.</p>}
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-base border-b border-border-strong text-text-muted font-medium font-mono uppercase tracking-[0.04em] text-xs">
                  <tr>
                    <th className="px-6 py-4">Service</th>
                    <th className="px-6 py-4">Severity</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Detected</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline">
                  {filteredIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-elevated transition-colors group">
                      <td className={`px-6 py-4 font-mono font-bold text-text-primary border-l-[3px] ${getSeveritySpineClass(incident.severity)}`}>
                        {incident.service_id}
                      </td>
                      <td className="px-6 py-4">
                        <SeverityBadge severity={incident.severity} />
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(incident.status)}
                      </td>
                      <td className="px-6 py-4 text-text-secondary font-mono text-xs tracking-[0.04em]">
                        {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="text-info hover:text-text-primary font-mono text-xs uppercase tracking-[0.04em] font-bold transition-colors"
                        >
                          View &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
