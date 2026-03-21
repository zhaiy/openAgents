import type { ExecutionPlan, RunState } from '../../types/index.js';
import type { EngineEventHandler, StepCompleteInfo } from '../../engine/events.js';
import { mapEvent } from './web-event-mapper.js';
import { RunEventEmitter } from './run-event-emitter.js';

export class WebEventHandler implements EngineEventHandler {
  private readonly chunkBuffers = new Map<string, string>();
  private readonly flushTimers = new Map<string, NodeJS.Timeout>();
  private runId = '';

  constructor(
    private readonly emitter: RunEventEmitter,
    private readonly streamThrottleMs: number = 24,
  ) {}

  onWorkflowStart(_workflowName: string, _plan: ExecutionPlan, state: RunState): void {
    this.runId = state.runId;
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: state.runId,
        type: 'workflow.started',
        workflowId: state.workflowId,
        resumed: false,
        input: state.input,
      }),
    );
  }

  onWorkflowComplete(state: RunState): void {
    this.flushAllChunks();
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: state.runId,
        type: 'workflow.completed',
      }),
    );
    this.emitter.closeRun(state.runId);
  }

  onWorkflowFailed(state: RunState, error: Error): void {
    this.flushAllChunks();
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: state.runId,
        type: 'workflow.failed',
        error: error.message,
      }),
    );
    this.emitter.closeRun(state.runId);
  }

  onWorkflowInterrupted(state: RunState): void {
    this.flushAllChunks();
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: state.runId,
        type: 'workflow.interrupted',
      }),
    );
    this.emitter.closeRun(state.runId);
  }

  onStepStart(stepId: string): void {
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: this.runId,
        type: 'step.started',
        stepId,
      }),
    );
  }

  onStepComplete(stepId: string, info: StepCompleteInfo): void {
    this.flushChunk(stepId);
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: this.runId,
        type: 'step.completed',
        stepId,
        duration: info.duration,
        outputPreview: info.outputPreview,
        tokenUsage: info.tokenUsage,
      }),
    );
  }

  onStepFailed(stepId: string, error: string): void {
    this.flushChunk(stepId);
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: this.runId,
        type: 'step.failed',
        stepId,
        error,
      }),
    );
  }

  onStepSkipped(stepId: string, reason: string): void {
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: this.runId,
        type: 'step.skipped',
        stepId,
        reason,
      }),
    );
  }

  onStepRetry(stepId: string, attempt: number, maxAttempts: number, error: string): void {
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: this.runId,
        type: 'step.retrying',
        stepId,
        attempt,
        maxAttempts,
        error,
      }),
    );
  }

  onStreamChunk(stepId: string, chunk: string): void {
    const prev = this.chunkBuffers.get(stepId) ?? '';
    this.chunkBuffers.set(stepId, `${prev}${chunk}`);
    if (this.flushTimers.has(stepId)) {
      return;
    }
    const timer = setTimeout(() => {
      this.flushChunk(stepId);
    }, this.streamThrottleMs);
    this.flushTimers.set(stepId, timer);
  }

  onGateWaiting(stepId: string, output: string, previewLines: number): void {
    const preview = output.split('\n').slice(0, previewLines).join('\n');
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: this.runId,
        type: 'gate.waiting',
        stepId,
        preview,
      }),
    );
  }

  emitGateResolved(stepId: string, action: 'continue' | 'abort' | 'edit', runId: string): void {
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId,
        type: 'gate.resolved',
        stepId,
        action,
      }),
    );
  }

  private flushChunk(stepId: string): void {
    const timer = this.flushTimers.get(stepId);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(stepId);
    }
    const buffered = this.chunkBuffers.get(stepId);
    if (!buffered) {
      return;
    }
    this.chunkBuffers.delete(stepId);
    this.emitter.emit(
      mapEvent({
        ts: Date.now(),
        runId: this.runId,
        type: 'step.stream',
        stepId,
        chunk: buffered,
      }),
    );
  }

  private flushAllChunks(): void {
    for (const stepId of this.chunkBuffers.keys()) {
      this.flushChunk(stepId);
    }
  }
}
