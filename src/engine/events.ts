import type { ExecutionPlan, RunState, TokenUsage } from '../types/index.js';

export interface StepCompleteInfo {
  duration: number;
  outputPreview: string;
  tokenUsage?: TokenUsage;
}

export interface EngineEventHandler {
  onWorkflowStart(workflowName: string, plan: ExecutionPlan, state: RunState): void;
  onWorkflowComplete(state: RunState): void;
  onWorkflowFailed(state: RunState, error: Error): void;
  onWorkflowInterrupted(state: RunState): void;

  onStepStart(stepId: string): void;
  onStepComplete(stepId: string, info: StepCompleteInfo): void;
  onStepFailed(stepId: string, error: string): void;
  onStepSkipped(stepId: string, reason: string): void;
  onStepRetry(stepId: string, attempt: number, maxAttempts: number, error: string): void;

  onStreamChunk?(stepId: string, chunk: string): void;

  onGateWaiting(stepId: string, output: string, previewLines: number): void;
}
