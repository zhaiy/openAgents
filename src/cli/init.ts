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
  template?: string;
  listTemplates?: boolean;
}

interface TemplateMeta {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
}

function getTemplatesRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '../../templates');
}

function getAvailableTemplates(): Map<string, { path: string; meta: TemplateMeta }> {
  const templatesRoot = getTemplatesRoot();
  const templates = new Map<string, { path: string; meta: TemplateMeta }>();

  if (!fs.existsSync(templatesRoot)) {
    return templates;
  }

  const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const templateDir = path.join(templatesRoot, entry.name);
    const metaPath = path.join(templateDir, 'template.json');

    if (fs.existsSync(metaPath)) {
      try {
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent) as TemplateMeta;
        templates.set(entry.name, { path: templateDir, meta });
      } catch {
        // Skip templates with invalid metadata
      }
    }
  }

  return templates;
}

function copyTemplateTo(templateDir: string, targetDir: string): void {
  const entries = fs.readdirSync(templateDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'template.json') continue; // Skip metadata file

    const src = path.join(templateDir, entry.name);
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
    .option('-t, --template <name>', t(locale, 'initTemplateOption'))
    .option('--list-templates', t(locale, 'initListTemplatesOption'))
    .action(async (directory: string, options: InitOptions, command: Command) => {
      const resolvedLocale = resolveLocaleFromCommand(command, options.lang);
      const templates = getAvailableTemplates();

      // Handle --list-templates
      if (options.listTemplates) {
        console.log(t(resolvedLocale, 'initAvailableTemplates'));
        console.log('');
        for (const [id, { meta }] of templates) {
          const name = resolvedLocale === 'zh' ? meta.name : meta.name_en;
          const desc = resolvedLocale === 'zh' ? meta.description : meta.description_en;
          console.log(`  ${id}`);
          console.log(`    ${name}`);
          console.log(`    ${desc}`);
          console.log('');
        }
        return;
      }

      // Determine which template to use
      const templateId = options.template ?? 'default';
      const template = templates.get(templateId);

      if (!template) {
        console.error(t(resolvedLocale, 'initTemplateNotFound', { templateId }));
        console.log(t(resolvedLocale, 'initAvailableTemplatesHint'));
        process.exit(1);
      }

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

      copyTemplateTo(template.path, targetDir);
      const templateName = resolvedLocale === 'zh' ? template.meta.name : template.meta.name_en;
      console.log(t(resolvedLocale, 'initCompletedWithTemplate', { targetDir, templateName }));
      console.log(t(resolvedLocale, 'initNextStep'));
    });
}