import path from 'node:path';

import { ConfigLoader } from '../config/loader.js';
import { GateRejectError, RuntimeError } from '../errors.js';
import { EventLogger } from '../output/logger.js';
import { OutputWriter } from '../output/writer.js';
import { sendWebhookNotification } from '../output/notifier.js';
import type {
  AgentConfig,
  AgentRuntime,
  ProjectConfig,
  RunState,
  RuntimeType,
  StepConfig,
  WorkflowConfig,
} from '../types/index.js';
import { GateManager } from './gate.js';
import { DAGParser } from './dag.js';
import { Scheduler } from './scheduler.js';
import { StateManager } from './state.js';
import { renderTemplate } from './template.js';
import { ProgressUI } from '../ui/progress.js';
import { StepCache } from './cache.js';

type RuntimeFactory = (type: RuntimeType, projectConfig: ProjectConfig, agentConfig?: AgentConfig) => AgentRuntime;

interface RunOptions {
  inputData?: Record<string, unknown>;
}

interface WorkflowEngineDeps {
  configLoader: ConfigLoader;
  stateManager: StateManager;
  runtimeFactory: RuntimeFactory;
  outputWriter: OutputWriter;
  gateManager: GateManager;
  progressUI: ProgressUI;
  cache?: StepCache;
}

function getRuntimeErrorMeta(error: unknown): Record<string, unknown> {
  if (!(error instanceof RuntimeError) || !error.details) {
    return {};
  }
  return {
    httpStatus: error.details.httpStatus,
    responseBody: error.details.responseBody,
    isTimeout: error.details.isTimeout,
    timeoutSeconds: error.details.timeoutSeconds,
    runtimeCause: error.details.cause,
  };
}

export class WorkflowEngine {
  private readonly dagParser = new DAGParser();

  constructor(private readonly deps: WorkflowEngineDeps) {}

  async run(workflowId: string, input: string, options?: RunOptions): Promise<RunState> {
    const projectConfig = this.deps.configLoader.loadProjectConfig();
    const agents = this.deps.configLoader.loadAgents();
    const workflow = this.deps.configLoader.loadWorkflow(workflowId);
    this.deps.configLoader.validateReferences(agents, workflow);

    const plan = this.dagParser.parse(workflow.steps);
    const runId = this.deps.stateManager.generateRunId();
    const state = this.deps.stateManager.initRun(runId, workflow.workflow.id, input, plan.order, options?.inputData);
    return this.executeWorkflow({
      projectConfig,
      agents,
      workflow,
      state,
      plan,
      isResume: false,
    });
  }

  async resume(runId: string): Promise<RunState> {
    const projectConfig = this.deps.configLoader.loadProjectConfig();
    const state = this.deps.stateManager.findRunById(runId);
    const agents = this.deps.configLoader.loadAgents();
    const workflow = this.deps.configLoader.loadWorkflow(state.workflowId);
    this.deps.configLoader.validateReferences(agents, workflow);
    const plan = this.dagParser.parse(workflow.steps);
    return this.executeWorkflow({
      projectConfig,
      agents,
      workflow,
      state,
      plan,
      isResume: true,
    });
  }

  private async executeWorkflow(params: {
    projectConfig: ProjectConfig;
    agents: Map<string, AgentConfig>;
    workflow: WorkflowConfig;
    state: RunState;
    plan: ReturnType<DAGParser['parse']>;
    isResume: boolean;
  }): Promise<RunState> {
    const { projectConfig, agents, workflow, state, plan, isResume } = params;
    const runDir = this.deps.stateManager.getRunDir(workflow.workflow.id, state.runId);
    this.deps.outputWriter.ensureDir(runDir);
    const logger = new EventLogger(path.join(runDir, 'events.jsonl'));

    if (isResume) {
      for (const stepId of plan.order) {
        const current = state.steps[stepId];
        if (current && (current.status === 'running' || current.status === 'interrupted')) {
          this.deps.stateManager.updateStep(state, stepId, {
            status: 'pending',
            error: undefined,
            startedAt: undefined,
            completedAt: undefined,
          });
        }
      }
    }
    this.deps.stateManager.updateRun(state, {
      status: 'running',
      completedAt: undefined,
    });
    this.deps.progressUI.start(plan, state, workflow.workflow.name);
    logger.log('workflow.started', {
      workflowId: workflow.workflow.id,
      runId: state.runId,
      resumed: isResume,
      input: state.input,
    });

    const onSigint = (): void => {
      const runningIds = Object.entries(state.steps)
        .filter(([, value]) => value.status === 'running')
        .map(([stepId]) => stepId);
      for (const stepId of runningIds) {
        this.deps.stateManager.updateStep(state, stepId, {
          status: 'interrupted',
          completedAt: Date.now(),
        });
      }
      this.deps.stateManager.updateRun(state, {
        status: 'interrupted',
        completedAt: Date.now(),
      });
      logger.log('workflow.interrupted', { runId: state.runId, workflowId: state.workflowId });
      this.deps.progressUI.stop();
      process.exit(0);
    };
    process.on('SIGINT', onSigint);

    try {
      const stepById = new Map(workflow.steps.map((step) => [step.id, step]));
      const scheduler = new Scheduler(plan, state, async (stepId: string) => {
        const step = stepById.get(stepId);
        if (!step) {
          throw new Error(`Step "${stepId}" not found in workflow`);
        }
        await this.executeStepWithRetry({
          projectConfig,
          agents,
          workflow,
          step,
          state,
          runDir,
          logger,
        });
      });

      await scheduler.run();
      this.deps.stateManager.updateRun(state, { status: 'completed', completedAt: Date.now() });
      logger.log('workflow.completed', { runId: state.runId, workflowId: state.workflowId });
      this.deps.progressUI.complete(state);
      return state;
    } catch (error) {
      if (error instanceof GateRejectError) {
        this.deps.stateManager.updateRun(state, { status: 'interrupted', completedAt: Date.now() });
        logger.log('workflow.interrupted', { runId: state.runId, workflowId: state.workflowId, reason: 'gate' });
        this.deps.progressUI.complete(state);
        return state;
      }

      const message = error instanceof Error ? error.message : 'workflow execution failed';
      this.deps.stateManager.updateRun(state, {
        status: 'failed',
        completedAt: Date.now(),
      });
      logger.log('workflow.failed', {
        runId: state.runId,
        workflowId: state.workflowId,
        error: message,
        ...getRuntimeErrorMeta(error),
      });
      this.deps.progressUI.stop();
      throw error;
    } finally {
      process.off('SIGINT', onSigint);
    }
  }

  private async executeStepWithRetry(params: {
    projectConfig: ProjectConfig;
    agents: Map<string, AgentConfig>;
    workflow: WorkflowConfig;
    step: StepConfig;
    state: RunState;
    runDir: string;
    logger: EventLogger;
  }): Promise<void> {
    const { projectConfig, step, logger, state, workflow } = params;
    const retryConfig = step.retry ?? projectConfig.retry;
    const maxAttempts = Math.max(0, retryConfig.max_attempts);
    const delayMs = Math.max(0, retryConfig.delay_seconds) * 1000;

    for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.executeStepCore(params);
        return;
      } catch (error) {
        if (error instanceof GateRejectError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : 'unknown runtime error';
        if (attempt < maxAttempts) {
          const retryCount = attempt + 1;
          this.deps.stateManager.updateStep(state, step.id, {
            retryCount,
            error: message,
            status: 'pending',
            startedAt: undefined,
            completedAt: undefined,
          });
          logger.log('step.retrying', {
            stepId: step.id,
            attempt: retryCount,
            maxAttempts,
            delaySeconds: retryConfig.delay_seconds,
            error: message,
            ...getRuntimeErrorMeta(error),
          });
          this.deps.progressUI.announceRetry(step.id, retryCount, maxAttempts, message);
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // All retries exhausted - handle based on on_failure strategy
        const onFailure = step.on_failure ?? 'fail';

        switch (onFailure) {
          case 'skip':
            // Mark as skipped and continue
            this.deps.stateManager.updateStep(state, step.id, {
              status: 'skipped',
              completedAt: Date.now(),
              error: message,
            });
            logger.log('step.skipped', {
              stepId: step.id,
              error: message,
              reason: 'on_failure=skip',
            });
            this.deps.progressUI.updateStep(step.id, 'skipped', { error: message });
            return; // Don't throw, allow workflow to continue

          case 'fallback':
            // Execute with fallback agent
            logger.log('step.retrying', {
              stepId: step.id,
              attempt: 'fallback',
              fallbackAgent: step.fallback_agent,
              error: message,
            });
            try {
              await this.executeStepCore({
                ...params,
                step: {
                  ...step,
                  agent: step.fallback_agent!,
                  id: step.id, // Keep original step ID
                },
              });
              return;
            } catch (fallbackError) {
              // Fallback also failed, mark as failed
              const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'fallback failed';
              this.deps.stateManager.updateStep(state, step.id, {
                status: 'failed',
                completedAt: Date.now(),
                error: `Primary: ${message}; Fallback: ${fallbackMessage}`,
              });
              logger.log('step.failed', {
                stepId: step.id,
                error: `Primary: ${message}; Fallback: ${fallbackMessage}`,
                ...getRuntimeErrorMeta(fallbackError),
              });
              this.deps.progressUI.updateStep(step.id, 'failed', { error: fallbackMessage });
              throw fallbackError;
            }

          case 'notify':
            if (step.notify?.webhook) {
              await sendWebhookNotification(step.notify.webhook, {
                workflowId: workflow.workflow.id,
                runId: state.runId,
                stepId: step.id,
                agent: step.agent,
                error: message,
                timestamp: Date.now(),
              });
            }
            this.deps.stateManager.updateStep(state, step.id, {
              status: 'failed',
              completedAt: Date.now(),
              error: message,
            });
            logger.log('step.failed', {
              stepId: step.id,
              error: message,
              reason: 'on_failure=notify',
              ...getRuntimeErrorMeta(error),
            });
            this.deps.progressUI.updateStep(step.id, 'failed', { error: message });
            throw error;

          case 'fail':
          default:
            // Send webhook notification if configured
            if (step.notify?.webhook) {
              await sendWebhookNotification(step.notify.webhook, {
                workflowId: workflow.workflow.id,
                runId: state.runId,
                stepId: step.id,
                agent: step.agent,
                error: message,
                timestamp: Date.now(),
              });
            }

            // Mark as failed and throw
            this.deps.stateManager.updateStep(state, step.id, {
              status: 'failed',
              completedAt: Date.now(),
              error: message,
            });
            logger.log('step.failed', {
              stepId: step.id,
              error: message,
              ...getRuntimeErrorMeta(error),
            });
            this.deps.progressUI.updateStep(step.id, 'failed', { error: message });
            throw error;
        }
      }
    }
  }

  private async executeStepCore(params: {
    projectConfig: ProjectConfig;
    agents: Map<string, AgentConfig>;
    workflow: WorkflowConfig;
    step: StepConfig;
    state: RunState;
    runDir: string;
    logger: EventLogger;
  }): Promise<void> {
    const { projectConfig, agents, workflow, step, state, runDir, logger } = params;
    const startedAt = Date.now();
    this.deps.stateManager.updateStep(state, step.id, {
      status: 'running',
      startedAt,
    });
    this.deps.progressUI.updateStep(step.id, 'running');
    logger.log('step.started', { stepId: step.id, agent: step.agent });

    const agent = agents.get(step.agent);
    if (!agent) {
      throw new Error(`Agent "${step.agent}" not found`);
    }

    const renderedPrompt = renderTemplate(step.task, {
      input: state.input,
      inputs: state.inputData,
      workflowId: workflow.workflow.id,
      runId: state.runId,
      runDir,
      steps: Object.fromEntries(
        Object.entries(state.steps).map(([stepId, stepState]) => [stepId, { outputFile: stepState.outputFile }]),
      ),
    });

    // Resolve custom filename if configured
    let customFilename: string | undefined;
    if (workflow.output.files) {
      const fileConfig = workflow.output.files.find((f) => f.step === step.id);
      if (fileConfig) {
        customFilename = renderTemplate(fileConfig.filename, {
          input: state.input,
          inputs: state.inputData,
          workflowId: workflow.workflow.id,
          runId: state.runId,
          runDir,
          steps: Object.fromEntries(
            Object.entries(state.steps).map(([stepId, stepState]) => [stepId, { outputFile: stepState.outputFile }]),
          ),
        });
      }
    }

    const runtime = this.deps.runtimeFactory(agent.runtime.type, projectConfig, agent);
    const model = agent.runtime.model || projectConfig.runtime.default_model;
    const timeoutSeconds = agent.runtime.timeout_seconds || 300;

    // Determine cache settings (step-level overrides workflow-level)
    const cacheConfig = step.cache ?? workflow.cache;
    const cacheEnabled = cacheConfig?.enabled ?? false;
    const cacheTtl = cacheConfig?.ttl ?? 3600;

    // Check cache if enabled
    if (cacheEnabled && this.deps.cache) {
      const cacheKey = this.deps.cache.computeKey(step.id, step.agent, renderedPrompt, model);
      const cached = this.deps.cache.get(cacheKey);

      if (cached) {
        // Use cached result
        const outputFile = this.deps.outputWriter.writeStepOutput(runDir, step.id, cached.output, customFilename);
        const outputFileName = path.basename(outputFile);
        const durationMs = Date.now() - startedAt;

        this.deps.stateManager.updateStep(state, step.id, {
          status: 'completed',
          completedAt: Date.now(),
          outputFile: outputFileName,
          tokenUsage: cached.tokenUsage,
          durationMs,
        });

        logger.log('step.cached', {
          stepId: step.id,
          cached: true,
          outputFile: outputFileName,
        });

        const previewLines = projectConfig.output.preview_lines;
        this.deps.progressUI.updateStep(step.id, 'completed', {
          duration: durationMs,
          outputPreview: cached.output.split('\n').slice(0, previewLines).join('\n'),
          tokenUsage: cached.tokenUsage,
        });

        return;
      }
    }

    try {
      const result = await runtime.execute({
        systemPrompt: agent.prompt.system,
        userPrompt: renderedPrompt,
        model,
        timeoutSeconds,
      });

      // Store in cache if enabled
      if (cacheEnabled && this.deps.cache) {
        const cacheKey = this.deps.cache.computeKey(step.id, step.agent, renderedPrompt, model);
        this.deps.cache.set(cacheKey, {
          output: result.output,
          tokenUsage: result.tokenUsage,
          durationMs: result.duration,
        }, cacheTtl);
      }

      const outputFile = this.deps.outputWriter.writeStepOutput(runDir, step.id, result.output, customFilename);
      const outputFileName = path.basename(outputFile);
      const durationMs = Date.now() - startedAt;
      this.deps.stateManager.updateStep(state, step.id, {
        status: 'completed',
        completedAt: Date.now(),
        outputFile: outputFileName,
        tokenUsage: result.tokenUsage,
        durationMs,
      });
      logger.log('step.completed', {
        stepId: step.id,
        duration: result.duration,
        outputFile: outputFileName,
        tokenUsage: result.tokenUsage,
      });
      const previewLines = projectConfig.output.preview_lines;
      this.deps.progressUI.updateStep(step.id, 'completed', {
        duration: durationMs,
        outputPreview: result.output.split('\n').slice(0, previewLines).join('\n'),
        tokenUsage: result.tokenUsage,
      });

      if (step.gate === 'approve') {
        logger.log('gate.waiting', { stepId: step.id, gateType: 'approve' });
        this.deps.progressUI.showGatePrompt(step.id, result.output, previewLines);
        const decision = await this.deps.gateManager.handleGate(step.id, 'approve', result.output);
        if (decision.action === 'abort') {
          logger.log('gate.rejected', { stepId: step.id });
          throw new GateRejectError(step.id);
        }
        if (decision.action === 'edit') {
          this.deps.outputWriter.writeStepOutput(runDir, step.id, decision.editedOutput, customFilename);
          logger.log('gate.edited', { stepId: step.id });
        } else {
          logger.log('gate.approved', { stepId: step.id });
        }
      }
    } catch (error) {
      if (error instanceof GateRejectError) {
        throw error;
      }
      if (error instanceof RuntimeError) {
        throw new RuntimeError(error.message, step.id, error.details);
      }
      const message = error instanceof Error ? error.message : 'unknown runtime error';
      throw new RuntimeError(message, step.id);
    }
  }
}
