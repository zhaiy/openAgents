import type { ExecutionPlan, RunState } from '../types/index.js';
import type { EngineEventHandler, StepCompleteInfo } from '../engine/events.js';
import { ProgressUI } from '../ui/progress.js';

export class CLIEventHandler implements EngineEventHandler {
  private progressUI: ProgressUI;
  private currentStreamingStep: string | null = null;
  private streamingInitialized = false;

  constructor(progressUI: ProgressUI) {
    this.progressUI = progressUI;
  }

  onWorkflowStart(workflowName: string, plan: ExecutionPlan, state: RunState): void {
    this.progressUI.start(plan, state, workflowName);
  }

  onWorkflowComplete(state: RunState): void {
    this.progressUI.complete(state);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onWorkflowFailed(state: RunState, error: Error): void {
    this.progressUI.stop();
  }

  onWorkflowInterrupted(state: RunState): void {
    this.progressUI.complete(state);
  }

  onStepStart(stepId: string): void {
    this.currentStreamingStep = null;
    this.streamingInitialized = false;
    this.progressUI.updateStep(stepId, 'running');
  }

  onStepComplete(stepId: string, info: StepCompleteInfo): void {
    this.progressUI.updateStep(stepId, 'completed', {
      duration: info.duration,
      outputPreview: info.outputPreview,
      tokenUsage: info.tokenUsage,
    });
  }

  onStepFailed(stepId: string, error: string): void {
    this.progressUI.updateStep(stepId, 'failed', { error });
  }

  onStepSkipped(stepId: string, reason: string): void {
    this.progressUI.updateStep(stepId, 'skipped', { error: reason });
  }

  onStepRetry(stepId: string, attempt: number, maxAttempts: number, error: string): void {
    this.progressUI.announceRetry(stepId, attempt, maxAttempts, error);
  }

  onStreamChunk?(stepId: string, chunk: string): void {
    if (this.currentStreamingStep !== stepId) {
      this.currentStreamingStep = stepId;
      this.streamingInitialized = false;
    }
    if (!this.streamingInitialized) {
      process.stdout.write('\n');
      this.streamingInitialized = true;
    }
    process.stdout.write(chunk);
  }

  onGateWaiting(stepId: string, output: string, previewLines: number): void {
    this.progressUI.showGatePrompt(stepId, output, previewLines);
  }
}
