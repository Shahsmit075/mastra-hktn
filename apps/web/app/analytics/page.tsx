'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SeverityBadge } from '@/components/SeverityBadge';

type WeeklyRow = { service_id: string; week: string; avg_mttr: number; incident_count: number; sev1_count: number };
type P50Row = { service_id: string; p50_mttr: number; total_incidents: number };

export default function AnalyticsPage() {
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);
  const [p50, setP50] = useState<P50Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMttrAnalytics()
      .then(d => { setWeekly(d.weeklyTrend || []); setP50(d.p50ByService || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const services = [...new Set(weekly.map(r => r.service_id))];
  const maxMttr = Math.max(...weekly.map(r => Number(r.avg_mttr)), 1);

  const getServiceSeverity = (serviceId: string) => {
    const serviceWeeks = weekly.filter(w => w.service_id === serviceId);
    const totalSev1 = serviceWeeks.reduce((acc, w) => acc + (Number(w.sev1_count) || 0), 0);
    const totalIncd = serviceWeeks.reduce((acc, w) => acc + (Number(w.incident_count) || 0), 0);
    if (totalSev1 > 0) return 'SEV1';
    if (totalIncd > 0) return 'SEV2';
    return 'HEALTHY';
  };

  const getSeverityColors = (severity: string) => {
    if (severity === 'SEV1') return { bg: 'bg-critical', text: 'text-critical', border: 'border-critical/30', cardBg: 'bg-critical-muted', delta: 'text-critical' };
    if (severity === 'SEV2') return { bg: 'bg-warning', text: 'text-warning', border: 'border-warning/30', cardBg: 'bg-warning-muted', delta: 'text-warning' };
    return { bg: 'bg-healthy', text: 'text-healthy', border: 'border-border-hairline', cardBg: 'bg-surface', delta: 'text-text-muted' };
  };

  return (
    <div className="min-h-screen bg-base p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">MTTR Analytics</h1>
          <p className="text-text-secondary mt-1">90-day rolling trend — Mean Time to Resolve by service</p>
        </div>

        {loading && (
          <div className="h-64 flex items-center justify-center bg-surface border border-border-hairline rounded-xl">
            <p className="text-text-muted animate-pulse font-mono uppercase tracking-[0.04em] text-sm">Loading telemetry...</p>
          </div>
        )}
        
        {error && (
          <div className="h-64 flex flex-col items-center justify-center bg-critical-muted border border-critical/20 rounded-xl">
            <p className="text-critical font-semibold mb-2 font-mono uppercase tracking-[0.04em]">Failed to load analytics</p>
            <p className="text-text-muted text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {p50.length === 0 ? (
                <div className="col-span-full text-text-muted text-center py-12 bg-surface border border-border-hairline rounded-xl font-mono tracking-[0.04em] uppercase text-sm">
                  No resolved incidents detected in the last 90 days.
                </div>
              ) : (
                p50.map((row) => {
                  const severity = getServiceSeverity(row.service_id);
                  const colors = getSeverityColors(severity);
                  return (
                    <div key={row.service_id} className={`bg-surface border ${colors.border} p-5 rounded-xl shadow-sm text-center flex flex-col items-center justify-center transition-transform hover:-translate-y-1 relative overflow-hidden group`}>
                      <div className={`absolute top-0 left-0 w-full h-1 ${colors.bg}`} />
                      <p className="text-xs font-mono font-bold text-text-secondary uppercase tracking-[0.04em] mb-2 truncate w-full">{row.service_id}</p>
                      <p className="text-4xl font-bold text-text-primary tracking-tighter mb-2 font-ui">
                        {Number(row.p50_mttr).toFixed(0)}<span className="text-lg ml-1 opacity-70">m</span>
                      </p>
                      <p className={`text-[10px] font-mono uppercase tracking-[0.04em] ${colors.delta}`}>
                        p50 <span className="mx-1 text-text-muted">•</span> {row.total_incidents} incidents
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Trend Chart */}
            {weekly.length > 0 && (
              <div className="bg-surface border border-border-hairline rounded-xl shadow-sm overflow-hidden mt-8">
                <div className="px-6 py-5 border-b border-border-hairline">
                  <h2 className="text-sm font-semibold text-text-muted uppercase tracking-[0.04em] font-mono">WEEKLY AVERAGE MTTR</h2>
                </div>
                
                <div className="p-6 space-y-6">
                  {services.map((service) => {
                    const serviceData = weekly.filter(r => r.service_id === service);
                    const severity = getServiceSeverity(service);
                    const colors = getSeverityColors(severity);
                    
                    return (
                      <div key={service} className="space-y-3">
                        {serviceData.map((row) => (
                          <div key={row.week} className="flex items-center text-sm group">
                            {/* Y-axis Labels */}
                            <div className="w-32 flex-shrink-0 flex justify-between items-center pr-4">
                              <span className="text-text-primary font-mono text-xs truncate max-w-[80px]" title={service}>
                                {service}
                              </span>
                              <span className="text-text-muted text-[10px] uppercase font-mono">
                                {new Date(row.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            
                            {/* Bar */}
                            <div className="flex-1 flex items-center pr-4 bg-sunken rounded-sm h-6">
                              <div 
                                className={`h-6 ${colors.bg} rounded-sm transition-all duration-1000 ease-out min-w-[2px] opacity-90 group-hover:opacity-100`}
                                style={{ width: `${Math.max(1, (Number(row.avg_mttr) / maxMttr) * 100)}%` }}
                              />
                            </div>
                            
                            {/* Values & Badges */}
                            <div className="w-40 flex-shrink-0 flex items-center justify-end gap-3">
                              <span className="font-bold text-text-primary font-ui text-sm min-w-[40px] text-right">
                                {Number(row.avg_mttr).toFixed(0)}m
                              </span>
                              
                              <div className="flex items-center gap-1 min-w-[70px] justify-end">
                                {row.sev1_count > 0 ? (
                                  <SeverityBadge severity="SEV1" />
                                ) : (
                                  <SeverityBadge severity={row.incident_count > 0 ? "SEV2" : "HEALTHY"} />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
