// Shared API client + types for Akili frontend
// All requests use relative paths so the Caddy gateway can route correctly.

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  tier: 'core' | 'advanced' | 'specialized';
  description: string;
  capabilities: string[];
  icon: string;
  color: string;
}

export interface AnalysisResult {
  status: string;
  analysisId: string;
  totalDurationMs: number;
  execution: {
    totalDurationMs: number;
    agentsSucceeded: number;
    agentsFailed: number;
    agentsSkipped: number;
    stageTimings: Record<number, number>;
  };
  results: Record<string, any>;
  timestamp: string;
  error?: string;
}

export interface Plan {
  id: string;
  name: string;
  priceNGN: number;
  priceUSD: number;
  analysesPerMonth: number;
  features: string[];
  highlight?: boolean;
}

const API_BASE = '/api';

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('akili_token') : null;
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('akili_api_key') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (apiKey) headers['X-API-Key'] = apiKey;

  const resp = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await resp.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!resp.ok) {
    const err = new Error(data?.error ?? data?.message ?? `HTTP ${resp.status}`) as any;
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const api = {
  // Agents
  getAgents: () => request<{ total: number; agents: AgentInfo[] }>('/agents'),
  getHealth: () => request<any>('/health'),

  // Analysis
  analyze: (payload: {
    fileContents?: any[];
    fileText?: string;
    fileName?: string;
    fileType?: string;
    url?: string;
    analysisConfig?: Record<string, any>;
    nlqQuery?: string;
    objectives?: string[];
    enabledAgents?: string[];
  }) => request<AnalysisResult>('/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Standalone agent endpoints
  nlq: (query: string, fileContents?: any[]) => request<any>('/nlq', {
    method: 'POST', body: JSON.stringify({ query, fileContents }),
  }),
  anomalies: (fileContents: any[], sensitivity?: string) => request<any>('/anomalies', {
    method: 'POST', body: JSON.stringify({ fileContents, sensitivity }),
  }),
  forecast: (fileContents: any[], periods?: number, targetColumn?: string) => request<any>('/forecast', {
    method: 'POST', body: JSON.stringify({ fileContents, periods, targetColumn }),
  }),
  causal: (fileContents: any[], targetVariable?: string) => request<any>('/causal', {
    method: 'POST', body: JSON.stringify({ fileContents, targetVariable }),
  }),
  quality: (fileContents: any[]) => request<any>('/quality', {
    method: 'POST', body: JSON.stringify({ fileContents }),
  }),
  chat: (question: string, analysisContext?: any) => request<any>('/chat', {
    method: 'POST', body: JSON.stringify({ question, analysisContext }),
  }),
  codegen: (fileContents: any[], targetVariable?: string) => request<any>('/codegen', {
    method: 'POST', body: JSON.stringify({ fileContents, targetVariable }),
  }),
  synthetic: (fileContents: any[]) => request<any>('/synthetic', {
    method: 'POST', body: JSON.stringify({ fileContents }),
  }),
  knowledgeGraph: (fileContents: any[]) => request<any>('/knowledge-graph', {
    method: 'POST', body: JSON.stringify({ fileContents }),
  }),
  explain: (fileContents: any[], targetVariable?: string) => request<any>('/explain', {
    method: 'POST', body: JSON.stringify({ fileContents, targetVariable }),
  }),
  benchmark: (fileContents: any[]) => request<any>('/benchmark', {
    method: 'POST', body: JSON.stringify({ fileContents }),
  }),

  // Auth
  register: (email: string, password: string, name: string) => request<any>('/auth/register', {
    method: 'POST', body: JSON.stringify({ email, password, name }),
  }),
  login: (email: string, password: string) => request<any>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  me: () => request<any>('/auth/me'),
  listApiKeys: () => request<{ apiKeys: any[] }>('/auth/api-keys'),
  createApiKey: (name?: string) => request<any>('/auth/api-keys', {
    method: 'POST', body: JSON.stringify({ name }),
  }),
  deleteApiKey: (id: string) => request<any>(`/auth/api-keys?id=${id}`, { method: 'DELETE' }),

  // Plans & Payments
  getPlans: () => request<{ plans: Plan[]; currency: string; publicKey: string; configured: boolean }>('/plans'),
  initializePayment: (plan: string, currency?: string) => request<any>('/payments/initialize', {
    method: 'POST', body: JSON.stringify({ plan, currency }),
  }),
  verifyPayment: (reference: string) => request<any>('/payments/verify', {
    method: 'POST', body: JSON.stringify({ reference }),
  }),

  // Stats & history
  getStats: () => request<any>('/stats'),
  getAnalyses: () => request<{ analyses: any[] }>('/analyses'),
  deleteAnalysis: (id: string) => request<any>(`/analyses?id=${id}`, { method: 'DELETE' }),

  // AI Narrative (LLM-powered)
  generateAINarrative: (payload: any) => request<any>('/ai-narrative', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  // PDF Export (returns HTML for browser-to-PDF)
  exportPdf: (payload: any) => fetch('/api/pdf-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.text()),
};

// ─── Local storage helpers ─────────────────────────────────────────────────
export const storage = {
  getToken: () => typeof window !== 'undefined' ? localStorage.getItem('akili_token') : null,
  setToken: (t: string) => typeof window !== 'undefined' && localStorage.setItem('akili_token', t),
  removeToken: () => typeof window !== 'undefined' && localStorage.removeItem('akili_token'),
  getUser: () => {
    if (typeof window === 'undefined') return null;
    const u = localStorage.getItem('akili_user');
    return u ? JSON.parse(u) : null;
  },
  setUser: (u: any) => typeof window !== 'undefined' && localStorage.setItem('akili_user', JSON.stringify(u)),
  removeUser: () => typeof window !== 'undefined' && localStorage.removeItem('akili_user'),

  // Analysis history (localStorage)
  getHistory: () => {
    if (typeof window === 'undefined') return [];
    const h = localStorage.getItem('akili_history');
    return h ? JSON.parse(h) : [];
  },
  addToHistory: (item: any) => {
    if (typeof window === 'undefined') return;
    const h = storage.getHistory();
    h.unshift({ ...item, savedAt: new Date().toISOString() });
    localStorage.setItem('akili_history', JSON.stringify(h.slice(0, 50)));
  },
  clearHistory: () => typeof window !== 'undefined' && localStorage.removeItem('akili_history'),
};
