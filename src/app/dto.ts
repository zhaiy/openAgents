import type { RunStatus, StepStatus, WorkflowConfig } from '../types/index.js';

// Re-export RunStatus for convenience
export type { RunStatus } from '../types/index.js';

export interface WorkflowSummaryDto {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  hasGate: boolean;
  hasEval: boolean;
}

export interface WorkflowDetailDto extends WorkflowSummaryDto {
  steps: Array<{
    id: string;
    agent: string;
    gate: 'auto' | 'approve';
    dependsOn: string[];
  }>;
}

export interface RunStepDto {
  id: string;
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  outputFile?: string;
  error?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens: number;
  };
  durationMs?: number;
}

export interface RunSummaryDto {
  runId: string;
  workflowId: string;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  stepCount: number;
  completedStepCount: number;
}

export interface RunDetailDto {
  runId: string;
  workflowId: string;
  status: RunStatus;
  input: string;
  inputData?: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  steps: RunDetailStepDto[];
}

export interface RunDetailStepDto {
  stepId: string;
  name: string;
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
  durationMs?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens: number;
  };
}

export interface PendingGateDto {
  runId?: string;
  stepId: string;
  createdAt: number;
  outputPreview: string;
}

export type GateActionType = 'approve' | 'reject' | 'edit';

export interface GateActionRequestDto {
  action: GateActionType;
  editedOutput?: string;
}

type WebRunEventBase = {
  ts: number;
  runId: string;
};

export type WebRunEventPayload =
  | {
      type: 'workflow.started';
      workflowId: string;
      resumed: boolean;
      input: string;
    }
  | { type: 'workflow.completed' }
  | { type: 'workflow.failed'; error: string }
  | { type: 'workflow.interrupted' }
  | { type: 'step.started'; stepId: string }
  | {
      type: 'step.completed';
      stepId: string;
      duration: number;
      outputPreview: string;
      tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens: number;
      };
    }
  | { type: 'step.failed'; stepId: string; error: string }
  | { type: 'step.skipped'; stepId: string; reason: string }
  | { type: 'step.retrying'; stepId: string; attempt: number; maxAttempts: number; error: string }
  | { type: 'step.stream'; stepId: string; chunk: string }
  | { type: 'gate.waiting'; stepId: string; preview: string }
  | { type: 'gate.resolved'; stepId: string; action: 'continue' | 'abort' | 'edit' };

export type WebRunEvent = WebRunEventBase &
  WebRunEventPayload & {
    id: string;
    sequence?: number; // Added for SSE consistency (T4)
  };

// =============================================================================
// Visual DTOs for v6 - Workflow Visualization
// =============================================================================

export type NodeStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'streaming'
  | 'gate_waiting'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cached';

// TokenUsage compatible with types/index.ts
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
}

// Workflow Visual Summary DTOs

export type WorkflowVisualNodeType = 'agent' | 'gate' | 'eval' | 'script' | 'start' | 'end';

export interface WorkflowVisualNode {
  id: string;
  name: string;
  type: WorkflowVisualNodeType;
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

export interface WorkflowVisualSummaryDto {
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

// Run Visual State DTOs

export interface RunNodeStateDto {
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

export interface RunVisualStateDto {
  runId: string;
  workflowId: string;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  nodeStates: Record<string, RunNodeStateDto>;
  currentActiveNodeIds: string[];
  gateWaitingNodeIds: string[];
  failedNodeIds: string[];
  tokenUsage?: TokenUsage;
  version: number; // Snapshot version for consistency
  lastEventId?: string; // Last processed event ID
}

export interface TimelineEntry {
  id: string;
  event: string;
  timestamp: number;
  stepId?: string;
  details?: string;
  status?: 'success' | 'error' | 'warning' | 'info';
}

// Diagnostics DTOs

export interface ErrorSummary {
  nodeId: string;
  errorType: string;
  errorMessage: string;
  suggestedActions: string[];
}

export interface DiagnosticsSummaryDto {
  runId: string;
  failedNodeIds: string[];
  gateWaitingNodeIds: string[];
  errorSummary: ErrorSummary[];
  upstreamStates: Record<string, NodeStatus>;
  downstreamImpact: Record<string, string[]>;
}

// Run Comparison DTOs (stateless)

export interface InputDiff {
  field: string;
  valueA: unknown;
  valueB: unknown;
}

export interface NodeStatusDiff {
  nodeId: string;
  statusA: NodeStatus;
  statusB: NodeStatus;
}

export interface DurationDiff {
  runA: number;
  runB: number;
}

export interface RunComparisonDto {
  runAId: string;
  runBId: string;
  inputDiff?: InputDiff[];
  statusDiff: {
    runA: RunStatus;
    runB: RunStatus;
  };
  nodeStatusDiff?: NodeStatusDiff[];
  durationDiff?: DurationDiff;
  tokenUsageDiff?: {
    runA: TokenUsage;
    runB: TokenUsage;
  };
  outputDiffSummary?: string;
}

export interface RunComparisonSessionDto {
  sessionId: string;
  createdAt: number;
  comparison: RunComparisonDto;
}

// Config Draft DTOs

export interface RuntimeOptions {
  stream?: boolean;
  autoApprove?: boolean;
  noEval?: boolean;
}

export interface ConfigDraftDto {
  draftId: string;
  workflowId: string;
  name: string;
  inputData: Record<string, unknown>;
  runtimeOptions?: RuntimeOptions;
  createdAt: number;
  updatedAt: number;
}

export interface RunStartRequestDto {
  workflowId: string;
  input: string;
  inputData?: Record<string, unknown>;
  stream?: boolean;
  autoApprove?: boolean;
  noEval?: boolean;
}

export interface RunStartResponseDto {
  runId: string;
  status: 'running';
}

export interface SettingsDto {
  projectPath: string;
  locale: string;
  apiKeyConfigured: boolean;
  baseUrlConfigured: boolean;
}

export function mapWorkflowDetail(workflow: WorkflowConfig): WorkflowDetailDto {
  return {
    id: workflow.workflow.id,
    name: workflow.workflow.name,
    description: workflow.workflow.description,
    stepCount: workflow.steps.length,
    hasGate: workflow.steps.some((step) => (step.gate ?? 'auto') === 'approve'),
    hasEval: !!workflow.eval?.enabled,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      agent: step.agent,
      gate: step.gate ?? 'auto',
      dependsOn: step.depends_on ?? [],
    })),
  };
}
