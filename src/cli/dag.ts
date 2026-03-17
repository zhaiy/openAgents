import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { buildAppContext, resolveLocaleFromCommand } from './shared.js';
import { DAGParser } from '../engine/dag.js';
import { renderDAGAscii } from '../ui/dag-visualizer.js';

interface DagOptions {
  lang?: string;
}

export function createDagCommand(): Command {
  const locale = getDefaultLocale();

  return new Command('dag')
    .description('Visualize workflow DAG structure')
    .argument('<workflow_id>', 'Workflow ID to visualize')
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (workflowId: string, options: DagOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { loader } = buildAppContext(resolvedLocale);
        const workflow = loader.loadWorkflow(workflowId);

        const dagParser = new DAGParser();
        const plan = dagParser.parse(workflow.steps);

        console.log(t(resolvedLocale, 'dagHeader', { workflowId }));
        console.log('');

        const visualization = renderDAGAscii(plan, workflow.steps);
        console.log(visualization);

        // Print summary
        const { parallelGroups } = plan;
        const totalSteps = workflow.steps.length;
        const maxParallel = Math.max(...parallelGroups.map(g => g.length));
        console.log('');
        console.log(t(resolvedLocale, 'dagSummary', {
          totalSteps: String(totalSteps),
          layers: String(parallelGroups.length),
          maxParallel: String(maxParallel),
        }));
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
}