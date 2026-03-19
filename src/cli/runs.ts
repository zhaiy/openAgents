import path from 'node:path';

import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { EvalRunner } from '../eval/runner.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import { EventLogger } from '../output/logger.js';
import { createRuntime } from '../runtime/factory.js';
import type { RunState, RunStatus } from '../types/index.js';
import { buildAppContext, formatDateTime, formatDurationMs, resolveLocaleFromCommand } from './shared.js';

interface RunsListOptions {
  status?: RunStatus;
  workflow?: string;
  lang?: string;
  eval?: boolean;
}

function formatProgress(state: RunState): string {
  const total = Object.keys(state.steps).length;
  const done = Object.values(state.steps).filter((step) => step.status === 'completed').length;
  return `${done}/${total}`;
}

function pad(value: string, width: number): string {
  return value.padEnd(width, ' ');
}

function printRunsTable(states: RunState[], evals?: Map<string, { score: number; delta: number }>): void {
  const headers = ['RUN ID', 'WORKFLOW', 'STATUS', 'PROGRESS', 'CREATED'];
  const widths = [24, 16, 12, 10, 19];
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' '));
  for (const state of states) {
    const evalInfo = evals?.get(state.runId);
    void evalInfo;
    console.log(
      [
        pad(state.runId, widths[0]),
        pad(state.workflowId, widths[1]),
        pad(state.status, widths[2]),
        pad(formatProgress(state), widths[3]),
        pad(formatDateTime(state.startedAt).slice(0, 16), widths[4]),
      ].join(' '),
    );
  }
}

function printRunsTableWithEval(states: RunState[], evals: Map<string, { score: number; delta: number }>): void {
  const headers = ['RUN ID', 'WORKFLOW', 'SCORE', 'DELTA', 'STATUS', 'CREATED'];
  const widths = [24, 16, 8, 8, 12, 19];
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' '));
  for (const state of states) {
    const evalInfo = evals.get(state.runId);
    const scoreStr = evalInfo ? `${evalInfo.score}` : '-';
    const deltaStr = evalInfo
      ? evalInfo.delta > 0
        ? `+${evalInfo.delta}`
        : evalInfo.delta < 0
          ? `${evalInfo.delta}`
          : '0'
      : '-';
    console.log(
      [
        pad(state.runId, widths[0]),
        pad(state.workflowId, widths[1]),
        pad(scoreStr, widths[2]),
        pad(deltaStr, widths[3]),
        pad(state.status, widths[4]),
        pad(formatDateTime(state.startedAt).slice(0, 16), widths[5]),
      ].join(' '),
    );
  }
}

export function createRunsCommand(): Command {
  const locale = getDefaultLocale();
  const runsCommand = new Command('runs').description(t(locale, 'runsDescription'));

  runsCommand
    .command('list')
    .description(t(locale, 'runsListDescription'))
    .option('--status <status>', t(locale, 'runsStatusOption'))
    .option('--workflow <workflowId>', t(locale, 'runsWorkflowOption'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .option('--eval', 'Show evaluation scores')
    .action((options: RunsListOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { loader, stateManager } = buildAppContext(resolvedLocale);
        const projectConfig = loader.loadProjectConfig();
        const outputBaseDir = path.resolve(process.cwd(), projectConfig.output.base_directory);
        const states = stateManager.listRuns({
          status: options.status,
          workflowId: options.workflow,
        });
        if (states.length === 0) {
          console.log(t(resolvedLocale, 'runsEmpty'));
          return;
        }

        if (options.eval) {
          const runner = new EvalRunner(createRuntime, outputBaseDir, projectConfig);
          const evals = new Map<string, { score: number; delta: number }>();

          for (const state of states) {
            const lastEval = runner.loadLastEval(state.workflowId, state.runId);
            if (lastEval) {
              evals.set(state.runId, { score: lastEval.score, delta: lastEval.comparedToLast?.scoreDelta ?? 0 });
            }
          }

          printRunsTableWithEval(states, evals);
        } else {
          printRunsTable(states);
        }
      } catch (error) {
        const message =
          error instanceof OpenAgentsError || error instanceof Error
            ? error.message
            : t(resolvedLocale, 'unknownError');
        console.error(t(resolvedLocale, 'errorPrefix', { message }));
      }
    });

  runsCommand
    .command('show')
    .description(t(locale, 'runsShowDescription'))
    .argument('<run_id>', t(locale, 'runIdArg'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .action((runId: string, options: { lang?: string }, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { loader, stateManager } = buildAppContext(resolvedLocale);
        const run = stateManager.findRunById(runId);
        const workflow = loader.loadWorkflow(run.workflowId);
        console.log(`${t(resolvedLocale, 'runId', { runId: run.runId })}`);
        console.log(`${t(resolvedLocale, 'workflowLabel', { workflowId: run.workflowId })} (${workflow.workflow.name})`);
        console.log(`${t(resolvedLocale, 'statusLabel', { status: run.status })}`);
        console.log(`${t(resolvedLocale, 'inputLabel', { input: run.input })}`);
        console.log(`${t(resolvedLocale, 'startedAtLabel', { startedAt: formatDateTime(run.startedAt) })}`);
        console.log(
          `${t(resolvedLocale, 'durationLabel', {
            duration: formatDurationMs((run.completedAt ?? Date.now()) - run.startedAt),
          })}`,
        );
        console.log(`\n${t(resolvedLocale, 'stepsLabel')}`);
        for (const [stepId, stepState] of Object.entries(run.steps)) {
          const icon = stepState.status === 'completed' ? '✅' : stepState.status === 'interrupted' ? '⏸' : '⬜';
          const duration =
            stepState.startedAt && stepState.completedAt
              ? formatDurationMs(stepState.completedAt - stepState.startedAt)
              : '-';
          console.log(`  ${icon} ${stepId}  ${stepState.status}  ${duration}  ${stepState.outputFile ?? ''}`);
        }
      } catch (error) {
        const message =
          error instanceof OpenAgentsError || error instanceof Error
            ? error.message
            : t(resolvedLocale, 'unknownError');
        console.error(t(resolvedLocale, 'errorPrefix', { message }));
      }
    });

  runsCommand
    .command('logs')
    .description(t(locale, 'runsLogsDescription'))
    .argument('<run_id>', t(locale, 'runIdArg'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .action((runId: string, options: { lang?: string }, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { stateManager } = buildAppContext(resolvedLocale);
        const run = stateManager.findRunById(runId);
        const runDir = stateManager.getRunDir(run.workflowId, run.runId);
        const logger = new EventLogger(path.join(runDir, 'events.jsonl'));
        const events = logger.readAll();
        if (events.length === 0) {
          console.log(t(resolvedLocale, 'logsEmpty'));
          return;
        }
        for (const event of events) {
          const time = new Date(event.ts).toISOString().slice(11, 23);
          const details = Object.entries(event.data)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(' ');
          console.log(`${time}  ${event.event.padEnd(20, ' ')} ${details}`);
        }
      } catch (error) {
        const message =
          error instanceof OpenAgentsError || error instanceof Error
            ? error.message
            : t(resolvedLocale, 'unknownError');
        console.error(t(resolvedLocale, 'errorPrefix', { message }));
      }
    });

  return runsCommand;
}
