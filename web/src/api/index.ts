const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  hasEval: boolean;
}

export interface RunSummary {
  runId: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  createdAt: string;
  durationMs?: number;
  score?: number;
}

export interface RunDetail {
  runId: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  steps: Step[];
}

export interface Step {
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'gate_waiting';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  output?: string;
  error?: string;
}

export interface RunEvent {
  type: string;
  runId: string;
  stepId?: string;
  chunk?: string;
  ts: number;
  [key: string]: unknown;
}

export interface Settings {
  projectPath: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  apiKeyConfigured: boolean;
  baseUrlConfigured: boolean;
}

export interface RunStartRequest {
  workflowId: string;
  input?: string;
  inputData?: Record<string, unknown>;
  stream?: boolean;
  autoApprove?: boolean;
  noEval?: boolean;
}

export interface RunStartResponse {
  runId: string;
  status: string;
}

export interface GateActionRequest {
  action: 'approve' | 'reject' | 'edit';
  editedOutput?: string;
}

export const workflowApi = {
  list: () => request<Workflow[]>('/workflows'),
  get: (workflowId: string) => request<Workflow>(`/workflows/${encodeURIComponent(workflowId)}`),
};

export const runApi = {
  start: (body: RunStartRequest) =>
    request<RunStartResponse>('/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  list: (filters?: { status?: string; workflowId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.workflowId) params.set('workflowId', filters.workflowId);
    const query = params.toString();
    return request<RunSummary[]>(`/runs${query ? `?${query}` : ''}`);
  },
  get: (runId: string) => request<RunDetail>(`/runs/${encodeURIComponent(runId)}`),
  getEvents: (runId: string) => request<RunEvent[]>(`/runs/${encodeURIComponent(runId)}/events`),
  getStepOutput: (runId: string, stepId: string) =>
    request<string>(`/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/output`),
  getEval: (runId: string) => request<Record<string, unknown>>(`/runs/${encodeURIComponent(runId)}/eval`),
  resume: (runId: string) => request<RunStartResponse>(`/runs/${encodeURIComponent(runId)}/resume`, { method: 'POST' }),
  gateAction: (runId: string, stepId: string, body: GateActionRequest) =>
    request<{ success: boolean }>(`/runs/${encodeURIComponent(runId)}/gates/${encodeURIComponent(stepId)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};

export const settingsApi = {
  get: () => request<Settings>('/settings'),
};

export function createSSEConnection(runId: string, onMessage: (event: RunEvent) => void, onError?: () => void) {
  const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/stream`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onMessage(data);
    } catch {}
  };
  es.onerror = () => {
    onError?.();
    es.close();
  };
  return es;
}
