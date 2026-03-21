import { Command } from 'commander';

import { getDefaultLocale, t } from '../i18n/index.js';
import { WebServer } from '../web/server.js';
import { resolveLocaleFromCommand } from './shared.js';

interface WebOptions {
  host?: string;
  port?: number;
  lang?: string;
}

export function createWebCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('web')
    .description('Start OpenAgents Web API server')
    .option('--host <host>', 'Host to listen on', '127.0.0.1')
    .option('-p, --port <port>', 'Port to listen on', (value) => parseInt(value, 10), 3456)
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (options: WebOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      const server = new WebServer({
        host: options.host,
        port: options.port,
      });
      await server.start();
      console.log(t(resolvedLocale, 'debugServerStarted', { port: String(options.port ?? 3456) }));
      console.log(`API: http://${options.host ?? '127.0.0.1'}:${options.port ?? 3456}/api`);
    });
}
