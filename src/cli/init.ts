import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { stdin, stdout } from 'node:process';

import { Command } from 'commander';

import { getDefaultLocale, t } from '../i18n/index.js';
import { resolveLocaleFromCommand } from './shared.js';

interface InitOptions {
  lang?: string;
}

function getTemplatesRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '../../templates');
}

function copyTemplatesTo(targetDir: string): void {
  const templatesRoot = getTemplatesRoot();
  const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(templatesRoot, entry.name);
    const dst = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}

async function confirmOverwrite(targetDir: string, promptText: string): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${promptText} `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

export function createInitCommand(): Command {
  const locale = getDefaultLocale();
  return new Command('init')
    .description(t(locale, 'initDescription'))
    .argument('[directory]', t(locale, 'initDirectoryArg'), '.')
    .option('--lang <locale>', t(locale, 'langOption'))
    .action(async (directory: string, options: InitOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      const targetDir = path.resolve(process.cwd(), directory);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const existing = fs.readdirSync(targetDir);
      if (existing.length > 0) {
        const allow = await confirmOverwrite(targetDir, t(resolvedLocale, 'initNonEmptyConfirm', { targetDir }));
        if (!allow) {
          console.log(t(resolvedLocale, 'initCancelled'));
          return;
        }
      }

      copyTemplatesTo(targetDir);
      console.log(t(resolvedLocale, 'initCompleted', { targetDir }));
      console.log(t(resolvedLocale, 'initNextStep'));
    });
}
