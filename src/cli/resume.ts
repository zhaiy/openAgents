import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';

interface ResumeOptions {
  lang?: string;
}

export function createResumeCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('resume')
    .description(t(locale, 'resumeDescription'))
    .argument('<run_id>', t(locale, 'runIdArg'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (runId: string, options: ResumeOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { stateManager, engine } = buildAppContext(resolvedLocale);
        const state = await engine.resume(runId);
        const runDir = stateManager.getRunDir(state.workflowId, state.runId);
        console.log(t(resolvedLocale, 'resumeCompleted', { workflowId: state.workflowId, runId: state.runId }));
        console.log(t(resolvedLocale, 'outputDirectory', { runDir }));
      } catch (error) {
        if (error instanceof OpenAgentsError) {
          console.error(t(resolvedLocale, 'errorPrefix', { message: error.message }));
          process.exitCode = error.exitCode;
          return;
        }
        const message = error instanceof Error ? error.message : t(resolvedLocale, 'unknownError');
        console.error(t(resolvedLocale, 'errorPrefix', { message }));
        process.exitCode = 1;
      }
    });
}
