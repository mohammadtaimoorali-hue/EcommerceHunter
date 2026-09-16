const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  overview: () => request<any>('/overview'),
  products: (params?: { minScore?: number; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.minScore != null) qs.set('minScore', String(params.minScore));
    if (params?.category) qs.set('category', params.category);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<any[]>(`/products${suffix}`);
  },
  listingDrafts: (status?: string) =>
    request<any[]>(`/listing-drafts${status ? `?status=${status}` : ''}`),
  approveDraft: (id: string) => request<any>(`/listing-drafts/${id}/approve`, { method: 'POST' }),
  rejectDraft: (id: string) => request<any>(`/listing-drafts/${id}/reject`, { method: 'POST' }),
  listings: () => request<any[]>('/listings'),
  sources: () => request<any>('/sources'),
  settings: () => request<Record<string, unknown>>('/settings'),
  updateSetting: (key: string, value: unknown) =>
    request<any>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  jobs: () => request<any>('/jobs'),
  triggerJob: (type: string) =>
    request<any>('/jobs/trigger', { method: 'POST', body: JSON.stringify({ type }) }),
  dryRun: (scoreThreshold?: number) =>
    request<any>('/pipeline/dry-run', {
      method: 'POST',
      body: JSON.stringify(scoreThreshold != null ? { scoreThreshold } : {}),
    }),
};
