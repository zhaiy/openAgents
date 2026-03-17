import { Command } from 'commander';

import { getDefaultLocale, t } from '../i18n/index.js';
import { resolveLocaleFromCommand } from './shared.js';
import { StepCache } from '../engine/cache.js';
import { ConfigLoader } from '../config/loader.js';

interface CacheOptions {
  lang?: string;
}

export function createCacheCommand(): Command {
  const locale = getDefaultLocale();

  const clearCommand = new Command('clear')
    .description('Clear all cached step outputs')
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (options: CacheOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const projectRoot = process.cwd();
        const loader = new ConfigLoader(projectRoot);
        const projectConfig = loader.loadProjectConfig();

        const cacheDir = `${projectConfig.output.base_directory}/.cache`;
        const cache = new StepCache(cacheDir);

        const count = cache.clear();
        console.log(t(resolvedLocale, 'cacheCleared', { count: String(count) }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(t(resolvedLocale, 'errorPrefix', { message }));
        process.exitCode = 1;
      }
    });

  const statsCommand = new Command('stats')
    .description('Show cache statistics')
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (options: CacheOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      try {
        const projectRoot = process.cwd();
        const loader = new ConfigLoader(projectRoot);
        const projectConfig = loader.loadProjectConfig();

        const cacheDir = `${projectConfig.output.base_directory}/.cache`;
        const cache = new StepCache(cacheDir);

        const stats = cache.stats();
        console.log(t(resolvedLocale, 'cacheStats', {
          count: String(stats.count),
          size: formatBytes(stats.totalSize),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(t(resolvedLocale, 'errorPrefix', { message }));
        process.exitCode = 1;
      }
    });

  return new Command('cache')
    .description('Manage step output cache')
    .addCommand(clearCommand)
    .addCommand(statsCommand);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}