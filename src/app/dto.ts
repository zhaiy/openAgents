import type { RunStatus, StepStatus, WorkflowConfig } from '../types/index.js';

export interface WorkflowSummaryDto {
  id: string;
  name: string;
  description: string;
  stepCount: number;
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
  steps: Record<string, RunStepDto>;
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
  };

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
    hasEval: !!workflow.eval?.enabled,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      agent: step.agent,
      gate: step.gate ?? 'auto',
      dependsOn: step.depends_on ?? [],
    })),
  };
}
