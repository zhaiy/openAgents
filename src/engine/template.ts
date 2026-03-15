import fs from 'node:fs';
import path from 'node:path';

interface TemplateContext {
  input: string;
  steps: Record<string, { outputFile?: string }>;
  workflowId: string;
  runId: string;
  runDir: string;
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

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_match, rawExpr: string) => {
    const expr = rawExpr.trim();

    if (expr === 'input') {
      return context.input;
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

    throw new Error(`Unknown template variable: {{${expr}}}`);
  });
}
