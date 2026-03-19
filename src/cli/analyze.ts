import fs from 'node:fs';
import path from 'node:path';

import { Command } from 'commander';

import { OpenAgentsError } from '../errors.js';
import { getDefaultLocale, t } from '../i18n/index.js';
import type { RunMetadata } from '../types/index.js';
import { buildAppContext, formatDurationMs, resolveLocaleFromCommand } from './shared.js';

interface AnalyzeOptions {
  lang?: string;
  limit?: number;
}

export function createAnalyzeCommand(): Command {
  const locale = getDefaultLocale();
  const analyzeCommand = new Command('analyze')
    .description(t(locale, 'analyzeDescription'))
    .argument('<workflow_id>', t(locale, 'workflowIdArg'))
    .option('--lang <locale>', t(locale, 'langOption'))
    .option('--limit <number>', 'Number of recent runs to analyze', (value) => parseInt(value, 10), 10)
    .action((workflowId: string, options: AnalyzeOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const { loader } = buildAppContext(resolvedLocale);
        const projectConfig = loader.loadProjectConfig();
        const outputBaseDir = path.resolve(process.cwd(), projectConfig.output.base_directory);
        const metadataPath = path.join(outputBaseDir, '.runs', 'metadata.jsonl');

        if (!fs.existsSync(metadataPath)) {
          console.log(t(resolvedLocale, 'analyzeNoData'));
          return;
        }

        // Read and parse metadata
        const metadataLines = fs.readFileSync(metadataPath, 'utf8').split('\n').filter(Boolean);
        const allMetadata: RunMetadata[] = [];

        for (const line of metadataLines) {
          try {
            const metadata = JSON.parse(line) as RunMetadata;
            if (metadata.workflowId === workflowId) {
              allMetadata.push(metadata);
            }
          } catch {
            // Skip invalid lines
          }
        }

        if (allMetadata.length === 0) {
          console.log(t(resolvedLocale, 'analyzeNoRunsForWorkflow', { workflowId }));
          return;
        }

        // Sort by createdAt descending and limit
        allMetadata.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const recentRuns = allMetadata.slice(0, options.limit ?? 10);

        // Calculate statistics
        const scores = recentRuns.filter((r) => r.score !== undefined).map((r) => r.score as number);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        const avgDuration = recentRuns.reduce((a, b) => a + b.duration, 0) / recentRuns.length;
        const avgTokenCost = recentRuns.reduce((a, b) => a + b.tokenCost, 0) / recentRuns.length;

        // Calculate trend (compare recent half to older half)
        let trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' = 'insufficient_data';
        if (scores.length >= 4) {
          const mid = Math.floor(scores.length / 2);
          const recentHalf = scores.slice(0, mid);
          const olderHalf = scores.slice(mid);
          const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
          const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
          const diff = recentAvg - olderAvg;
          if (diff > 2) {
            trend = 'improving';
          } else if (diff < -2) {
            trend = 'declining';
          } else {
            trend = 'stable';
          }
        }

        // Get workflow info
        const workflow = loader.loadWorkflow(workflowId);

        // Print analysis
        console.log(`\n${t(resolvedLocale, 'analyzeTitle', { workflowName: workflow.workflow.name })}`);
        console.log(t(resolvedLocale, 'analyzeHistory', { count: String(recentRuns.length) }));
        if (avgScore !== null) {
          console.log(t(resolvedLocale, 'analyzeAvgScore', { score: avgScore.toFixed(1) }));
        }
        console.log(t(resolvedLocale, 'analyzeAvgDuration', { duration: formatDurationMs(avgDuration) }));
        console.log(t(resolvedLocale, 'analyzeAvgToken', { tokens: Math.round(avgTokenCost).toLocaleString() }));

        if (trend === 'insufficient_data') {
          console.log(t(resolvedLocale, 'analyzeTrendInsufficient'));
        } else if (trend === 'improving') {
          console.log(t(resolvedLocale, 'analyzeTrendImproving'));
        } else if (trend === 'declining') {
          console.log(t(resolvedLocale, 'analyzeTrendDeclining'));
        } else {
          console.log(t(resolvedLocale, 'analyzeTrendStable'));
        }

        // Suggestions
        console.log(`\n${t(resolvedLocale, 'analyzeSuggestions')}:`);
        if (avgScore !== null && avgScore >= 80) {
          console.log(`  ✅ ${t(resolvedLocale, 'analyzeSuggestionGoodScore')}`);
        }
        if (avgDuration > 120000) {
          console.log(`  💡 ${t(resolvedLocale, 'analyzeSuggestionLongDuration')}`);
        }
        if (avgTokenCost > 50000) {
          console.log(`  💡 ${t(resolvedLocale, 'analyzeSuggestionHighTokens')}`);
        }
        if (trend === 'improving') {
          console.log(`  ✅ ${t(resolvedLocale, 'analyzeSuggestionImproving')}`);
        }

        // List recent runs
        console.log(`\n${t(resolvedLocale, 'analyzeRecentRuns')}:`);
        for (const run of recentRuns.slice(0, 5)) {
          const scoreStr = run.score !== undefined ? `${run.score}` : '-';
          const durationStr = formatDurationMs(run.duration);
          const date = new Date(run.createdAt).toLocaleDateString();
          console.log(`  ${date}  ${scoreStr.padStart(4)}  ${durationStr.padStart(8)}  ${run.runId}`);
        }

        console.log('');
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

  return analyzeCommand;
}
