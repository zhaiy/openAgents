import fs from 'node:fs';
import path from 'node:path';

import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { EvalRunner } from '../eval/runner.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { createRuntime } from '../runtime/factory.js';
import type { GateOptions } from '../types/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';

interface RunOptions {
  input?: string;
  inputJson?: string;
  inputFile?: string;
  lang?: string;
  autoApprove?: boolean;
  gateTimeout?: string;
  stream?: boolean;
  noEval?: boolean;
}

interface ParsedInput {
  input: string;
  inputData?: Record<string, unknown>;
}

function parseInput(options: RunOptions): ParsedInput {
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
  throw new Error('Must provide one of: --input, --input-json, or --input-file');
}

function parseGateOptions(options: RunOptions): GateOptions {
  const gateOptions: GateOptions = {};
  if (options.autoApprove) {
    gateOptions.autoApprove = true;
  }
  if (options.gateTimeout) {
    const timeout = parseInt(options.gateTimeout, 10);
    if (!isNaN(timeout) && timeout > 0) {
      gateOptions.gateTimeoutSeconds = timeout;
    }
  }
  return gateOptions;
}

export function createRunCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('run')
    .description(t(locale, 'runDescription'))
    .argument('<workflow_id>', t(locale, 'workflowIdArg'))
    .option('-i, --input <text>', t(locale, 'runInputOption'))
    .option('--input-json <json>', 'Structured JSON input (e.g., \'{"key":"value"}\')')
    .option('--input-file <path>', 'Path to JSON file containing structured input')
    .option('--lang <locale>', t(locale, 'langOption'))
    .option('--auto-approve', 'Auto-approve all gates without prompting')
    .option('--gate-timeout <seconds>', 'Auto-approve gate after N seconds of inactivity')
    .option('--stream', 'Enable streaming output for LLM responses')
    .option('--no-eval', 'Skip evaluation even if workflow has eval enabled')
    .action(async (workflowId: string, options: RunOptions, command: Command) => {
      const locale = resolveLocaleFromCommand(command, options.lang);
      const gateOptions = parseGateOptions(options);
      try {
        const { input, inputData } = parseInput(options);
        const { stateManager, engine, loader } = buildAppContext(locale, gateOptions);
        const state = await engine.run(workflowId, input, {
          inputData,
          stream: options.stream ?? false,
          noEval: options.noEval ?? false,
        });
        const runDir = stateManager.getRunDir(state.workflowId, state.runId);
        console.log(t(locale, 'workflowCompleted', { workflowId: state.workflowId }));
        console.log(t(locale, 'runId', { runId: state.runId }));
        console.log(t(locale, 'outputDirectory', { runDir }));

        // Auto-run evaluation if enabled and not skipped
        if (!options.noEval) {
          const workflow = loader.loadWorkflow(workflowId);
          if (workflow.eval?.enabled) {
            const projectConfig = loader.loadProjectConfig();
            const outputBaseDir = path.resolve(process.cwd(), projectConfig.output.base_directory);
            const runner = new EvalRunner(createRuntime, outputBaseDir, projectConfig);

            // Read step outputs
            const stepOutputs: Record<string, string> = {};
            for (const [stepId, stepState] of Object.entries(state.steps)) {
              if (stepState.outputFile) {
                const outputPath = path.join(outputBaseDir, state.workflowId, state.runId, stepState.outputFile);
                try {
                  stepOutputs[stepId] = fs.readFileSync(outputPath, 'utf8');
                } catch {
                  // Ignore if file doesn't exist
                }
              }
            }

            const evalResult = await runner.evaluate({
              workflowId: state.workflowId,
              runId: state.runId,
              input: state.input,
              stepOutputs,
              evalConfig: workflow.eval,
            });

            console.log(`\n📊 Evaluation Result`);
            console.log(`Score: ${evalResult.score}/100`);
            for (const [name, result] of Object.entries(evalResult.dimensions)) {
              console.log(`  - ${name}: ${result.score}/100 (${result.reason})`);
            }
            if (evalResult.comparedToLast) {
              const delta = evalResult.comparedToLast.scoreDelta;
              const direction = delta > 0 ? '+' : '';
              console.log(`\nCompared to last: ${direction}${delta} (${evalResult.comparedToLast.direction})`);
            }
          }
        }
      } catch (error) {
        if (error instanceof OpenAgentsError) {
          console.error(t(locale, 'errorPrefix', { message: error.message }));
          process.exitCode = error.exitCode;
          return;
        }
        if (error instanceof Error) {
          console.error(t(locale, 'errorPrefix', { message: error.message }));
        } else {
          console.error(t(locale, 'errorPrefix', { message: t(locale, 'unknownError') }));
        }
        process.exitCode = 1;
      }
    });
}
