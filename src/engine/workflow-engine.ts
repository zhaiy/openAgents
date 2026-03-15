import path from 'node:path';

import { ConfigLoader } from '../config/loader.js';
import { GateRejectError, RuntimeError } from '../errors.js';
import { EventLogger } from '../output/logger.js';
import { OutputWriter } from '../output/writer.js';
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

type RuntimeFactory = (type: RuntimeType, projectConfig: ProjectConfig) => AgentRuntime;

interface WorkflowEngineDeps {
  configLoader: ConfigLoader;
  stateManager: StateManager;
  runtimeFactory: RuntimeFactory;
  outputWriter: OutputWriter;
  gateManager: GateManager;
  progressUI: ProgressUI;
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

  async run(workflowId: string, input: string): Promise<RunState> {
    const projectConfig = this.deps.configLoader.loadProjectConfig();
    const agents = this.deps.configLoader.loadAgents();
    const workflow = this.deps.configLoader.loadWorkflow(workflowId);
    this.deps.configLoader.validateReferences(agents, workflow);

    const plan = this.dagParser.parse(workflow.steps);
    const runId = this.deps.stateManager.generateRunId();
    const state = this.deps.stateManager.initRun(runId, workflow.workflow.id, input, plan.order);
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
    const { projectConfig, step, logger, state } = params;
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
      workflowId: workflow.workflow.id,
      runId: state.runId,
      runDir,
      steps: Object.fromEntries(
        Object.entries(state.steps).map(([stepId, stepState]) => [stepId, { outputFile: stepState.outputFile }]),
      ),
    });

    const runtime = this.deps.runtimeFactory(agent.runtime.type, projectConfig);
    const model = agent.runtime.model || projectConfig.runtime.default_model;
    const timeoutSeconds = agent.runtime.timeout_seconds || 300;

    try {
      const result = await runtime.execute({
        systemPrompt: agent.prompt.system,
        userPrompt: renderedPrompt,
        model,
        timeoutSeconds,
      });
      const outputFile = this.deps.outputWriter.writeStepOutput(runDir, step.id, result.output);
      const outputFileName = path.basename(outputFile);
      this.deps.stateManager.updateStep(state, step.id, {
        status: 'completed',
        completedAt: Date.now(),
        outputFile: outputFileName,
      });
      logger.log('step.completed', {
        stepId: step.id,
        duration: result.duration,
        outputFile: outputFileName,
      });
      const previewLines = projectConfig.output.preview_lines;
      this.deps.progressUI.updateStep(step.id, 'completed', {
        duration: Date.now() - startedAt,
        outputPreview: result.output.split('\n').slice(0, previewLines).join('\n'),
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
          this.deps.outputWriter.writeStepOutput(runDir, step.id, decision.editedOutput);
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
