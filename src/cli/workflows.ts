import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';

function pad(value: string, width: number): string {
  return value.padEnd(width, ' ');
}

export function createWorkflowsCommand(): Command {
  const locale = getDefaultLocale();
  const command = new Command('workflows').description(t(locale, 'workflowsDescription'));

  command
    .command('list')
    .description(t(locale, 'workflowsListDescription'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .action((options: { lang?: string }, parent: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(parent, options.lang);
      try {
        const { loader } = buildAppContext(resolvedLocale);
        const workflows = [...loader.loadWorkflows().values()].sort((a, b) =>
          a.workflow.id.localeCompare(b.workflow.id),
        );
        if (workflows.length === 0) {
          console.log(t(resolvedLocale, 'workflowsEmpty'));
          return;
        }

        console.log([pad('ID', 18), pad('NAME', 28), pad('STEPS', 8), 'DESCRIPTION'].join(' '));
        for (const workflow of workflows) {
          console.log(
            [
              pad(workflow.workflow.id, 18),
              pad(workflow.workflow.name, 28),
              pad(String(workflow.steps.length), 8),
              workflow.workflow.description,
            ].join(' '),
          );
        }
      } catch (error) {
        const message =
          error instanceof OpenAgentsError || error instanceof Error
            ? error.message
            : t(resolvedLocale, 'unknownError');
        console.error(t(resolvedLocale, 'errorPrefix', { message }));
      }
    });

  return command;
}
