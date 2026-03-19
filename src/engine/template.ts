import fs from 'node:fs';
import path from 'node:path';

interface TemplateContext {
  input: string;
  inputs?: Record<string, unknown>;
  steps: Record<string, { outputFile?: string }>;
  workflowId: string;
  runId: string;
  runDir: string;
  processedContexts?: Record<string, string>;
  skills?: Record<string, { instructions: string; output_format?: string }>;
}

function resolveRunOutputPath(runDir: string, outputFile: string): string {
  const resolvedRunDir = path.resolve(runDir);
  const outputPath = path.resolve(resolvedRunDir, outputFile);
  const relative = path.relative(resolvedRunDir, outputPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Cannot resolve template variable: output file "${outputFile}" is outside run directory`);
  }

  return outputPath;
}

function resolveNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_match, rawExpr: string) => {
    const expr = rawExpr.trim();

    if (expr === 'input') {
      return context.input;
    }

    // Support {{inputs.xxx}} syntax for structured input
    if (expr.startsWith('inputs.') && context.inputs) {
      const keyPath = expr.slice('inputs.'.length);
      if (!keyPath) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: missing key path`);
      }
      const value = resolveNestedValue(context.inputs, keyPath);
      if (value === undefined) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: key "${keyPath}" not found in inputs`);
      }
      return String(value);
    }

    if (expr === 'workflow.id') {
      return context.workflowId;
    }

    if (expr === 'run.id') {
      return context.runId;
    }

    const stepMatch = expr.match(/^steps\.([a-z][a-z0-9_-]*)\.output$/);
    if (stepMatch) {
      const stepId = stepMatch[1];
      const outputFile = context.steps[stepId]?.outputFile;
      if (!outputFile) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: step "${stepId}" has no output yet`);
      }
      const outputPath = resolveRunOutputPath(context.runDir, outputFile);
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: file "${outputFile}" not found`);
      }
      return fs.readFileSync(outputPath, 'utf8');
    }

    const contextMatch = expr.match(/^context\.([a-z][a-z0-9_-]*)$/);
    if (contextMatch) {
      const stepId = contextMatch[1];
      const processedContent = context.processedContexts?.[stepId];
      if (processedContent === undefined) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: no processed context for step "${stepId}"`);
      }
      return processedContent;
    }

    const skillsInstructionsMatch = expr.match(/^skills\.([a-z][a-z0-9_-]*)\.instructions$/);
    if (skillsInstructionsMatch) {
      const skillId = skillsInstructionsMatch[1];
      if (!context.skills?.[skillId]) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: skill "${skillId}" not found`);
      }
      return context.skills[skillId].instructions;
    }

    const skillsOutputFormatMatch = expr.match(/^skills\.([a-z][a-z0-9_-]*)\.output_format$/);
    if (skillsOutputFormatMatch) {
      const skillId = skillsOutputFormatMatch[1];
      if (!context.skills?.[skillId]) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: skill "${skillId}" not found`);
      }
      return context.skills[skillId].output_format ?? '';
    }

    throw new Error(`Unknown template variable: {{${expr}}}`);
  });
}
