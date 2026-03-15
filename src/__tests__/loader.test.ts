import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ConfigLoader } from '../config/loader.js';
import { ConfigError } from '../errors.js';

function createTempProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-loader-'));
  fs.mkdirSync(path.join(root, 'agents'));
  fs.mkdirSync(path.join(root, 'workflows'));
  return root;
}

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.length = 0;
});

describe('ConfigLoader', () => {
  it('loads project/agents/workflow configs', () => {
    const root = createTempProject();
    tempRoots.push(root);
    write(
      path.join(root, 'openagents.yaml'),
      `version: "1"
runtime:
  default_type: llm-direct
  default_model: qwen-plus
retry:
  max_attempts: 2
  delay_seconds: 5
output:
  base_directory: ./output
  preview_lines: 10
`,
    );
    write(
      path.join(root, 'agents/planner.yaml'),
      `agent:
  id: planner
  name: Planner
  description: desc
prompt:
  system: system
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 10
`,
    );
    write(
      path.join(root, 'workflows/demo.yaml'),
      `workflow:
  id: demo
  name: Demo
  description: desc
steps:
  - id: s1
    agent: planner
    task: hello
output:
  directory: ./output
`,
    );

    const loader = new ConfigLoader(root);
    expect(loader.loadProjectConfig().version).toBe('1');
    expect(loader.loadAgents().size).toBe(1);
    expect(loader.loadWorkflow('demo').workflow.id).toBe('demo');
  });

  it('validates cross references', () => {
    const root = createTempProject();
    tempRoots.push(root);
    write(
      path.join(root, 'openagents.yaml'),
      `version: "1"
runtime:
  default_type: llm-direct
  default_model: qwen-plus
retry:
  max_attempts: 2
  delay_seconds: 5
output:
  base_directory: ./output
  preview_lines: 10
`,
    );
    write(
      path.join(root, 'agents/planner.yaml'),
      `agent:
  id: planner
  name: Planner
  description: desc
prompt:
  system: system
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 10
`,
    );
    write(
      path.join(root, 'workflows/demo.yaml'),
      `workflow:
  id: demo
  name: Demo
  description: desc
steps:
  - id: s1
    agent: unknown_agent
    task: hello
output:
  directory: ./output
`,
    );

    const loader = new ConfigLoader(root);
    const workflow = loader.loadWorkflow('demo');
    const agents = loader.loadAgents();
    expect(() => loader.validateReferences(agents, workflow)).toThrowError(ConfigError);
  });

  it('throws when missing workflow', () => {
    const root = createTempProject();
    tempRoots.push(root);
    write(
      path.join(root, 'openagents.yaml'),
      `version: "1"
runtime:
  default_type: llm-direct
  default_model: qwen-plus
retry:
  max_attempts: 2
  delay_seconds: 5
output:
  base_directory: ./output
  preview_lines: 10
`,
    );
    const loader = new ConfigLoader(root);
    expect(() => loader.loadWorkflow('missing')).toThrowError(ConfigError);
  });

  it('throws when yaml is invalid', () => {
    const root = createTempProject();
    tempRoots.push(root);
    write(path.join(root, 'openagents.yaml'), `invalid: [`);
    const loader = new ConfigLoader(root);
    expect(() => loader.loadProjectConfig()).toThrowError(ConfigError);
  });

  it('throws when duplicate agent ids exist', () => {
    const root = createTempProject();
    tempRoots.push(root);
    write(
      path.join(root, 'openagents.yaml'),
      `version: "1"
runtime:
  default_type: llm-direct
  default_model: qwen-plus
retry:
  max_attempts: 2
  delay_seconds: 5
output:
  base_directory: ./output
  preview_lines: 10
`,
    );
    write(
      path.join(root, 'agents/a.yaml'),
      `agent:
  id: planner
  name: Planner A
  description: desc
prompt:
  system: system
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 10
`,
    );
    write(
      path.join(root, 'agents/b.yaml'),
      `agent:
  id: planner
  name: Planner B
  description: desc
prompt:
  system: system
runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 10
`,
    );

    const loader = new ConfigLoader(root);
    expect(() => loader.loadAgents()).toThrowError(ConfigError);
  });
});
