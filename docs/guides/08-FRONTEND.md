# Guide 08 — Next.js HITL Dashboard

## ⚠️ Before You Start: Install Web Dependencies

Run this from the **repo root** before creating any files:

```bash
npm install --workspace @runbook-sentinel/web \
  tailwindcss@3 postcss autoprefixer \
  lucide-react

# Initialize Tailwind (creates tailwind.config.js + postcss.config.js)
npx --prefix apps/web tailwindcss@3 init -p
```

Update `apps/web/tailwind.config.js` after init:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
```

Also create the `lib/` directory before creating `api.ts`:
```bash
mkdir -p apps/web/lib apps/web/app/incidents/[id] apps/web/app/analytics
```

## Philosophy

The dashboard is NOT a full product UI — it is a demo-optimized interface. Every screen serves one purpose: proving the system works to a judge in under 3 minutes.

Three pages only:
1. **`/`** — Active incidents list (shows live status)
2. **`/incidents/[id]`** — Incident detail + Approve/Reject button
3. **`/analytics`** — MTTR chart (proves knowledge loop works)

## File: `apps/web/lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// For demo: hardcode a test JWT. In production, implement proper auth flow.
const DEMO_TOKEN = process.env.NEXT_PUBLIC_DEMO_TOKEN || 'demo-token-replace-me';

async function apiFetch(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEMO_TOKEN}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Incidents
  getIncidents: () => apiFetch('/v1/incidents'),
  getIncident: (id: string) => apiFetch(`/v1/incidents/${id}`),
  approveIncident: (id: string, approved: boolean, reason?: string) =>
    apiFetch(`/v1/incidents/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason }),
    }),
  ingestIncident: (payload: object) =>
    apiFetch('/v1/incidents', { method: 'POST', body: JSON.stringify(payload) }),

  // Analytics
  getMttrAnalytics: () => apiFetch('/v1/analytics/mttr'),

  // Knowledge
  getConflicts: () => apiFetch('/v1/knowledge/conflicts'),
};
```

## File: `apps/web/app/page.tsx` — Incidents List

```tsx
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
            No incidents yet. Click "Trigger Demo Incident" to start a demo.
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
```

## File: `apps/web/app/incidents/[id]/page.tsx` — Incident Detail

```tsx
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
```

## File: `apps/web/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Runbook Sentinel — SRE Incident Response',
  description: 'AI-powered incident triage, remediation, and post-mortem platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

---

## File: `apps/web/app/globals.css`

> ⚠️ Use Tailwind v3 directives — NOT v4 `@import` syntax.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #030712;
}
```

---

## File: `apps/web/app/analytics/page.tsx`

> Page 3 of 3. Previously missing from the guide. Uses a CSS bar chart — no recharts needed.

```tsx
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
```

