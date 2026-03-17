import { describe, it, expect } from 'vitest';

import { ConfigValidator } from '../config/validator.js';
import type { AgentConfig, ProjectConfig, WorkflowConfig } from '../types/index.js';

describe('ConfigValidator', () => {
  const validator = new ConfigValidator();

  const createMockProjectConfig = (): ProjectConfig => ({
    project: {
      name: 'test-project',
      version: '1.0.0',
    },
    defaults: {
      output_dir: './output',
    },
  });

  const createMockAgent = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
    agent: {
      id: 'test_agent',
      name: 'Test Agent',
      description: 'A test agent',
    },
    prompt: {
      system: 'You are a helpful assistant.',
    },
    runtime: {
      type: 'llm-direct',
      model: 'gpt-4',
      timeout_seconds: 300,
    },
    ...overrides,
  });

  const createMockWorkflow = (overrides: Partial<WorkflowConfig> = {}): WorkflowConfig => ({
    workflow: {
      id: 'test_workflow',
      name: 'Test Workflow',
      description: 'A test workflow',
    },
    steps: [
      { id: 'step1', agent: 'test_agent', task: 'Do something' },
    ],
    output: {
      directory: './output',
    },
    ...overrides,
  });

  describe('checkPromptCompleteness', () => {
    it('should error when agent has empty system prompt', () => {
      const agents = new Map([['test_agent', createMockAgent({ prompt: { system: '' } })]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const error = results.find(r => r.message.includes('empty or missing system prompt'));

      expect(error).toBeDefined();
      expect(error?.level).toBe('error');
    });

    it('should pass when agent has valid system prompt', () => {
      const agents = new Map([['test_agent', createMockAgent()]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const error = results.find(r => r.message.includes('system prompt'));

      expect(error).toBeUndefined();
    });
  });

  describe('checkTimeoutAdequacy', () => {
    it('should warn when timeout is too short for long-form content', () => {
      const agents = new Map([[
        'writer',
        createMockAgent({
          agent: { id: 'writer', name: 'Content Writer', description: 'Writes content' },
          prompt: { system: 'You are a novel writing assistant.' },
          runtime: { type: 'llm-direct', model: 'gpt-4', timeout_seconds: 60 },
        }),
      ]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const warning = results.find(r => r.message.includes('timeout_seconds') && r.message.includes('too short'));

      expect(warning).toBeDefined();
      expect(warning?.level).toBe('warning');
    });

    it('should pass when timeout is adequate', () => {
      const agents = new Map([[
        'writer',
        createMockAgent({
          agent: { id: 'writer', name: 'Content Writer', description: 'Writes content' },
          prompt: { system: 'You are a novel writing assistant.' },
          runtime: { type: 'llm-direct', model: 'gpt-4', timeout_seconds: 300 },
        }),
      ]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const warning = results.find(r => r.message.includes('timeout_seconds') && r.message.includes('too short'));

      expect(warning).toBeUndefined();
    });
  });

  describe('checkModelSuitability', () => {
    it('should warn when agent has no model specified', () => {
      const agents = new Map([[
        'test_agent',
        createMockAgent({ runtime: { type: 'llm-direct', model: '', timeout_seconds: 300 } }),
      ]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const warning = results.find(r => r.message.includes('no model specified'));

      expect(warning).toBeDefined();
      expect(warning?.level).toBe('warning');
    });

    it('should show info for deprecated models in verbose mode', () => {
      const agents = new Map([[
        'test_agent',
        createMockAgent({ runtime: { type: 'llm-direct', model: 'gpt-3.5-turbo', timeout_seconds: 300 } }),
      ]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const info = results.find(r => r.message.includes('deprecated') || r.message.includes('gpt-3'));

      expect(info).toBeDefined();
      expect(info?.level).toBe('info');
    });

    it('should skip model check for script runtime', () => {
      const agents = new Map([[
        'script_agent',
        createMockAgent({
          runtime: { type: 'script', timeout_seconds: 300 },
          script: { inline: 'return "test"' },
        }),
      ]]);
      const workflows = new Map([['test_workflow', createMockWorkflow({ steps: [{ id: 'step1', agent: 'script_agent', task: 'test' }] })]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const warning = results.find(r => r.message.includes('no model specified'));

      expect(warning).toBeUndefined();
    });
  });

  describe('checkUnusedAgents', () => {
    it('should warn when agent is not used by any workflow', () => {
      const agents = new Map([
        ['used_agent', createMockAgent({ agent: { id: 'used_agent', name: 'Used', description: '' } })],
        ['unused_agent', createMockAgent({ agent: { id: 'unused_agent', name: 'Unused', description: '' } })],
      ]);
      const workflows = new Map([[
        'test_workflow',
        createMockWorkflow({ steps: [{ id: 'step1', agent: 'used_agent', task: 'test' }] }),
      ]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const warning = results.find(r => r.message.includes('unused_agent') && r.message.includes('not used'));

      expect(warning).toBeDefined();
      expect(warning?.level).toBe('warning');
    });

    it('should pass when all agents are used', () => {
      const agents = new Map([['test_agent', createMockAgent()]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const warning = results.find(r => r.message.includes('not used'));

      expect(warning).toBeUndefined();
    });
  });

  describe('checkUnusedSteps', () => {
    it('should warn when step ID contains spaces', () => {
      const agents = new Map([['test_agent', createMockAgent()]]);
      const workflows = new Map([[
        'test_workflow',
        createMockWorkflow({ steps: [{ id: 'step one', agent: 'test_agent', task: 'test' }] }),
      ]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);
      const warning = results.find(r => r.message.includes('contains spaces'));

      expect(warning).toBeDefined();
      expect(warning?.level).toBe('warning');
    });
  });

  describe('overall behavior', () => {
    it('should return empty array for valid configuration', () => {
      const agents = new Map([['test_agent', createMockAgent()]]);
      const workflows = new Map([['test_workflow', createMockWorkflow()]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);

      expect(results).toEqual([]);
    });

    it('should return multiple issues when applicable', () => {
      const agents = new Map([
        ['unused_agent', createMockAgent({ agent: { id: 'unused_agent', name: 'Unused', description: '' } })],
        ['bad_agent', createMockAgent({
          agent: { id: 'bad_agent', name: 'Bad', description: '' },
          prompt: { system: '' },
          runtime: { type: 'llm-direct', model: '', timeout_seconds: 60 },
        })],
      ]);
      const workflows = new Map([[
        'test_workflow',
        createMockWorkflow({ steps: [{ id: 'step one', agent: 'bad_agent', task: 'test' }] }),
      ]]);

      const results = validator.validate(createMockProjectConfig(), agents, workflows);

      expect(results.length).toBeGreaterThan(0);
      // Should have at least: empty prompt, timeout warning, no model, unused agent, spaces in step id
    });
  });
});