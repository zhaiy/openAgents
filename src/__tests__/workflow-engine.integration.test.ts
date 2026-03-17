import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../output/notifier.js', () => ({
  sendWebhookNotification: vi.fn(async () => {}),
}));

import { ConfigLoader } from '../config/loader.js';
import { RuntimeError } from '../errors.js';
import { GateManager } from '../engine/gate.js';
import { StateManager } from '../engine/state.js';
import { WorkflowEngine } from '../engine/workflow-engine.js';
import { sendWebhookNotification } from '../output/notifier.js';
import { OutputWriter } from '../output/writer.js';
import type { AgentConfig, AgentRuntime, ExecuteResult, ProjectConfig, RuntimeType } from '../types/index.js';

const tempRoots: string[] = [];

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createTempProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-engine-it-'));
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
  delay_seconds: 0
output:
  base_directory: ./output
  preview_lines: 5
`,
  );
  return root;
}

function createEngine(
  root: string,
  runtimeFactory: (type: RuntimeType, projectConfig: ProjectConfig, agentConfig?: AgentConfig) => AgentRuntime,
): { engine: WorkflowEngine; stateManager: StateManager } {
  const loader = new ConfigLoader(root);
  const projectConfig = loader.loadProjectConfig();
  const outputBaseDir = path.resolve(root, projectConfig.output.base_directory);
  const stateManager = new StateManager(outputBaseDir);
  const outputWriter = new OutputWriter();
  const gateManager = new GateManager('en', { autoApprove: true });
  const progressUI = {
    start: () => {},
    updateStep: () => {},
    announceRetry: () => {},
    showGatePrompt: () => {},
    complete: () => {},
    stop: () => {},
  };
  const engine = new WorkflowEngine({
    configLoader: loader,
    stateManager,
    runtimeFactory,
    outputWriter,
    gateManager,
    progressUI: progressUI as never,
  });
  return { engine, stateManager };
}

afterEach(() => {
  vi.clearAllMocks();
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.length = 0;
});

describe('WorkflowEngine integration', () => {
  it('continues downstream execution when dependency is skipped', async () => {
    const root = createTempProject();
    write(
      path.join(root, 'agents/failer.yaml'),
      `agent:
  id: failer
  name: Failer
  description: always fails
prompt:
  system: fail
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 5
`,
    );
    write(
      path.join(root, 'agents/writer.yaml'),
      `agent:
  id: writer
  name: Writer
  description: succeeds
prompt:
  system: write
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 5
`,
    );
    write(
      path.join(root, 'workflows/demo.yaml'),
      `workflow:
  id: demo
  name: Demo
  description: test skip
steps:
  - id: precheck
    agent: failer
    task: fail here
    on_failure: skip
  - id: main
    agent: writer
    depends_on: [precheck]
    task: continue
output:
  directory: ./output
`,
    );

    const runtimeFactory = (_type: RuntimeType, _projectConfig: ProjectConfig, agentConfig?: AgentConfig): AgentRuntime => ({
      execute: async (): Promise<ExecuteResult> => {
        if (agentConfig?.agent.id === 'failer') {
          throw new RuntimeError('expected failure', 'precheck');
        }
        return { output: 'ok', duration: 1 };
      },
    });
    const { engine } = createEngine(root, runtimeFactory);

    const state = await engine.run('demo', 'input');
    expect(state.status).toBe('completed');
    expect(state.steps.precheck.status).toBe('skipped');
    expect(state.steps.main.status).toBe('completed');
  });

  it('uses fallback agent when primary agent fails', async () => {
    const root = createTempProject();
    write(
      path.join(root, 'agents/primary.yaml'),
      `agent:
  id: primary
  name: Primary
  description: always fails
prompt:
  system: primary
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 5
`,
    );
    write(
      path.join(root, 'agents/backup.yaml'),
      `agent:
  id: backup
  name: Backup
  description: succeeds
prompt:
  system: backup
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 5
`,
    );
    write(
      path.join(root, 'workflows/demo.yaml'),
      `workflow:
  id: demo
  name: Demo
  description: test fallback
steps:
  - id: write
    agent: primary
    task: produce content
    on_failure: fallback
    fallback_agent: backup
output:
  directory: ./output
`,
    );

    const runtimeFactory = (_type: RuntimeType, _projectConfig: ProjectConfig, agentConfig?: AgentConfig): AgentRuntime => ({
      execute: async (): Promise<ExecuteResult> => {
        if (agentConfig?.agent.id === 'primary') {
          throw new RuntimeError('primary failed', 'write');
        }
        return { output: 'from-backup', duration: 1 };
      },
    });
    const { engine } = createEngine(root, runtimeFactory);

    const state = await engine.run('demo', 'input');
    expect(state.status).toBe('completed');
    expect(state.steps.write.status).toBe('completed');
  });

  it('triggers webhook and fails run when on_failure=notify', async () => {
    const root = createTempProject();
    write(
      path.join(root, 'agents/failer.yaml'),
      `agent:
  id: failer
  name: Failer
  description: always fails
prompt:
  system: fail
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 5
`,
    );
    write(
      path.join(root, 'agents/writer.yaml'),
      `agent:
  id: writer
  name: Writer
  description: should not execute
prompt:
  system: write
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 5
`,
    );
    write(
      path.join(root, 'workflows/demo.yaml'),
      `workflow:
  id: demo
  name: Demo
  description: test notify
steps:
  - id: precheck
    agent: failer
    task: fail here
    on_failure: notify
    notify:
      webhook: https://example.com/hook
  - id: main
    agent: writer
    depends_on: [precheck]
    task: should not run
output:
  directory: ./output
`,
    );

    const runtimeFactory = (_type: RuntimeType, _projectConfig: ProjectConfig, agentConfig?: AgentConfig): AgentRuntime => ({
      execute: async (): Promise<ExecuteResult> => {
        if (agentConfig?.agent.id === 'failer') {
          throw new RuntimeError('notify failure', 'precheck');
        }
        return { output: 'unexpected', duration: 1 };
      },
    });
    const { engine, stateManager } = createEngine(root, runtimeFactory);

    await expect(engine.run('demo', 'input')).rejects.toThrow('notify failure');
    expect(sendWebhookNotification).toHaveBeenCalledTimes(1);

    const [run] = stateManager.listRuns({ workflowId: 'demo' });
    expect(run.status).toBe('failed');
    expect(run.steps.precheck.status).toBe('failed');
    expect(run.steps.main.status).toBe('pending');
  });
});
