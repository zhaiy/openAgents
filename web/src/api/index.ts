const API_BASE = '/api';

// API Error class for structured error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  let url = `${API_BASE}${path}`;

  // Append query params if provided
  if (options?.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    let errorCode: string | undefined;

    try {
      const errorBody = await res.json();
      errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
      errorCode = errorBody.error?.code;
    } catch {
      // Use default message
    }

    throw new ApiError(errorMessage, res.status, errorCode);
  }

  // Handle empty responses
  const text = await res.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  hasGate: boolean;
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

// =============================================================================
// Visual DTOs for v6 - copied from backend for frontend use
// =============================================================================

export type NodeStatus = 'pending' | 'queued' | 'running' | 'streaming' | 'gate_waiting' | 'completed' | 'failed' | 'skipped' | 'cached';

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
}

export interface WorkflowVisualNode {
  id: string;
  name: string;
  type: 'agent' | 'gate' | 'eval' | 'script' | 'start' | 'end';
  agentId?: string;
  hasGate: boolean;
  hasEval: boolean;
  isCachedCapable: boolean;
  upstreamIds: string[];
  downstreamIds: string[];
  description?: string;
}

export interface WorkflowVisualEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'gate' | 'conditional';
}

export interface InputSchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface InputSchemaSummary {
  fields: InputSchemaField[];
  totalFields: number;
  requiredFields: number;
}

export interface WorkflowVisualSummary {
  workflowId: string;
  name: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  gateCount: number;
  evalCount: number;
  visualNodes: WorkflowVisualNode[];
  visualEdges: WorkflowVisualEdge[];
  inputSchemaSummary?: InputSchemaSummary;
}

export interface RunNodeState {
  nodeId: string;
  status: NodeStatus;
  inputPreview?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  outputPreview?: string;
  logSummary?: string;
  errorMessage?: string;
  gateState?: {
    type: 'waiting' | 'approved' | 'rejected' | 'edited';
    preview?: string;
  };
  tokenUsage?: TokenUsage;
  retryCount?: number;
}

export interface RunVisualState {
  runId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  nodeStates: Record<string, RunNodeState>;
  currentActiveNodeIds: string[];
  gateWaitingNodeIds: string[];
  failedNodeIds: string[];
  tokenUsage?: TokenUsage;
  version: number;
  lastEventId?: string;
}

export interface TimelineEntry {
  id: string;
  event: string;
  timestamp: number;
  stepId?: string;
  details?: string;
  status?: 'success' | 'error' | 'warning' | 'info';
}

// SSE Sync Event payload
export interface SSESyncEvent {
  type: 'sync';
  runId: string;
  visualState?: RunVisualState;
  sequence?: number;
  lastSequence?: number;
  ts: number;
}

export interface ConfigDraft {
  draftId: string;
  workflowId: string;
  name: string;
  inputData: Record<string, unknown>;
  runtimeOptions?: {
    stream?: boolean;
    autoApprove?: boolean;
    noEval?: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface RunComparison {
  runAId: string;
  runBId: string;
  inputDiff?: { field: string; valueA: unknown; valueB: unknown }[];
  statusDiff: { runA: string; runB: string };
  nodeStatusDiff?: { nodeId: string; statusA: NodeStatus; statusB: NodeStatus }[];
  durationDiff?: { runA: number; runB: number };
  tokenUsageDiff?: { runA: TokenUsage; runB: TokenUsage };
  outputDiffSummary?: string;
}

export interface RunComparisonSession {
  sessionId: string;
  createdAt: number;
  comparison: RunComparison;
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
  rerun: (runId: string) =>
    request<RunStartResponse>(`/runs/${encodeURIComponent(runId)}/rerun`, { method: 'POST' }),
  rerunWithEdits: (runId: string, inputData: Record<string, unknown>) =>
    request<RunStartResponse>(`/runs/${encodeURIComponent(runId)}/rerun-with-edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputData }),
    }),
  getReusableConfig: (runId: string) =>
    request<{ workflowId: string; input: string; inputData: Record<string, unknown>; runtimeOptions: unknown }>(
      `/runs/${encodeURIComponent(runId)}/reusable-config`
    ),
};

export const settingsApi = {
  get: () => request<Settings>('/settings'),
};

// Visual API methods
export const visualApi = {
  // Workflow Visual Summary
  getWorkflowSummary: (workflowId: string) =>
    request<WorkflowVisualSummary>(`/workflows/${encodeURIComponent(workflowId)}/visual-summary`),

  // Run Visual State
  getRunVisualState: (runId: string) =>
    request<RunVisualState>(`/runs/${encodeURIComponent(runId)}/visual-state`),

  // Run Timeline
  getRunTimeline: (runId: string) =>
    request<TimelineEntry[]>(`/runs/${encodeURIComponent(runId)}/timeline`),

  // Run Node State
  getNodeState: (runId: string, nodeId: string) =>
    request<RunNodeState>(`/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}`),

  // Reusable Config
  getReusableConfig: (runId: string) =>
    request<{ workflowId: string; input: string; inputData: Record<string, unknown>; runtimeOptions: unknown }>(
      `/runs/${encodeURIComponent(runId)}/reusable-config`
    ),
};

// Draft API methods
export const draftApi = {
  list: (workflowId: string) =>
    request<ConfigDraft[]>(`/workflows/${encodeURIComponent(workflowId)}/drafts`),
  get: (workflowId: string, draftId: string) =>
    request<ConfigDraft>(`/workflows/${encodeURIComponent(workflowId)}/drafts/${encodeURIComponent(draftId)}`),
  create: (workflowId: string, body: { name: string; inputData: Record<string, unknown>; runtimeOptions?: unknown }) =>
    request<ConfigDraft>(`/workflows/${encodeURIComponent(workflowId)}/drafts`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (workflowId: string, draftId: string, body: Partial<{ name: string; inputData: Record<string, unknown>; runtimeOptions?: unknown }>) =>
    request<ConfigDraft>(`/workflows/${encodeURIComponent(workflowId)}/drafts/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (workflowId: string, draftId: string) =>
    request<void>(`/workflows/${encodeURIComponent(workflowId)}/drafts/${encodeURIComponent(draftId)}`, {
      method: 'DELETE',
    }),
};

// Diagnostics API methods
export const diagnosticsApi = {
  getFailedRuns: () =>
    request<Array<{ runId: string; workflowId: string; failedAt: number; failedNodeId?: string; errorType?: string; errorMessage?: string }>>(
      '/diagnostics/failed-runs'
    ),
  getWaitingGates: () =>
    request<Array<{ runId: string; workflowId: string; stepId: string; waitedAt: number; preview?: string }>>(
      '/diagnostics/waiting-gates'
    ),
  getRunDiagnostics: (runId: string) =>
    request<{
      runId: string;
      failedNodeIds: string[];
      gateWaitingNodeIds: string[];
      errorSummary: Array<{ nodeId: string; errorType: string; errorMessage: string; suggestedActions: string[] }>;
      upstreamStates: Record<string, string>;
      downstreamImpact: Record<string, string[]>;
    }>(`/diagnostics/runs/${encodeURIComponent(runId)}`),
};

// Comparison API
export const comparisonApi = {
  compare: (runAId: string, runBId: string) =>
    request<RunComparison>(`/runs/compare?runA=${encodeURIComponent(runAId)}&runB=${encodeURIComponent(runBId)}`),
  createSession: (runAId: string, runBId: string) =>
    request<RunComparisonSession>('/compare', {
      method: 'POST',
      body: JSON.stringify({ runAId, runBId }),
    }),
  getSession: (sessionId: string) =>
    request<RunComparisonSession>(`/compare/${encodeURIComponent(sessionId)}`),
  deleteSession: (sessionId: string) =>
    request<void>(`/compare/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
};

export interface SSEOptions {
  /** Maximum retry attempts (default: 5) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  retryDelayMs?: number;
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelayMs?: number;
  /** Callback when connection status changes */
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting') => void;
  /** Last event ID for reconnection */
  lastEventId?: string;
}

/**
 * Enhanced SSE connection with reconnection strategy.
 *
 * Supports:
 * - Sequence-based event ordering via Last-Event-ID header
 * - Visual state recovery on reconnection
 * - Exponential backoff with configurable max retries
 * - Connection status callbacks
 */
export function createSSEConnection(
  runId: string,
  onMessage: (event: RunEvent, eventId?: string) => void,
  onError?: (error?: Error, retryCount?: number) => void,
  options: SSEOptions = {}
) {
  const {
    maxRetries = 5,
    retryDelayMs = 1000,
    maxRetryDelayMs = 30000,
    onStatusChange,
    lastEventId,
  } = options;

  let retryCount = 0;
  let es: EventSource | null = null;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentLastEventId = lastEventId;

  const updateStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting') => {
    onStatusChange?.(status);
  };

  const handleIncoming = (e: MessageEvent<string>) => {
    try {
      const data = JSON.parse(e.data) as RunEvent;
      const eventId = e.lastEventId || undefined;
      if (eventId) {
        currentLastEventId = eventId;
      }
      onMessage(data, eventId);
    } catch (parseError) {
      console.error('Failed to parse SSE message:', parseError);
    }
  };

  const clearRetryTimeout = () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  };

  const connect = () => {
    clearRetryTimeout();

    // Clean up existing connection
    if (es) {
      es.close();
      es = null;
    }

    updateStatus('connecting');

    // Build URL with Last-Event-ID for server-side resumption support
    let url = `/api/runs/${encodeURIComponent(runId)}/stream`;
    if (currentLastEventId) {
      url += `?lastEventId=${encodeURIComponent(currentLastEventId)}`;
    }

    es = new EventSource(url);
    es.onmessage = handleIncoming;

    const namedEvents = [
      'sync',
      'step.started',
      'step.stream',
      'step.completed',
      'step.failed',
      'step.skipped',
      'gate.waiting',
      'gate.resolved',
      'workflow.completed',
      'workflow.failed',
      'run.closed',
    ];
    namedEvents.forEach((eventName) => {
      es?.addEventListener(eventName, handleIncoming as EventListener);
    });

    es.onerror = () => {
      updateStatus(retryCount < maxRetries ? 'reconnecting' : 'error');

      if (retryCount < maxRetries) {
        // Exponential backoff
        const delay = Math.min(retryDelayMs * Math.pow(2, retryCount), maxRetryDelayMs);
        retryCount++;

        console.warn(`SSE connection error, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);

        retryTimeout = setTimeout(() => {
          connect();
        }, delay);

        onError?.(new Error('Connection lost, reconnecting...'), retryCount);
      } else {
        console.error(`SSE connection failed after ${maxRetries} retries`);
        es?.close();
        es = null;
        updateStatus('disconnected');
        onError?.(new Error('Connection failed after max retries'));
      }
    };

    es.onopen = () => {
      retryCount = 0;
      updateStatus('connected');
    };
  };

  connect();

  // Return connection object with control methods
  return {
    close: () => {
      clearRetryTimeout();
      if (es) {
        es.close();
        es = null;
      }
      updateStatus('disconnected');
    },
    getReadyState: () => es?.readyState ?? EventSource.CLOSED,
    // Allow manual reconnect
    reconnect: () => {
      retryCount = 0;
      connect();
    },
  };
}
