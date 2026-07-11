const isServer = typeof window === 'undefined';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || (isServer ? 'http://localhost:3001' : '');

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
