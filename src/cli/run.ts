import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';

interface RunOptions {
  input: string;
  lang?: string;
}

export function createRunCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('run')
    .description(t(locale, 'runDescription'))
    .argument('<workflow_id>', t(locale, 'workflowIdArg'))
    .requiredOption('-i, --input <text>', t(locale, 'runInputOption'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (workflowId: string, options: RunOptions, command: Command) => {
      const locale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { stateManager, engine } = buildAppContext(locale);
        const state = await engine.run(workflowId, options.input);
        const runDir = stateManager.getRunDir(state.workflowId, state.runId);
        console.log(t(locale, 'workflowCompleted', { workflowId: state.workflowId }));
        console.log(t(locale, 'runId', { runId: state.runId }));
        console.log(t(locale, 'outputDirectory', { runDir }));
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
