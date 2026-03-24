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
  workflowName: string;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  stepCount: number;
  completedStepCount: number;
  score?: number;
}

export interface RunDetailDto {
  runId: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  input: string;
  inputData?: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  tokenUsage?: TokenUsage;
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

export interface FailedNodeDetail {
  nodeId: string;
  nodeName?: string;
  status: 'failed';
  errorType: string;
  errorMessage: string;
  failedAt?: number;
  retryCount?: number;
  upstreamCompleted: string[];
  upstreamFailed: string[];
}

export interface DownstreamImpactNode {
  nodeId: string;
  nodeName?: string;
  status: NodeStatus;
  impactType: 'blocked' | 'skipped' | 'will_fail';
  reason: string;
}

export interface FailurePropagation {
  rootCauseNodeId: string;
  propagationPath: string[];
  affectedNodeCount: number;
  summary: string;
}

export interface RecommendedAction {
  type: 'rerun' | 'rerun_with_edits' | 'fix_config' | 'check_api' | 'retry' | 'contact_support';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  targetNodeId?: string;
  targetRunId?: string;
}

export interface ErrorSummary {
  nodeId: string;
  errorType: string;
  errorMessage: string;
  suggestedActions: string[];
}

export interface DiagnosticsSummaryDto {
  runId: string;
  workflowId: string;
  workflowName?: string;
  runStatus: RunStatus;
  failedNodeIds: string[];
  gateWaitingNodeIds: string[];
  failedNodes: FailedNodeDetail[];
  downstreamImpact: DownstreamImpactNode[];
  failurePropagation?: FailurePropagation;
  errorSummary: ErrorSummary[];
  upstreamStates: Record<string, NodeStatus>;
  recommendedActions: RecommendedAction[];
}

// =============================================================================
// Run Comparison DTOs (N7 Enhancement)
// =============================================================================

export type InputDiffType = 'added' | 'removed' | 'changed' | 'type_changed';

export interface InputDiff {
  field: string;
  valueA: unknown;
  valueB: unknown;
  /** Type of difference */
  diffType: InputDiffType;
  /** Type information for type_changed */
  typeA?: string;
  typeB?: string;
}

export interface NodeStatusDiff {
  nodeId: string;
  statusA: NodeStatus;
  statusB: NodeStatus;
  /** Duration difference in milliseconds */
  durationDiff?: {
    runA?: number;
    runB?: number;
    delta?: number;
  };
  /** Error message if node failed */
  errorA?: string;
  errorB?: string;
  /** Whether this is a critical node (first failure or significant impact) */
  isCritical?: boolean;
}

export interface DurationDiff {
  runA: number;
  runB: number;
  /** Absolute difference in milliseconds */
  delta: number;
  /** Percentage change: ((runB - runA) / runA) * 100 */
  percentChange?: number;
}

export interface OutputDiffItem {
  nodeId: string;
  /** Whether output exists in each run */
  hasOutputA: boolean;
  hasOutputB: boolean;
  /** Output preview (truncated) */
  previewA?: string;
  previewB?: string;
  /** Whether outputs are identical */
  isIdentical: boolean;
}

export interface ComparisonSummary {
  /** Overall similarity score (0-100) based on input, nodes, and output */
  similarityScore: number;
  /** Key differences that impact decision making */
  keyDifferences: string[];
  /** Recommendations based on comparison */
  recommendations: string[];
  /** Risk warnings */
  warnings: string[];
}

export interface RunComparisonDto {
  runAId: string;
  runBId: string;
  /** Workflow info for context */
  workflowInfo?: {
    workflowId: string;
    name: string;
    isSameWorkflow: boolean;
  };
  inputDiff?: InputDiff[];
  /** Summary of input differences */
  inputDiffSummary?: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  statusDiff: {
    runA: RunStatus;
    runB: RunStatus;
  };
  nodeStatusDiff?: NodeStatusDiff[];
  /** Summary of node differences */
  nodeDiffSummary?: {
    totalNodes: number;
    identical: number;
    different: number;
    onlyInA: number;
    onlyInB: number;
  };
  durationDiff?: DurationDiff;
  tokenUsageDiff?: {
    runA: TokenUsage;
    runB: TokenUsage;
    /** Difference in total tokens */
    delta?: number;
    /** Percentage change */
    percentChange?: number;
  };
  outputDiff?: OutputDiffItem[];
  /** Summary for decision making */
  summary: ComparisonSummary;
}

export interface RunComparisonSessionDto {
  sessionId: string;
  createdAt: number;
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Expiration timestamp */
  expiresAt: number;
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

/**
 * Reusable config extracted from a historical run.
 * Contains all information needed to rerun or create a draft.
 */
export interface ReusableConfigDto {
  /** Source run ID */
  runId: string;
  workflowId: string;
  workflowName?: string;
  /** Plain text input (if any) */
  input: string;
  /** Structured input data */
  inputData: Record<string, unknown>;
  /** Runtime options used in the original run */
  runtimeOptions: RuntimeOptions;
  /** Original run status */
  runStatus: 'completed' | 'failed' | 'interrupted';
  /** Original run timestamp */
  startedAt: number;
  /** Original run duration */
  durationMs?: number;
}

/**
 * Preview of rerun changes before execution.
 * Shows the difference between original and new config.
 */
export interface RerunPreviewDto {
  /** Source run info */
  sourceRun: {
    runId: string;
    status: 'completed' | 'failed' | 'interrupted';
    startedAt: number;
    durationMs?: number;
  };
  /** Workflow info */
  workflow: {
    workflowId: string;
    name: string;
    stepCount: number;
    hasGate: boolean;
  };
  /** Input changes */
  inputDiff?: InputDiffItem[];
  /** Runtime options changes */
  runtimeOptionsDiff?: {
    field: 'stream' | 'autoApprove' | 'noEval';
    original: boolean;
    new: boolean;
  }[];
  /** Warnings about the rerun */
  warnings?: string[];
}

export interface InputDiffItem {
  field: string;
  original?: unknown;
  new?: unknown;
  type: 'added' | 'removed' | 'changed';
}

/**
 * Recovery options for partial run recovery.
 * Reserved for future node-level recovery support.
 */
export interface RecoveryOptions {
  /** Resume from a specific step (skip completed steps) */
  resumeFromStep?: string;
  /** Use cached outputs for specific steps */
  useCachedSteps?: string[];
  /** Force re-run specific steps */
  forceRerunSteps?: string[];
}

export interface RunStartRequestDto {
  workflowId: string;
  input: string;
  inputData?: Record<string, unknown>;
  stream?: boolean;
  autoApprove?: boolean;
  noEval?: boolean;
  /** Source run ID for rerun tracking */
  sourceRunId?: string;
  /** Recovery options for partial rerun (reserved for future use) */
  recoveryOptions?: RecoveryOptions;
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

// =============================================================================
// API Error Response - Unified Error Structure
// =============================================================================

export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT';

export interface ApiErrorDetail {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
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
