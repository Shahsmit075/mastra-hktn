'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

type WeeklyRow = { service_id: string; week: string; avg_mttr: number; incident_count: number; sev1_count: number };
type P50Row = { service_id: string; p50_mttr: number; total_incidents: number };

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

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
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">MTTR Analytics</h1>
            <p className="text-gray-400 mt-1">90-day trend</p>
          </div>
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Incidents</Link>
        </div>

        {loading && <p className="text-gray-400 text-center py-12">Loading...</p>}
        {error && <p className="text-red-400 text-center py-12">Error: {error}</p>}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {p50.length === 0
                ? <div className="col-span-3 text-gray-500 text-center py-8 border border-gray-800 rounded-lg">No resolved incidents yet.</div>
                : p50.map((row, i) => (
                    <div key={row.service_id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                      <p className="text-gray-400 text-xs mb-1">{row.service_id}</p>
                      <p className="text-3xl font-bold" style={{ color: COLORS[i % COLORS.length] }}>
                        {Number(row.p50_mttr).toFixed(0)}m
                      </p>
                      <p className="text-gray-500 text-xs mt-1">p50 · {row.total_incidents} incidents</p>
                    </div>
                  ))}
            </div>

            {weekly.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Weekly Average MTTR</h2>
                <div className="space-y-3">
                  {weekly.map(row => (
                    <div key={`${row.service_id}-${row.week}`} className="flex items-center gap-3">
                      <div className="w-28 text-xs text-gray-400 truncate">{row.service_id}</div>
                      <div className="w-16 text-xs text-gray-500">
                        {new Date(row.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${(Number(row.avg_mttr) / maxMttr) * 100}%`,
                          backgroundColor: COLORS[services.indexOf(row.service_id) % COLORS.length],
                        }} />
                      </div>
                      <div className="w-10 text-right text-sm font-medium">{Number(row.avg_mttr).toFixed(0)}m</div>
                      {Number(row.sev1_count) > 0 && (
                        <span className="text-xs text-red-400 border border-red-800 px-1.5 py-0.5 rounded">{row.sev1_count} S1</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-900 border border-green-900 rounded-lg">
              <p className="text-green-400 text-sm font-medium">Knowledge Loop Active</p>
              <p className="text-gray-400 text-xs mt-1">
                Every resolved incident writes a post-mortem to Qdrant. MTTR trends downward as institutional knowledge accumulates.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
