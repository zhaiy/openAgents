import type { AgentConfig, ProjectConfig, WorkflowConfig } from '../types/index.js';

export interface ValidationResult {
  level: 'error' | 'warning' | 'info';
  file: string;
  message: string;
}

export class ConfigValidator {
  validate(
    projectConfig: ProjectConfig,
    agents: Map<string, AgentConfig>,
    workflows: Map<string, WorkflowConfig>,
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    results.push(...this.checkPromptCompleteness(agents));
    results.push(...this.checkTimeoutAdequacy(agents));
    results.push(...this.checkModelSuitability(agents));
    results.push(...this.checkUnusedAgents(agents, workflows));
    results.push(...this.checkUnusedSteps(workflows));

    return results;
  }

  /**
   * Check if all agents have a system prompt
   */
  private checkPromptCompleteness(agents: Map<string, AgentConfig>): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const [agentId, agent] of agents) {
      if (!agent.prompt?.system || agent.prompt.system.trim() === '') {
        results.push({
          level: 'error',
          file: `agents/${agentId}.yaml`,
          message: `Agent "${agentId}" has empty or missing system prompt`,
        });
      }
    }

    return results;
  }

  /**
   * Check if timeout is adequate for the task type
   */
  private checkTimeoutAdequacy(agents: Map<string, AgentConfig>): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Keywords that suggest long-running tasks
    const longTaskKeywords = [
      'write', 'generate', 'draft', 'create', 'compose',
      'article', 'story', 'novel', 'report', 'document',
      '长文本', '生成', '写作', '创作',
    ];

    for (const [agentId, agent] of agents) {
      const timeout = agent.runtime?.timeout_seconds ?? 300;
      const systemPrompt = agent.prompt?.system?.toLowerCase() ?? '';
      const agentName = agent.agent?.name?.toLowerCase() ?? '';

      // Check if this looks like a long-running task
      const isLongTask = longTaskKeywords.some(
        keyword => systemPrompt.includes(keyword.toLowerCase()) || agentName.includes(keyword.toLowerCase()),
      );

      if (isLongTask && timeout < 120) {
        results.push({
          level: 'warning',
          file: `agents/${agentId}.yaml`,
          message: `Agent "${agentId}" has timeout_seconds=${timeout}s which may be too short for long-form content generation. Consider increasing to at least 120s.`,
        });
      }
    }

    return results;
  }

  /**
   * Check model configuration
   */
  private checkModelSuitability(agents: Map<string, AgentConfig>): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const [agentId, agent] of agents) {
      // Skip script runtime agents (they don't need a model)
      if (agent.runtime?.type === 'script') {
        continue;
      }

      const model = agent.runtime?.model;

      if (!model || model.trim() === '') {
        results.push({
          level: 'warning',
          file: `agents/${agentId}.yaml`,
          message: `Agent "${agentId}" has no model specified. Using default model.`,
        });
      } else {
        // Check for deprecated or problematic model names
        const deprecatedModels = ['gpt-3', 'gpt-35-turbo', 'text-davinci'];
        if (deprecatedModels.some(m => model.toLowerCase().includes(m))) {
          results.push({
            level: 'info',
            file: `agents/${agentId}.yaml`,
            message: `Agent "${agentId}" uses model "${model}" which may be deprecated. Consider upgrading to a newer model.`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check for agents that are defined but never used
   */
  private checkUnusedAgents(
    agents: Map<string, AgentConfig>,
    workflows: Map<string, WorkflowConfig>,
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Collect all agent references from workflows
    const usedAgents = new Set<string>();
    for (const workflow of workflows.values()) {
      for (const step of workflow.steps) {
        usedAgents.add(step.agent);
      }
    }

    // Find unused agents
    for (const agentId of agents.keys()) {
      if (!usedAgents.has(agentId)) {
        results.push({
          level: 'warning',
          file: `agents/${agentId}.yaml`,
          message: `Agent "${agentId}" is defined but not used by any workflow`,
        });
      }
    }

    return results;
  }

  /**
   * Check for steps with no dependencies that could run in parallel
   */
  private checkUnusedSteps(workflows: Map<string, WorkflowConfig>): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const [workflowId, workflow] of workflows) {
      // Check for duplicate step IDs (should be caught by schema, but double-check)
      const stepIds = workflow.steps.map(s => s.id);
      const uniqueStepIds = new Set(stepIds);
      if (stepIds.length !== uniqueStepIds.size) {
        results.push({
          level: 'error',
          file: `workflows/${workflowId}.yaml`,
          message: `Workflow "${workflowId}" has duplicate step IDs`,
        });
      }

      // Check for potential naming issues
      for (const step of workflow.steps) {
        if (step.id.includes(' ')) {
          results.push({
            level: 'warning',
            file: `workflows/${workflowId}.yaml`,
            message: `Step "${step.id}" contains spaces. Consider using underscores or hyphens.`,
          });
        }
      }
    }

    return results;
  }
}