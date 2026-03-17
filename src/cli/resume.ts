import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import type { GateOptions } from '../types/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';

interface ResumeOptions {
  lang?: string;
  autoApprove?: boolean;
  gateTimeout?: string;
}

function parseGateOptions(options: ResumeOptions): GateOptions {
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

export function createResumeCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('resume')
    .description(t(locale, 'resumeDescription'))
    .argument('<run_id>', t(locale, 'runIdArg'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .option('--auto-approve', 'Auto-approve all gates without prompting')
    .option('--gate-timeout <seconds>', 'Auto-approve gate after N seconds of inactivity')
    .action(async (runId: string, options: ResumeOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      const gateOptions = parseGateOptions(options);
      try {
        const { stateManager, engine } = buildAppContext(resolvedLocale, gateOptions);
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
