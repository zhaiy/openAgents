import { describe, expect, it } from 'vitest';

import type { AgentConfig, ProjectConfig } from '../types/index.js';
import { createRuntime } from '../runtime/factory.js';
import { ScriptRuntime } from '../runtime/script.js';

const projectConfig: ProjectConfig = {
  version: '1',
  runtime: {
    default_type: 'llm-direct',
    default_model: 'qwen-plus',
    api_base_url: 'https://dashscope.aliyuncs.com/compatible-mode',
  },
  retry: {
    max_attempts: 2,
    delay_seconds: 5,
  },
  output: {
    base_directory: './output',
    preview_lines: 10,
  },
};

describe('runtime factory', () => {
  it('creates llm-direct runtime', () => {
    process.env.OPENAGENTS_API_KEY = 'test-key';
    const runtime = createRuntime('llm-direct', projectConfig);
    expect(runtime).toBeTruthy();
    delete process.env.OPENAGENTS_API_KEY;
  });

  it('creates script runtime with inline script', () => {
    const agentConfig: AgentConfig = {
      agent: { id: 'test', name: 'Test', description: 'Test agent' },
      prompt: { system: 'test' },
      runtime: { type: 'script', model: '', timeout_seconds: 30 },
      script: { inline: 'return "hello"' },
    };
    const runtime = createRuntime('script', projectConfig, agentConfig);
    expect(runtime).toBeInstanceOf(ScriptRuntime);
  });

  it('creates script runtime with script file', () => {
    const agentConfig: AgentConfig = {
      agent: { id: 'test', name: 'Test', description: 'Test agent' },
      prompt: { system: 'test' },
      runtime: { type: 'script', model: '', timeout_seconds: 30 },
      script: { file: 'scripts/test.js' },
    };
    const runtime = createRuntime('script', projectConfig, agentConfig);
    expect(runtime).toBeInstanceOf(ScriptRuntime);
  });

  it('throws for unsupported runtime', () => {
    // Cast is used only to test fallback branch.
    expect(() => createRuntime('openclaw', projectConfig)).toThrow();
  });
});
