import path from 'node:path';

import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { EvalRunner } from '../eval/runner.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { createRuntime } from '../runtime/factory.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';

interface EvalOptions {
  lang?: string;
}

export function createEvalCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('eval')
    .description('Evaluate a workflow run')
    .argument('<run_id>', 'Run ID to evaluate')
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (runId: string, options: EvalOptions, command: Command) => {
      const locale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { loader, stateManager } = buildAppContext(locale);
        const projectConfig = loader.loadProjectConfig();
        const state = stateManager.findRunById(runId);
        const workflow = loader.loadWorkflow(state.workflowId);
        const outputBaseDir = path.resolve(process.cwd(), projectConfig.output.base_directory);

        if (!workflow.eval?.enabled) {
          console.error(t(locale, 'evalWorkflowNotEnabled'));
          process.exitCode = 1;
          return;
        }

        const runner = new EvalRunner(createRuntime, outputBaseDir, projectConfig);

        // Read step outputs
        const stepOutputs: Record<string, string> = {};
        for (const [stepId, stepState] of Object.entries(state.steps)) {
          if (stepState.outputFile) {
            const outputPath = path.join(outputBaseDir, state.workflowId, runId, stepState.outputFile);
            try {
              const fs = await import('node:fs');
              stepOutputs[stepId] = fs.readFileSync(outputPath, 'utf8');
            } catch {
              // Ignore if file doesn't exist
            }
          }
        }

        const evalResult = await runner.evaluate({
          workflowId: state.workflowId,
          runId,
          input: state.input,
          stepOutputs,
          evalConfig: workflow.eval,
        });

        console.log(`\n📊 ${t(locale, 'evalResultTitle')}`);
        console.log(t(locale, 'evalScore', { score: evalResult.score }));
        console.log(t(locale, 'evalDimensions'));
        for (const [name, result] of Object.entries(evalResult.dimensions)) {
          console.log(t(locale, 'evalDimensionScore', { name, score: result.score, reason: result.reason }));
        }
        if (evalResult.comparedToLast) {
          const delta = evalResult.comparedToLast.scoreDelta;
          const direction = delta > 0 ? '+' : '';
          console.log(`\n${t(locale, 'evalComparedToLast', { lastRunId: evalResult.comparedToLast.lastRunId })}`);
          console.log(t(locale, 'evalScoreDelta', { delta: `${direction}${delta}`, direction: evalResult.comparedToLast.direction }));
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
