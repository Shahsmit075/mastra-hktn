const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEMO_TOKEN = process.env.NEXT_PUBLIC_DEMO_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRlbW8tdXNlciIsInJvbGUiOiJpbmNpZGVudF9jb21tYW5kZXIiLCJlbWFpbCI6ImljQHJ1bmJvb2stc2VudGluZWwuaW8iLCJpYXQiOjE3ODM4NDA0NTksImV4cCI6MTc4MzkyNjg1OX0.3O_53IuLj2FsWjK38nesrumrnZZ7qukVgnvE6Feas9E';

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
