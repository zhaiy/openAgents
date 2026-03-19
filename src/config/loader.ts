import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';
import { ZodError } from 'zod';

import { ConfigError } from '../errors.js';
import type { AgentConfig, ProjectConfig, SkillConfig, WorkflowConfig } from '../types/index.js';
import { AgentConfigSchema, ProjectConfigSchema, WorkflowConfigSchema } from './schema.js';
import { SkillsRegistry } from '../skills/registry.js';

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.join('.') || 'root';
      return `${field}: ${issue.message}`;
    })
    .join('; ');
}

function parseYamlFile(filePath: string): unknown {
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown YAML parse error';
    throw new ConfigError(`Failed to parse YAML at ${filePath}: ${message}`, filePath);
  }
}

export class ConfigLoader {
  constructor(private readonly projectRoot: string) {}

  getProjectRoot(): string {
    return this.projectRoot;
  }

  loadProjectConfig(): ProjectConfig {
    const filePath = path.join(this.projectRoot, 'openagents.yaml');
    if (!fs.existsSync(filePath)) {
      throw new ConfigError(`Project config not found: ${filePath}`, filePath);
    }
    const raw = parseYamlFile(filePath);
    const parsed = ProjectConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ConfigError(`Invalid project config ${filePath}: ${formatZodError(parsed.error)}`, filePath);
    }
    return parsed.data;
  }

  loadAgents(): Map<string, AgentConfig> {
    const agentsDir = path.join(this.projectRoot, 'agents');
    if (!fs.existsSync(agentsDir)) {
      throw new ConfigError(`Agents directory not found: ${agentsDir}`, agentsDir);
    }

    const files = fs
      .readdirSync(agentsDir)
      .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
      .sort();

    const agents = new Map<string, AgentConfig>();
    for (const fileName of files) {
      const filePath = path.join(agentsDir, fileName);
      const raw = parseYamlFile(filePath);
      const parsed = AgentConfigSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ConfigError(`Invalid agent config ${filePath}: ${formatZodError(parsed.error)}`, filePath);
      }
      if (agents.has(parsed.data.agent.id)) {
        throw new ConfigError(`Duplicate agent id "${parsed.data.agent.id}" in ${filePath}`, filePath);
      }
      agents.set(parsed.data.agent.id, parsed.data);
    }
    return agents;
  }

  loadWorkflows(): Map<string, WorkflowConfig> {
    const workflowsDir = path.join(this.projectRoot, 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      throw new ConfigError(`Workflows directory not found: ${workflowsDir}`, workflowsDir);
    }

    const files = fs
      .readdirSync(workflowsDir)
      .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
      .sort();

    const workflows = new Map<string, WorkflowConfig>();
    for (const fileName of files) {
      const filePath = path.join(workflowsDir, fileName);
      const raw = parseYamlFile(filePath);
      const parsed = WorkflowConfigSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ConfigError(`Invalid workflow config ${filePath}: ${formatZodError(parsed.error)}`, filePath);
      }
      if (workflows.has(parsed.data.workflow.id)) {
        throw new ConfigError(`Duplicate workflow id "${parsed.data.workflow.id}" in ${filePath}`, filePath);
      }
      workflows.set(parsed.data.workflow.id, parsed.data);
    }
    return workflows;
  }

  loadWorkflow(workflowId: string): WorkflowConfig {
    const workflows = this.loadWorkflows();
    const workflow = workflows.get(workflowId);
    if (!workflow) {
      throw new ConfigError(`Workflow "${workflowId}" not found in workflows directory`);
    }
    return workflow;
  }

  loadSkills(): Map<string, SkillConfig> {
    const skillsDir = path.join(this.projectRoot, 'skills');
    const registry = new SkillsRegistry(skillsDir);
    registry.loadAll();
    const skills = new Map<string, SkillConfig>();
    for (const skill of registry.getAll()) {
      skills.set(skill.skill.id, skill);
    }
    return skills;
  }

  createSkillsRegistry(): SkillsRegistry {
    const skillsDir = path.join(this.projectRoot, 'skills');
    const registry = new SkillsRegistry(skillsDir);
    registry.loadAll();
    return registry;
  }

  validateReferences(agents: Map<string, AgentConfig>, workflow: WorkflowConfig): void {
    const stepIds = new Set(workflow.steps.map((step) => step.id));
    for (const step of workflow.steps) {
      if (!agents.has(step.agent)) {
        const available = [...agents.keys()].sort().join(', ');
        throw new ConfigError(
          `Step "${step.id}" references unknown agent "${step.agent}". Available agents: ${available}`,
        );
      }
      for (const dep of step.depends_on ?? []) {
        if (!stepIds.has(dep)) {
          throw new ConfigError(`Step "${step.id}" references unknown dependency "${dep}"`);
        }
      }
    }
  }
}
