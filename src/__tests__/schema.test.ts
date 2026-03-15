import { describe, expect, it } from 'vitest';

import { AgentConfigSchema, ProjectConfigSchema, WorkflowConfigSchema } from '../config/schema.js';

describe('schema validation', () => {
  it('accepts a valid agent config', () => {
    const result = AgentConfigSchema.safeParse({
      agent: { id: 'writer', name: 'Writer', description: 'desc' },
      prompt: { system: 'system prompt' },
      runtime: { type: 'llm-direct', model: 'qwen-plus', timeout_seconds: 30 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid agent id', () => {
    const result = AgentConfigSchema.safeParse({
      agent: { id: 'Writer', name: 'Writer', description: 'desc' },
      prompt: { system: 'system prompt' },
      runtime: { type: 'llm-direct', model: 'qwen-plus', timeout_seconds: 30 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid workflow config', () => {
    const result = WorkflowConfigSchema.safeParse({
      workflow: { id: 'novel_writing', name: 'Novel', description: 'desc' },
      steps: [
        { id: 'outline', agent: 'planner', task: 'task' },
        { id: 'chapter_1', agent: 'writer', task: 'task', depends_on: ['outline'] },
      ],
      output: { directory: './output/{{workflow.id}}/{{run.id}}' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects workflow with unknown dependency', () => {
    const result = WorkflowConfigSchema.safeParse({
      workflow: { id: 'novel_writing', name: 'Novel', description: 'desc' },
      steps: [{ id: 'chapter_1', agent: 'writer', task: 'task', depends_on: ['outline'] }],
      output: { directory: './output' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid project config', () => {
    const result = ProjectConfigSchema.safeParse({
      version: '1',
      runtime: { default_type: 'llm-direct', default_model: 'qwen-plus' },
      retry: { max_attempts: 2, delay_seconds: 5 },
      output: { base_directory: './output', preview_lines: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid project version', () => {
    const result = ProjectConfigSchema.safeParse({
      version: '2',
      runtime: { default_type: 'llm-direct', default_model: 'qwen-plus' },
      retry: { max_attempts: 2, delay_seconds: 5 },
      output: { base_directory: './output', preview_lines: 10 },
    });
    expect(result.success).toBe(false);
  });
});
