const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEMO_TOKEN = process.env.NEXT_PUBLIC_DEMO_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRlbW8taWMtMDAxIiwicm9sZSI6ImluY2lkZW50X2NvbW1hbmRlciIsImVtYWlsIjoiaWNAcnVuYm9vay1zZW50aW5lbC5pbyIsImlhdCI6MTc4Mzc2MDkzMiwiZXhwIjoxODE1Mjk2OTMyfQ.FwNfUW77RcHJevKTCcy7zJ0xnj_ycmsbC8N9JS5MzV0';

async function apiFetch(path: string, options?: RequestInit) {
  // Let's generate a proper token with the actual JWT_SECRET for the API calls
  const token = DEMO_TOKEN; 
  
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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
