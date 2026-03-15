#!/usr/bin/env node

import { Command } from 'commander';

import { getDefaultLocale, resolveLocale, t } from '../i18n/index.js';
import { createResumeCommand } from './resume.js';
import { createRunCommand } from './run.js';
import { createRunsCommand } from './runs.js';
import { createInitCommand } from './init.js';
import { createValidateCommand } from './validate.js';
import { createAgentsCommand } from './agents.js';
import { createWorkflowsCommand } from './workflows.js';

const program = new Command();

const defaultLocale = getDefaultLocale();

program
  .name('openagents')
  .description(t(defaultLocale, 'cliDescription'))
  .version('0.1.0')
  .option('--lang <locale>', t(defaultLocale, 'langOption'), (value: string) => resolveLocale(value), defaultLocale);

program.addCommand(createRunCommand());
program.addCommand(createResumeCommand());
program.addCommand(createRunsCommand());
program.addCommand(createInitCommand());
program.addCommand(createValidateCommand());
program.addCommand(createAgentsCommand());
program.addCommand(createWorkflowsCommand());

program.parse();
