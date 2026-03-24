/**
 * Tests for RunReuseService enhancements (N6)
 *
 * Covers:
 * - ReusableConfigDto extraction with full context
 * - RerunPreviewDto with input diff
 * - Runtime options diff
 * - Warnings generation
 * - Recovery options (reserved for future use)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { ConfigLoader } from '../../config/loader.js';
import { StateManager } from '../../engine/state.js';
import { RunReuseService } from './run-reuse-service.js';
import { WorkflowEngine } from '../../engine/workflow-engine.js';
import { GateManager } from '../../engine/gate.js';
import { OutputWriter } from '../../output/writer.js';
import type { AgentRuntime } from '../../types/index.js';

describe('RunReuseService (N6)', () => {
  let root: string;
  let loader: ConfigLoader;
  let stateManager: StateManager;
  let service: RunReuseService;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-reuse-test-'));

    // Create project config
    fs.writeFileSync(
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

    // Create agents directory
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });

    // Create workflows directory
    fs.mkdirSync(path.join(root, 'workflows'), { recursive: true });

    // Create a simple workflow
    fs.writeFileSync(
      path.join(root, 'workflows', 'test-workflow.yaml'),
      `workflow:
  id: test-workflow
  name: Test Workflow
  description: A test workflow
steps:
  - id: step1
    agent: worker
    task: process \${input}
  - id: step2
    agent: worker
    task: process \${inputData.x}
output:
  directory: ./output
`,
    );

    // Create a workflow with gate
    fs.writeFileSync(
      path.join(root, 'workflows', 'gated-workflow.yaml'),
      `workflow:
  id: gated-workflow
  name: Gated Workflow
  description: A workflow with a gate
steps:
  - id: step1
    agent: worker
    task: process \${input}
  - id: approval
    agent: worker
    task: wait for approval
    gate: approve
output:
  directory: ./output
`,
    );

    // Create basic agent
    fs.writeFileSync(
      path.join(root, 'agents', 'worker.yaml'),
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

    loader = new ConfigLoader(root);
    stateManager = new StateManager(root);
    service = new RunReuseService(stateManager, loader);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  // ===========================================================================
  // ReusableConfigDto tests
  // ===========================================================================

  describe('getReusableConfig', () => {
    it('should return null for non-existent run', () => {
      const config = service.getReusableConfig('non-existent-run');
      expect(config).toBeNull();
    });

    it('should extract full config from completed run', async () => {
      // Create a run
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      const state = await engine.run('test-workflow', 'test input', {
        inputData: { x: 42, y: 'hello' },
      });

      const config = service.getReusableConfig(state.runId);

      expect(config).toBeDefined();
      expect(config?.runId).toBe(state.runId);
      expect(config?.workflowId).toBe('test-workflow');
      expect(config?.workflowName).toBe('Test Workflow');
      expect(config?.input).toBe('test input');
      expect(config?.inputData).toEqual({ x: 42, y: 'hello' });
      expect(config?.runStatus).toBe('completed');
      expect(config?.startedAt).toBeGreaterThan(0);
      expect(config?.durationMs).toBeGreaterThan(0);
    });

    it('should extract config from failed run', async () => {
      const mockRuntimeFactory = (): AgentRuntime => ({
        execute: async () => {
          throw new Error('Step failed');
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      try {
        await engine.run('test-workflow', 'test', { inputData: { x: 1 } });
      } catch {
        // Expected to fail
      }

      const runs = stateManager.listRuns({ workflowId: 'test-workflow' });
      const failedRun = runs.find((r) => r.status === 'failed');

      expect(failedRun).toBeDefined();

      const config = service.getReusableConfig(failedRun!.runId);

      expect(config?.runStatus).toBe('failed');
    });
  });

  // ===========================================================================
  // RerunPreviewDto tests
  // ===========================================================================

  describe('getRerunPreview', () => {
    it('should return null for non-existent run', () => {
      const preview = service.getRerunPreview('non-existent');
      expect(preview).toBeNull();
    });

    it('should show preview without changes', async () => {
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      const state = await engine.run('test-workflow', 'test', { inputData: { x: 1 } });

      const preview = service.getRerunPreview(state.runId);

      expect(preview).toBeDefined();
      expect(preview?.sourceRun.runId).toBe(state.runId);
      expect(preview?.sourceRun.status).toBe('completed');
      expect(preview?.workflow.workflowId).toBe('test-workflow');
      expect(preview?.workflow.name).toBe('Test Workflow');
      expect(preview?.workflow.stepCount).toBe(2);
      expect(preview?.workflow.hasGate).toBe(false);

      // No changes, so no diff
      expect(preview?.inputDiff).toBeUndefined();
      expect(preview?.runtimeOptionsDiff).toBeUndefined();
    });

    it('should show input diff when changes are made', async () => {
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      const state = await engine.run('test-workflow', 'test', { inputData: { x: 1, y: 2 } });

      const preview = service.getRerunPreview(state.runId, {
        inputData: { x: 10, z: 3 }, // x changed, y removed, z added
      });

      expect(preview?.inputDiff).toBeDefined();
      expect(preview?.inputDiff).toHaveLength(3);

      const xDiff = preview?.inputDiff?.find((d) => d.field === 'x');
      expect(xDiff?.type).toBe('changed');
      expect(xDiff?.original).toBe(1);
      expect(xDiff?.new).toBe(10);

      const yDiff = preview?.inputDiff?.find((d) => d.field === 'y');
      expect(yDiff?.type).toBe('removed');
      expect(yDiff?.original).toBe(2);

      const zDiff = preview?.inputDiff?.find((d) => d.field === 'z');
      expect(zDiff?.type).toBe('added');
      expect(zDiff?.new).toBe(3);
    });

    it('should show runtime options diff', async () => {
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      const state = await engine.run('test-workflow', 'test', { inputData: { x: 1 } });

      const preview = service.getRerunPreview(state.runId, {
        runtimeOptions: { stream: false, autoApprove: true },
      });

      expect(preview?.runtimeOptionsDiff).toBeDefined();
      expect(preview?.runtimeOptionsDiff).toHaveLength(2);

      const streamDiff = preview?.runtimeOptionsDiff?.find((d) => d.field === 'stream');
      expect(streamDiff?.original).toBe(true);
      expect(streamDiff?.new).toBe(false);

      const autoApproveDiff = preview?.runtimeOptionsDiff?.find((d) => d.field === 'autoApprove');
      expect(autoApproveDiff?.original).toBe(false);
      expect(autoApproveDiff?.new).toBe(true);
    });

    it('should generate warnings for failed run', async () => {
      const mockRuntimeFactory = (): AgentRuntime => ({
        execute: async () => {
          throw new Error('Step failed');
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      try {
        await engine.run('test-workflow', 'test', { inputData: { x: 1 } });
      } catch {
        // Expected to fail
      }

      const runs = stateManager.listRuns({ workflowId: 'test-workflow' });
      const failedRun = runs.find((r) => r.status === 'failed');

      const preview = service.getRerunPreview(failedRun!.runId);

      expect(preview?.warnings).toBeDefined();
      expect(preview?.warnings).toContain(
        'This run previously failed. Consider reviewing the error before rerunning.',
      );
    });

    it('should generate warning for workflow with gates', async () => {
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      const state = await engine.run('gated-workflow', 'test', { inputData: {} });

      const preview = service.getRerunPreview(state.runId);

      expect(preview?.workflow.hasGate).toBe(true);
      expect(preview?.warnings).toContain(
        'This workflow has gates that may require manual approval.',
      );
    });
  });

  // ===========================================================================
  // createRerunPayload tests
  // ===========================================================================

  describe('createRerunPayload', () => {
    it('should include sourceRunId in payload', async () => {
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      const state = await engine.run('test-workflow', 'test', { inputData: { x: 1 } });

      const payload = service.createRerunPayload(state.runId);

      expect(payload?.sourceRunId).toBe(state.runId);
    });

    it('should support recovery options (reserved)', async () => {
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      const state = await engine.run('test-workflow', 'test', { inputData: { x: 1 } });

      // Test that recovery options can be passed (even if not used yet)
      const payload = service.createRerunPayload(state.runId, {
        recoveryOptions: {
          resumeFromStep: 'step2',
          useCachedSteps: ['step1'],
        },
      });

      expect(payload?.recoveryOptions).toEqual({
        resumeFromStep: 'step2',
        useCachedSteps: ['step1'],
      });
    });
  });

  // ===========================================================================
  // listReusableRuns tests
  // ===========================================================================

  describe('listReusableRuns', () => {
    it('should list runs with duration info', async () => {
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
        configLoader: loader,
        stateManager,
        runtimeFactory: mockRuntimeFactory,
        outputWriter: new OutputWriter(),
        gateManager,
        eventHandler: eventHandler as never,
      });

      await engine.run('test-workflow', 'test1', { inputData: { x: 1 } });

      const runs = service.listReusableRuns('test-workflow');

      expect(runs.length).toBeGreaterThanOrEqual(1);
      expect(runs[0].durationMs).toBeGreaterThan(0);
    });
  });
});