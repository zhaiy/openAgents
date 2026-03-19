import path from 'node:path';

import type { Command } from 'commander';

import { ConfigLoader } from '../config/loader.js';
import { GateManager } from '../engine/gate.js';
import { StateManager } from '../engine/state.js';
import { WorkflowEngine } from '../engine/workflow-engine.js';
import { getDefaultLocale, resolveLocale, type Locale } from '../i18n/index.js';
import { OutputWriter } from '../output/writer.js';
import { createRuntime } from '../runtime/factory.js';
import type { GateOptions } from '../types/index.js';
import { ProgressUI } from '../ui/progress.js';
import { StepCache } from '../engine/cache.js';
import { CLIEventHandler } from './event-handler.js';

export interface AppContext {
  projectRoot: string;
  loader: ConfigLoader;
  stateManager: StateManager;
  engine: WorkflowEngine;
}

export function buildAppContext(locale?: Locale, gateOptions?: GateOptions): AppContext {
  const projectRoot = process.cwd();
  const loader = new ConfigLoader(projectRoot);
  const projectConfig = loader.loadProjectConfig();
  const outputBaseDir = path.resolve(projectRoot, projectConfig.output.base_directory);
  const stateManager = new StateManager(outputBaseDir);
  const outputWriter = new OutputWriter();
  const resolvedLocale = locale ?? getDefaultLocale();
  const gateManager = new GateManager(resolvedLocale, gateOptions);
  const progressUI = new ProgressUI(resolvedLocale);
  const cache = new StepCache(path.join(outputBaseDir, '.cache'));
  const eventHandler = new CLIEventHandler(progressUI);

  const engine = new WorkflowEngine({
    configLoader: loader,
    stateManager,
    runtimeFactory: createRuntime,
    outputWriter,
    gateManager,
    eventHandler,
    cache,
  });

  return { projectRoot, loader, stateManager, engine };
}

export function resolveLocaleFromCommand(command: Command, localLang?: string): Locale {
  const globalOptions = command.optsWithGlobals();
  const globalLang = typeof globalOptions.lang === 'string' ? globalOptions.lang : undefined;
  return resolveLocale(localLang ?? globalLang ?? process.env.OPENAGENTS_LANG);
}

export function formatDateTime(ts?: number): string {
  if (!ts) {
    return '-';
  }
  const date = new Date(ts);
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDurationMs(ms?: number): string {
  if (!ms || ms <= 0) {
    return '-';
  }
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  if (min === 0) {
    return `${rest}s`;
  }
  return `${min}m ${rest}s`;
}
