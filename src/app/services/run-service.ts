import fs from 'node:fs';
import path from 'node:path';

import { ConfigLoader } from '../../config/loader.js';
import { StateManager } from '../../engine/state.js';
import { WorkflowEngine } from '../../engine/workflow-engine.js';
import { EventLogger } from '../../output/logger.js';
import { OutputWriter } from '../../output/writer.js';
import { createRuntime } from '../../runtime/factory.js';
import { StepCache } from '../../engine/cache.js';
import { GateManager, DeferredGateProvider } from '../../engine/gate.js';
import type { AgentRuntime, ProjectConfig, RunStatus, RuntimeType } from '../../types/index.js';
import { EvalRunner } from '../../eval/runner.js';
import type {
  RunDetailDto,
  RunStartRequestDto,
  RunStartResponseDto,
  RunSummaryDto,
  WebRunEvent,
} from '../dto.js';
import { RunEventEmitter } from '../events/run-event-emitter.js';
import { WebEventHandler } from '../events/web-event-handler.js';
import { RunRegistry } from './run-registry.js';

interface RunServiceDeps {
  loader: ConfigLoader;
  stateManager: StateManager;
  outputWriter: OutputWriter;
  cache: StepCache;
  eventEmitter: RunEventEmitter;
  runRegistry: RunRegistry;
  gateProvider: DeferredGateProvider;
  streamThrottleMs?: number;
}

export class RunService {
  constructor(private readonly deps: RunServiceDeps) {}

  startRun(request: RunStartRequestDto): RunStartResponseDto {
    const runId = this.deps.stateManager.generateRunId();
    const { engine, eventHandler } = this.buildWebEngine({ autoApprove: request.autoApprove });
    const runPromise = engine.run(request.workflowId, request.input, {
      runId,
      inputData: request.inputData,
      stream: request.stream ?? true,
      noEval: request.noEval,
    });
    this.deps.runRegistry.register({
      runId,
      workflowId: request.workflowId,
      startedAt: Date.now(),
      eventHandler,
      promise: runPromise,
    });
    return {
      runId,
      status: 'running',
    };
  }

  resumeRun(runId: string, stream = true): RunStartResponseDto {
    const state = this.deps.stateManager.findRunById(runId);
    const { engine, eventHandler } = this.buildWebEngine();
    const runPromise = engine.resume(runId, { stream });
    this.deps.runRegistry.register({
      runId,
      workflowId: state.workflowId,
      startedAt: Date.now(),
      eventHandler,
      promise: runPromise,
    });
    return {
      runId,
      status: 'running',
    };
  }

  listRuns(filter?: { workflowId?: string; status?: RunStatus }): RunSummaryDto[] {
    const runs = this.deps.stateManager.listRuns(filter);
    return runs.map((run) => {
      const stepStates = Object.values(run.steps);
      const workflowName = this.getWorkflowName(run.workflowId);
      const durationMs = run.completedAt && run.startedAt
        ? run.completedAt - run.startedAt
        : undefined;

      return {
        runId: run.runId,
        workflowId: run.workflowId,
        workflowName,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        durationMs,
        stepCount: stepStates.length,
        completedStepCount: stepStates.filter((step) => step.status === 'completed').length,
      };
    });
  }

  getRun(runId: string): RunDetailDto {
    const run = this.deps.stateManager.findRunById(runId);
    const workflowName = this.getWorkflowName(run.workflowId);
    const durationMs = run.completedAt && run.startedAt
      ? run.completedAt - run.startedAt
      : undefined;

    // Calculate total token usage from all steps
    const tokenUsage = this.calculateTotalTokenUsage(run.steps);

    // Transform steps from Record to Array with frontend-compatible field names
    const stepsArray = Object.entries(run.steps).map(([stepId, step]) => {
      let output: string | undefined;
      if (step.outputFile) {
        try {
          output = this.getStepOutput(runId, stepId);
        } catch {
          output = undefined;
        }
      }

      return {
        stepId,
        name: stepId, // stepId serves as the name when no separate name exists
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        output,
        error: step.error,
        durationMs: step.durationMs,
        tokenUsage: step.tokenUsage,
      };
    });

    return {
      runId: run.runId,
      workflowId: run.workflowId,
      workflowName,
      status: run.status,
      input: run.input,
      inputData: run.inputData,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs,
      tokenUsage,
      steps: stepsArray,
    };
  }

  getRunEvents(runId: string): WebRunEvent[] {
    const run = this.deps.stateManager.findRunById(runId);
    const runDir = this.deps.stateManager.getRunDir(run.workflowId, runId);
    const logger = new EventLogger(path.join(runDir, 'events.jsonl'));
    return logger.readAll().map((entry, index) => ({
      id: `${runId}:${entry.ts}:${index}`,
      ts: entry.ts,
      runId,
      type: entry.event,
      ...(entry.data as Record<string, unknown>),
    })) as WebRunEvent[];
  }

  getStepOutput(runId: string, stepId: string): string {
    const run = this.deps.stateManager.findRunById(runId);
    const step = run.steps[stepId];
    if (!step) {
      throw new Error(`Step "${stepId}" not found in run "${runId}"`);
    }
    if (!step.outputFile) {
      throw new Error(`Step "${stepId}" has no output file`);
    }
    const filePath = path.join(this.deps.stateManager.getRunDir(run.workflowId, runId), step.outputFile);
    return fs.readFileSync(filePath, 'utf8');
  }

  getRunEval(runId: string): unknown {
    const run = this.deps.stateManager.findRunById(runId);
    const projectConfig = this.deps.loader.loadProjectConfig();
    const outputBaseDir = path.resolve(this.deps.loader.getProjectRoot(), projectConfig.output.base_directory);
    const evalRunner = new EvalRunner(
      createRuntime as (type: 'llm-direct', projectConfig: ProjectConfig) => AgentRuntime,
      outputBaseDir,
      projectConfig,
    );
    return evalRunner.loadLastEval(run.workflowId, runId) ?? null;
  }

  private getWorkflowName(workflowId: string): string {
    try {
      const workflow = this.deps.loader.loadWorkflow(workflowId);
      return workflow.workflow.name ?? workflowId;
    } catch {
      return workflowId;
    }
  }

  private calculateTotalTokenUsage(steps: Record<string, { tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens: number } }>): { promptTokens: number; completionTokens: number; totalTokens: number } | undefined {
    const stepValues = Object.values(steps);
    if (stepValues.length === 0) return undefined;

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let hasUsage = false;

    for (const step of stepValues) {
      if (step.tokenUsage) {
        hasUsage = true;
        promptTokens += step.tokenUsage.promptTokens ?? 0;
        completionTokens += step.tokenUsage.completionTokens ?? 0;
        totalTokens += step.tokenUsage.totalTokens;
      }
    }

    return hasUsage ? { promptTokens, completionTokens, totalTokens } : undefined;
  }

  private buildWebEngine(opts?: { autoApprove?: boolean }): { engine: WorkflowEngine; eventHandler: WebEventHandler } {
    const projectConfig = this.deps.loader.loadProjectConfig();
    const gateManager = new GateManager('en', { autoApprove: opts?.autoApprove }, this.deps.gateProvider);
    const eventHandler = new WebEventHandler(this.deps.eventEmitter, this.deps.streamThrottleMs);
    const engine = new WorkflowEngine({
      configLoader: this.deps.loader,
      stateManager: this.deps.stateManager,
      runtimeFactory: (type: RuntimeType, cfg: ProjectConfig) => createRuntime(type, cfg),
      outputWriter: this.deps.outputWriter,
      gateManager,
      eventHandler,
      cache: this.deps.cache,
    });

    // Ensure output base directory exists for run side effects.
    fs.mkdirSync(path.resolve(this.deps.loader.getProjectRoot(), projectConfig.output.base_directory), {
      recursive: true,
    });
    return { engine, eventHandler };
  }
}
