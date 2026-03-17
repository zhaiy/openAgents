import fs from 'node:fs';

import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';
import { renderTemplate } from '../engine/template.js';

interface TemplateOptions {
  input?: string;
  inputJson?: string;
  inputFile?: string;
  lang?: string;
}

async function parseInput(options: TemplateOptions): Promise<{ input: string; inputData?: Record<string, unknown> }> {
  if (options.inputJson) {
    try {
      const data = JSON.parse(options.inputJson) as unknown;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('Input JSON must be an object');
      }
      return { input: options.inputJson, inputData: data as Record<string, unknown> };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid JSON';
      throw new Error(`Failed to parse --input-json: ${message}`, { cause: e });
    }
  }
  if (options.inputFile) {
    try {
      const content = fs.readFileSync(options.inputFile, 'utf8');
      const data = JSON.parse(content) as unknown;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('Input file JSON must be an object');
      }
      return { input: content, inputData: data as Record<string, unknown> };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      throw new Error(`Failed to read/parse --input-file: ${message}`, { cause: e });
    }
  }
  if (options.input) {
    return { input: options.input };
  }
  return { input: '' };
}

export function createDebugCommand(): Command {
  const locale = getDefaultLocale();

  const templateCommand = new Command('template')
    .description('Preview rendered templates for a workflow without executing')
    .argument('<workflow_id>', 'Workflow ID to debug')
    .option('-i, --input <text>', 'Plain text input')
    .option('--input-json <json>', 'Structured JSON input (e.g., \'{"key":"value"}\')')
    .option('--input-file <path>', 'Path to JSON file containing structured input')
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (workflowId: string, options: TemplateOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { loader } = buildAppContext(resolvedLocale);
        const workflow = loader.loadWorkflow(workflowId);
        const { input, inputData } = await parseInput(options);

        console.log(t(resolvedLocale, 'debugTemplateHeader', { workflowId }));
        console.log(t(resolvedLocale, 'debugTemplateInput', { input: input || '(empty)' }));
        if (inputData) {
          console.log(t(resolvedLocale, 'debugTemplateInputs', { inputs: JSON.stringify(inputData, null, 2) }));
        }
        console.log('');

        for (const step of workflow.steps) {
          const rendered = renderTemplate(step.task, {
            input,
            inputs: inputData,
            workflowId: workflow.workflow.id,
            runId: 'debug_preview',
            runDir: '/tmp/debug',
            steps: {},
          });
          console.log(`--- Step: ${step.id} ---`);
          console.log(rendered);
          console.log('');
        }
      } catch (error) {
        if (error instanceof OpenAgentsError) {
          console.error(t(resolvedLocale, 'errorPrefix', { message: error.message }));
          process.exitCode = error.exitCode;
          return;
        }
        if (error instanceof Error) {
          console.error(t(resolvedLocale, 'errorPrefix', { message: error.message }));
        } else {
          console.error(t(resolvedLocale, 'errorPrefix', { message: t(resolvedLocale, 'unknownError') }));
        }
        process.exitCode = 1;
      }
    });

  return new Command('debug')
    .description('Debug tools for OpenAgents')
    .addCommand(templateCommand);
}