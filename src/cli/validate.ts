import fs from 'node:fs';
import path from 'node:path';

import { Command } from 'commander';
import yaml from 'js-yaml';

import { AgentConfigSchema, ProjectConfigSchema, WorkflowConfigSchema } from '../config/schema.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import type { AgentConfig, WorkflowConfig } from '../types/index.js';
import { resolveLocaleFromCommand } from './shared.js';

interface ValidationItem {
  file: string;
  valid: boolean;
  errors: string[];
}

function listYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort()
    .map((name) => path.join(dir, name));
}

function toRelative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath) || filePath;
}

function parseYaml(filePath: string): { value?: unknown; error?: string } {
  try {
    return { value: yaml.load(fs.readFileSync(filePath, 'utf8')) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'failed to parse yaml' };
  }
}

function zodErrors(error: { issues: Array<{ path: Array<PropertyKey>; message: string }> }): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.map((part) => String(part)).join('.') || 'root';
    return `${field}: ${issue.message}`;
  });
}

export function createValidateCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('validate')
    .description(t(locale, 'validateDescription'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .action((options: { lang?: string }, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      const projectRoot = process.cwd();
      const results: ValidationItem[] = [];

      const validAgents = new Map<string, AgentConfig>();
      const validWorkflows: WorkflowConfig[] = [];
      const workflowFileById = new Map<string, string>();

      const projectConfigPath = path.join(projectRoot, 'openagents.yaml');
      if (!fs.existsSync(projectConfigPath)) {
        results.push({
          file: 'openagents.yaml',
          valid: false,
          errors: [t(resolvedLocale, 'validateProjectMissing')],
        });
      } else {
        const parsedYaml = parseYaml(projectConfigPath);
        if (parsedYaml.error) {
          results.push({
            file: 'openagents.yaml',
            valid: false,
            errors: [parsedYaml.error],
          });
        } else {
          const parsed = ProjectConfigSchema.safeParse(parsedYaml.value);
          results.push({
            file: 'openagents.yaml',
            valid: parsed.success,
            errors: parsed.success ? [] : zodErrors(parsed.error),
          });
        }
      }

      for (const filePath of listYamlFiles(path.join(projectRoot, 'agents'))) {
        const rel = toRelative(projectRoot, filePath);
        const parsedYaml = parseYaml(filePath);
        if (parsedYaml.error) {
          results.push({ file: rel, valid: false, errors: [parsedYaml.error] });
          continue;
        }
        const parsed = AgentConfigSchema.safeParse(parsedYaml.value);
        if (!parsed.success) {
          results.push({ file: rel, valid: false, errors: zodErrors(parsed.error) });
          continue;
        }
        validAgents.set(parsed.data.agent.id, parsed.data);
        results.push({ file: rel, valid: true, errors: [] });
      }

      for (const filePath of listYamlFiles(path.join(projectRoot, 'workflows'))) {
        const rel = toRelative(projectRoot, filePath);
        const parsedYaml = parseYaml(filePath);
        if (parsedYaml.error) {
          results.push({ file: rel, valid: false, errors: [parsedYaml.error] });
          continue;
        }
        const parsed = WorkflowConfigSchema.safeParse(parsedYaml.value);
        if (!parsed.success) {
          results.push({ file: rel, valid: false, errors: zodErrors(parsed.error) });
          continue;
        }
        validWorkflows.push(parsed.data);
        workflowFileById.set(parsed.data.workflow.id, rel);
        results.push({ file: rel, valid: true, errors: [] });
      }

      for (const workflow of validWorkflows) {
        const rel = workflowFileById.get(workflow.workflow.id) ?? `workflows/${workflow.workflow.id}.yaml`;
        const referencesErrors: string[] = [];
        for (const step of workflow.steps) {
          if (!validAgents.has(step.agent)) {
            referencesErrors.push(
              t(resolvedLocale, 'validateUnknownAgent', {
                stepId: step.id,
                agentId: step.agent,
              }),
            );
          }
        }
        if (referencesErrors.length > 0) {
          const idx = results.findIndex((item) => item.file === rel);
          if (idx >= 0) {
            results[idx] = { file: results[idx].file, valid: false, errors: [...results[idx].errors, ...referencesErrors] };
          } else {
            results.push({ file: rel, valid: false, errors: referencesErrors });
          }
        }
      }

      console.log(t(resolvedLocale, 'validateStart'));
      console.log('');

      let passCount = 0;
      let failCount = 0;
      for (const item of results) {
        if (item.valid) {
          passCount += 1;
          console.log(`  ✅ ${item.file}`);
        } else {
          failCount += 1;
          console.log(`  ❌ ${item.file}`);
          for (const err of item.errors) {
            console.log(`     -> ${err}`);
          }
        }
      }

      console.log('');
      console.log(
        t(resolvedLocale, 'validateSummary', {
          pass: String(passCount),
          fail: String(failCount),
        }),
      );

      if (failCount > 0) {
        process.exitCode = 1;
      }
    });
}
