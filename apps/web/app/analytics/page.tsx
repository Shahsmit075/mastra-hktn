'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

type WeeklyRow = { service_id: string; week: string; avg_mttr: number; incident_count: number; sev1_count: number };
type P50Row = { service_id: string; p50_mttr: number; total_incidents: number };

const COLORS = ['#E8A838', '#f59e0b', '#d97706', '#b45309', '#78350f']; // Amber variations

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

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-surface to-background pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-amber" />
      
      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">OPERATIONAL_ANALYTICS</h1>
            <p className="text-gray-400 font-mono text-sm uppercase tracking-widest">90-DAY_TREND_ANALYSIS</p>
          </div>
          <Link href="/dashboard" className="text-gray-500 hover:text-amber transition-colors font-mono text-sm uppercase tracking-wider group flex items-center gap-2">
            <span className="group-hover:-translate-x-1 transition-transform">←</span> BACK_TO_WAR_ROOM
          </Link>
        </div>

        {loading && (
          <div className="h-64 flex items-center justify-center border border-gray-800 bg-surface/50 backdrop-blur-sm">
            <p className="text-amber font-mono animate-pulse uppercase tracking-widest text-sm">FETCHING_TELEMETRY...</p>
          </div>
        )}
        
        {error && (
          <div className="h-64 flex flex-col items-center justify-center border border-critical/50 bg-critical/10 backdrop-blur-sm">
            <p className="text-critical font-mono uppercase tracking-widest mb-2">QUERY_FAILED</p>
            <p className="text-gray-400 text-sm font-mono">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
              {p50.length === 0
                ? <div className="col-span-3 text-gray-500 font-mono text-center py-16 border border-gray-800 bg-surface/50 backdrop-blur-sm uppercase tracking-widest text-sm">NO_RESOLVED_INCIDENTS_DETECTED</div>
                : p50.map((row, i) => (
                    <div key={row.service_id} className="bg-surface border border-gray-800 p-6 relative group overflow-hidden transition-colors hover:border-amber/50">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gray-800 group-hover:bg-amber transition-colors" />
                      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mb-4 truncate">{row.service_id}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-5xl font-bold text-amber tracking-tighter">
                          {Number(row.p50_mttr).toFixed(0)}<span className="text-xl text-amber/60 ml-1">m</span>
                        </p>
                      </div>
                      <p className="text-gray-500 font-mono text-[10px] mt-4 uppercase tracking-widest flex items-center justify-between">
                        <span>P50_MTTR</span>
                        <span className="text-gray-400 px-2 py-0.5 bg-gray-900 rounded-sm border border-gray-800">
                          {row.total_incidents} INCIDENTS
                        </span>
                      </p>
                    </div>
                  ))}
            </div>

            {/* Trend Chart */}
            {weekly.length > 0 && (
              <div className="bg-surface border border-gray-800 p-8 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber to-transparent opacity-50" />
                <h2 className="text-sm font-bold mb-8 font-mono text-gray-400 uppercase tracking-widest">WEEKLY_AVERAGE_MTTR</h2>
                
                <div className="space-y-8">
                  {services.map((service) => {
                    const serviceData = weekly.filter(r => r.service_id === service);
                    return (
                      <div key={service} className="space-y-3">
                        <h3 className="text-gray-300 font-mono text-xs uppercase tracking-widest border-b border-gray-800 pb-2">{service}</h3>
                        <div className="space-y-3 pt-2">
                          {serviceData.map((row) => (
                            <div key={row.week} className="flex items-center text-sm font-mono group">
                              <div className="w-24 text-gray-500 text-xs">{new Date(row.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                              <div className="flex-1 ml-4 relative h-6 bg-gray-900 border border-gray-800/50 rounded-r-sm overflow-hidden flex items-center">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber/40 to-amber/80 transition-all duration-1000 ease-out flex items-center justify-end px-2"
                                  style={{ width: `${(Number(row.avg_mttr) / maxMttr) * 100}%` }}
                                >
                                  {Number(row.avg_mttr) > (maxMttr * 0.1) && (
                                    <span className="text-[10px] text-gray-900 font-bold mix-blend-plus-lighter">{Number(row.avg_mttr).toFixed(1)}m</span>
                                  )}
                                </div>
                                {Number(row.avg_mttr) <= (maxMttr * 0.1) && (
                                  <span className="text-[10px] text-amber ml-2 font-bold">{Number(row.avg_mttr).toFixed(1)}m</span>
                                )}
                              </div>
                              <div className="w-48 text-right text-gray-500 text-[10px] uppercase tracking-widest flex justify-end gap-3">
                                <span>{row.incident_count} INCD</span>
                                {row.sev1_count > 0 && <span className="text-critical">{row.sev1_count} SEV1</span>}
                              </div>
                            </div>
                          ))}
                        </div>
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
