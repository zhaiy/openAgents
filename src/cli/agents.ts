import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';

function pad(value: string, width: number): string {
  return value.padEnd(width, ' ');
}

export function createAgentsCommand(): Command {
  const locale = getDefaultLocale();
  const command = new Command('agents').description(t(locale, 'agentsDescription'));

  command
    .command('list')
    .description(t(locale, 'agentsListDescription'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .option('--skills', t(locale, 'agentsListSkillsOption'))
    .action((options: { lang?: string; skills?: boolean }, parent: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(parent, options.lang);
      try {
        const { loader } = buildAppContext(resolvedLocale);
        const agents = [...loader.loadAgents().values()].sort((a, b) => a.agent.id.localeCompare(b.agent.id));
        if (agents.length === 0) {
          console.log(t(resolvedLocale, 'agentsEmpty'));
          return;
        }

        if (options.skills) {
          // Show agents with their skills
          const skillsRegistry = loader.createSkillsRegistry();
          console.log(
            [pad('ID', 12), pad('NAME', 24), pad('SKILLS', 40)].join(' '),
          );
          for (const agent of agents) {
            const skillIds = agent.skills ?? [];
            const skillNames = skillIds.map((id) => {
              const skill = skillsRegistry.get(id);
              return skill ? `${id} (${skill.skill.name})` : id;
            });
            console.log(
              [
                pad(agent.agent.id, 12),
                pad(agent.agent.name, 24),
                pad(skillNames.length > 0 ? skillNames.join(', ') : '-', 40),
              ].join(' '),
            );
          }
        } else {
          console.log(
            [pad('ID', 12), pad('NAME', 24), pad('RUNTIME', 14), pad('MODEL', 20)].join(' '),
          );
          for (const agent of agents) {
            console.log(
              [
                pad(agent.agent.id, 12),
                pad(agent.agent.name, 24),
                pad(agent.runtime.type, 14),
                pad(agent.runtime.model ?? '-', 20),
              ].join(' '),
            );
          }
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
