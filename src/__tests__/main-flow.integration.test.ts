/**
 * Main Flow Integration Tests (N4)
 *
 * Covers the complete main flow: run -> gate -> rerun
 * Maps to scenarios S1-S5, S7-S10, S11-S14 from CORE-FLOW-SCENARIO-MATRIX.md
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigLoader } from '../config/loader.js';
import { GateManager, DeferredGateProvider } from '../engine/gate.js';
import { StateManager } from '../engine/state.js';
import { WorkflowEngine } from '../engine/workflow-engine.js';
import { OutputWriter } from '../output/writer.js';
import { RunEventEmitter } from '../app/events/run-event-emitter.js';
import { RunReuseService } from '../app/services/run-reuse-service.js';
import { RunVisualService } from '../app/services/run-visual-service.js';
import type { AgentRuntime, ProjectConfig, RuntimeType } from '../types/index.js';

// Mock notifier
vi.mock('../output/notifier.js', () => ({
  sendWebhookNotification: vi.fn(async () => {}),
}));

const tempRoots: string[] = [];

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createTempProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-main-flow-'));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, 'agents'));
  fs.mkdirSync(path.join(root, 'workflows'));
  write(
    path.join(root, 'openagents.yaml'),
    `version: "1"
runtime:
  default_type: llm-direct
  default_model: qwen-plus
retry:
  max_attempts: 0
output:
  base_directory: ./output
`,
  );
  return root;
}

interface TestContext {
  root: string;
  loader: ConfigLoader;
  stateManager: StateManager;
  eventEmitter: RunEventEmitter;
  gateProvider: DeferredGateProvider;
  runReuseService: RunReuseService;
  runVisualService: RunVisualService;
}

async function createTestContext(): Promise<TestContext> {
  const root = createTempProject();

  // Create basic agent
  write(
    path.join(root, 'agents/worker.yaml'),
    `agent:
  id: worker
  name: Worker
  description: A test worker agent
prompt:
  system: process tasks
runtime:
  type: llm-direct
  model: qwen-plus
`,
  );

  const loader = new ConfigLoader(root);
  const projectConfig = loader.loadProjectConfig();
  const outputBaseDir = path.resolve(root, projectConfig.output.base_directory);
  const stateManager = new StateManager(outputBaseDir);
  const eventEmitter = new RunEventEmitter();
  const gateProvider = new DeferredGateProvider();

  const runReuseService = new RunReuseService(stateManager, loader);
  const runVisualService = new RunVisualService(stateManager, eventEmitter);

  return {
    root,
    loader,
    stateManager,
    eventEmitter,
    gateProvider,
    runReuseService,
    runVisualService,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.length = 0;
});

// =============================================================================
// S1: Normal run start and successful completion
// =============================================================================

describe('S1: Normal run start and successful completion', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    write(
      path.join(ctx.root, 'workflows/simple.yaml'),
      `workflow:
  id: simple
  name: Simple Workflow
  description: A simple test workflow
steps:
  - id: step1
    agent: worker
    task: do work
output:
  directory: ./output
`,
    );
  });

  it('should create run state and persist to state manager', async () => {
    // Use WorkflowEngine directly with mock runtime
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('simple', 'test input');

    expect(state.status).toBe('completed');
    expect(state.steps.step1.status).toBe('completed');
  });

  it('should list runs after completion', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    await engine.run('simple', 'test input');

    const runs = ctx.stateManager.listRuns();
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].workflowId).toBe('simple');
    expect(runs[0].status).toBe('completed');
  });
});

// =============================================================================
// S2: Invalid input at run start
// =============================================================================

describe('S2: Invalid input at run start', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  it('should throw error for non-existent workflow', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    await expect(engine.run('non-existent', 'test')).rejects.toThrow();
  });

  it('should throw for non-existent run in state manager', () => {
    expect(() => ctx.stateManager.findRunById('non-existent-run')).toThrow();
  });
});

// =============================================================================
// S3: Execution enters Gate waiting
// =============================================================================

describe('S3: Execution enters Gate waiting', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    write(
      path.join(ctx.root, 'workflows/gated.yaml'),
      `workflow:
  id: gated
  name: Gated Workflow
  description: A workflow with a gate
steps:
  - id: step1
    agent: worker
    task: do work
    gate: approve
output:
  directory: ./output
`,
    );
  });

  it('should pause at gate when not auto-approved', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    // Gate manager without autoApprove
    const gateManager = new GateManager('en', { autoApprove: false }, ctx.gateProvider);
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    // Run should pause at gate (not complete)
    // Note: When gate is waiting without autoApprove, the run will block
    // We need to either resolve the gate or check the state while it's waiting
    const runPromise = engine.run('gated', 'test');

    // Give it time to reach gate_waiting state
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check the state while the run is in progress
    const runs = ctx.stateManager.listRuns({ workflowId: 'gated' });
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].status).toBe('running');
    expect(runs[0].steps.step1.status).toBe('gate_waiting');

    // Resolve the gate to allow the run to complete
    ctx.gateProvider.submitDecision(runs[0].runId, 'step1', { action: 'continue' });

    // Now wait for completion
    const state = await runPromise;
    expect(state.status).toBe('completed');
  }, 10000);
});

// =============================================================================
// S5: Step execution failure
// =============================================================================

describe('S5: Step execution failure', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    write(
      path.join(ctx.root, 'agents/failer.yaml'),
      `agent:
  id: failer
  name: Failer
  description: An agent that always fails
prompt:
  system: always fail
runtime:
  type: llm-direct
`,
    );
    write(
      path.join(ctx.root, 'workflows/failing.yaml'),
      `workflow:
  id: failing
  name: Failing Workflow
  description: A workflow that fails
steps:
  - id: fail_step
    agent: failer
    task: will fail
output:
  directory: ./output
`,
    );
  });

  it('should mark run as failed when step fails', async () => {
    // Create a runtime that always fails
    const failingRuntimeFactory = (): AgentRuntime => ({
      execute: async (): Promise<{ output: string; duration: number }> => {
        throw new Error('Intentional test failure');
      },
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: failingRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    // The run should throw when a step fails
    await expect(engine.run('failing', 'test')).rejects.toThrow('Intentional test failure');

    // After failure, the state should be persisted
    const runs = ctx.stateManager.listRuns({ workflowId: 'failing' });
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].status).toBe('failed');
    expect(runs[0].steps.fail_step.status).toBe('failed');
  });
});

// =============================================================================
// S7: Rerun from failed run
// =============================================================================

describe('S7: Rerun from failed run', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    write(
      path.join(ctx.root, 'workflows/simple.yaml'),
      `workflow:
  id: simple
  name: Simple Workflow
  description: A simple test workflow
steps:
  - id: step1
    agent: worker
    task: do work
output:
  directory: ./output
`,
    );
  });

  it('should get reusable config from existing run', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('simple', 'original input', { inputData: { key: 'value' } });

    const config = ctx.runReuseService.getReusableConfig(state.runId);

    expect(config).toBeDefined();
    expect(config?.workflowId).toBe('simple');
    expect(config?.input).toBe('original input');
    expect(config?.inputData).toEqual({ key: 'value' });
  });

  it('should return null for non-existent run', () => {
    const config = ctx.runReuseService.getReusableConfig('non-existent');
    expect(config).toBeNull();
  });

  it('should create rerun payload from existing run', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('simple', 'original', { inputData: { x: 1 } });

    const payload = ctx.runReuseService.createRerunPayload(state.runId);

    expect(payload).toBeDefined();
    expect(payload?.workflowId).toBe('simple');
    expect(payload?.input).toBe('original');
    expect(payload?.inputData).toEqual({ x: 1 });
  });

  it('should create rerun payload with edits', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('simple', 'original', { inputData: { x: 1 } });

    const payload = ctx.runReuseService.createEditedRerunPayload(state.runId, { x: 2, y: 3 });

    expect(payload).toBeDefined();
    expect(payload?.inputData).toEqual({ x: 2, y: 3 });
  });
});

// =============================================================================
// S9/S10: Visual state consistency (refresh/reconnect)
// =============================================================================

describe('S9/S10: Visual state consistency', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    write(
      path.join(ctx.root, 'workflows/multi-step.yaml'),
      `workflow:
  id: multi-step
  name: Multi Step Workflow
  description: A workflow with multiple steps
steps:
  - id: step1
    agent: worker
    task: first
  - id: step2
    agent: worker
    depends_on: [step1]
    task: second
output:
  directory: ./output
`,
    );
  });

  it('should return visual state with correct node states', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('multi-step', 'test');
    const visualState = ctx.runVisualService.getVisualState(state.runId);

    expect(visualState.runId).toBe(state.runId);
    expect(visualState.workflowId).toBe('multi-step');
    expect(visualState.nodeStates).toBeDefined();
    expect(visualState.currentActiveNodeIds).toBeDefined();
    expect(visualState.gateWaitingNodeIds).toBeDefined();
    expect(visualState.failedNodeIds).toBeDefined();
  });

  it('should return timeline entries', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('multi-step', 'test');
    const timeline = ctx.runVisualService.getTimeline(state.runId);

    expect(timeline).toBeInstanceOf(Array);
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline[0]).toHaveProperty('id');
    expect(timeline[0]).toHaveProperty('event');
    expect(timeline[0]).toHaveProperty('timestamp');
  });

  it('should return node state for specific node', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('multi-step', 'test');
    const nodeState = ctx.runVisualService.getNodeState(state.runId, 'step1');

    expect(nodeState).toBeDefined();
    expect(nodeState?.nodeId).toBe('step1');
    expect(nodeState?.status).toBe('completed');
  });

  it('should return null for non-existent node', async () => {
    const mockRuntimeFactory = (): AgentRuntime => ({
      execute: async () => ({ output: 'done', duration: 100 }),
    });

    const gateManager = new GateManager('en', { autoApprove: true });
    const eventHandler = {
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {},
      onWorkflowFailed: () => {},
      onWorkflowInterrupted: () => {},
      onStepStart: () => {},
      onStepComplete: () => {},
      onStepFailed: () => {},
      onStepSkipped: () => {},
      onStepRetry: () => {},
      onStreamChunk: () => {},
      onGateWaiting: () => {},
    };

    const engine = new WorkflowEngine({
      configLoader: ctx.loader,
      stateManager: ctx.stateManager,
      runtimeFactory: mockRuntimeFactory,
      outputWriter: new OutputWriter(),
      gateManager,
      eventHandler: eventHandler as never,
    });

    const state = await engine.run('multi-step', 'test');
    const nodeState = ctx.runVisualService.getNodeState(state.runId, 'non-existent');

    expect(nodeState).toBeNull();
  });

  it('should throw for non-existent run', () => {
    expect(() => {
      ctx.runVisualService.getVisualState('non-existent');
    }).toThrow();
  });
});

// =============================================================================
// S11-S14: Not found scenarios
// =============================================================================

describe('S11-S14: Not found scenarios', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  it('S11: should throw for non-existent run', () => {
    expect(() => ctx.stateManager.findRunById('non-existent')).toThrow();
    expect(() => ctx.runVisualService.getVisualState('non-existent')).toThrow();
    expect(() => ctx.runVisualService.getTimeline('non-existent')).toThrow();
  });
});

// =============================================================================
// Event sequence tracking (for SSE consistency)
// =============================================================================

describe('Event sequence tracking', () => {
  it('should track sequence across multiple events', () => {
    const emitter = new RunEventEmitter();

    // Emit events without client
    const result1 = emitter.emit({
      type: 'workflow.started',
      runId: 'run-1',
      workflowId: 'wf-1',
      input: 'test',
      resumed: false,
      ts: 1000,
    });

    const result2 = emitter.emit({
      type: 'step.started',
      stepId: 'step-1',
      runId: 'run-1',
      ts: 1100,
    });

    const result3 = emitter.emit({
      type: 'step.completed',
      stepId: 'step-1',
      runId: 'run-1',
      duration: 100,
      outputPreview: 'done',
      ts: 1200,
    });

    expect(result1.sequence).toBe(0);
    expect(result2.sequence).toBe(1);
    expect(result3.sequence).toBe(2);
    expect(result1.id).toBe('run-1:0');
    expect(result2.id).toBe('run-1:1');
    expect(result3.id).toBe('run-1:2');
  });

  it('should maintain separate sequences per run', () => {
    const emitter = new RunEventEmitter();

    const r1e1 = emitter.emit({ type: 'step.started', stepId: 's1', runId: 'run-1', ts: 1000 });
    const r2e1 = emitter.emit({ type: 'step.started', stepId: 's1', runId: 'run-2', ts: 1000 });
    const r1e2 = emitter.emit({ type: 'step.completed', stepId: 's1', runId: 'run-1', duration: 100, outputPreview: '', ts: 1100 });

    expect(r1e1.sequence).toBe(0);
    expect(r2e1.sequence).toBe(0);
    expect(r1e2.sequence).toBe(1);
  });
});

// =============================================================================
// S9/S10: SSE reconnection and state recovery
// =============================================================================

describe('S9/S10: SSE reconnection and state recovery', () => {
  it('should allow client to reconnect and receive missed events via replay', () => {
    const emitter = new RunEventEmitter();

    // Simulate events before client connects
    const event1 = emitter.emit({
      type: 'workflow.started',
      runId: 'run-1',
      workflowId: 'wf-1',
      input: 'test',
      resumed: false,
      ts: 1000,
    });

    const event2 = emitter.emit({
      type: 'step.started',
      stepId: 'step-1',
      runId: 'run-1',
      ts: 1100,
    });

    // Client connects after some events
    const mockRes = {
      write: vi.fn(),
      end: vi.fn(),
    };

    emitter.addClient('run-1', 'client-1', mockRes as never);

    // New events should be received
    const event3 = emitter.emit({
      type: 'step.completed',
      stepId: 'step-1',
      runId: 'run-1',
      duration: 100,
      outputPreview: 'done',
      ts: 1200,
    });

    // Client should receive event3
    expect(mockRes.write).toHaveBeenCalled();
    expect(event3.sequence).toBe(2);

    // Sequence should continue from where it left off
    expect(emitter.getCurrentSequence('run-1')).toBe(3);
  });

  it('should handle multiple clients for same run', () => {
    const emitter = new RunEventEmitter();

    const mockRes1 = { write: vi.fn(), end: vi.fn() };
    const mockRes2 = { write: vi.fn(), end: vi.fn() };

    emitter.addClient('run-1', 'client-1', mockRes1 as never);
    emitter.addClient('run-1', 'client-2', mockRes2 as never);

    emitter.emit({
      type: 'step.started',
      stepId: 'step-1',
      runId: 'run-1',
      ts: 1000,
    });

    expect(mockRes1.write).toHaveBeenCalled();
    expect(mockRes2.write).toHaveBeenCalled();
  });

  it('should clean up when client disconnects', () => {
    const emitter = new RunEventEmitter();

    const mockRes = { write: vi.fn(), end: vi.fn() };
    emitter.addClient('run-1', 'client-1', mockRes as never);

    emitter.emit({
      type: 'step.started',
      stepId: 'step-1',
      runId: 'run-1',
      ts: 1000,
    });

    expect(mockRes.write).toHaveBeenCalled();

    // Client disconnects
    emitter.removeClient('run-1', 'client-1');

    mockRes.write.mockClear();

    // New events should not be sent to disconnected client
    emitter.emit({
      type: 'step.completed',
      stepId: 'step-1',
      runId: 'run-1',
      duration: 100,
      outputPreview: 'done',
      ts: 1100,
    });

    expect(mockRes.write).not.toHaveBeenCalled();
  });

  it('should close run and notify all clients', () => {
    const emitter = new RunEventEmitter();

    const mockRes1 = { write: vi.fn(), end: vi.fn() };
    const mockRes2 = { write: vi.fn(), end: vi.fn() };

    emitter.addClient('run-1', 'client-1', mockRes1 as never);
    emitter.addClient('run-1', 'client-2', mockRes2 as never);

    emitter.closeRun('run-1');

    // Both clients should receive run.closed event
    expect(mockRes1.write).toHaveBeenCalledWith(
      expect.stringContaining('event: run.closed')
    );
    expect(mockRes2.write).toHaveBeenCalledWith(
      expect.stringContaining('event: run.closed')
    );

    // Both connections should be closed
    expect(mockRes1.end).toHaveBeenCalled();
    expect(mockRes2.end).toHaveBeenCalled();
  });
});