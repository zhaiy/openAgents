import path from 'node:path';

import { ConfigLoader } from '../config/loader.js';
import { StateManager } from '../engine/state.js';
import { OutputWriter } from '../output/writer.js';
import { StepCache } from '../engine/cache.js';
import { DeferredGateProvider } from '../engine/gate.js';
import { RunEventEmitter } from './events/run-event-emitter.js';
import { GateService } from './services/gate-service.js';
import { RunRegistry } from './services/run-registry.js';
import { RunService } from './services/run-service.js';
import { SettingsService } from './services/settings-service.js';
import { WorkflowService } from './services/workflow-service.js';
import { WorkflowVisualService } from './services/workflow-visual-service.js';
import { RunVisualService } from './services/run-visual-service.js';
import { ConfigDraftService } from './services/config-draft-service.js';
import { RunCompareService } from './services/run-compare-service.js';
import { DiagnosticsService } from './services/diagnostics-service.js';
import { RunReuseService } from './services/run-reuse-service.js';

export interface WebAppContext {
  loader: ConfigLoader;
  workflowService: WorkflowService;
  runService: RunService;
  gateService: GateService;
  settingsService: SettingsService;
  runEventEmitter: RunEventEmitter;
  workflowVisualService: WorkflowVisualService;
  runVisualService: RunVisualService;
  configDraftService: ConfigDraftService;
  runCompareService: RunCompareService;
  diagnosticsService: DiagnosticsService;
  runReuseService: RunReuseService;
}

export function buildWebContext(projectRoot: string = process.cwd()): WebAppContext {
  const loader = new ConfigLoader(projectRoot);
  let projectConfig;
  try {
    projectConfig = loader.loadProjectConfig();
  } catch {
    // No project config found - continue with defaults for web server
    projectConfig = { output: { base_directory: '.runs' } };
  }
  const outputBaseDir = path.resolve(projectRoot, projectConfig.output.base_directory);
  const stateManager = new StateManager(outputBaseDir);
  const outputWriter = new OutputWriter();
  const cache = new StepCache(path.join(outputBaseDir, '.cache'));
  const runEventEmitter = new RunEventEmitter();
  const gateProvider = new DeferredGateProvider();
  const runRegistry = new RunRegistry();

  const workflowService = new WorkflowService(loader);
  const settingsService = new SettingsService(loader);
  const runService = new RunService({
    loader,
    stateManager,
    outputWriter,
    cache,
    eventEmitter: runEventEmitter,
    runRegistry,
    gateProvider,
  });
  const gateService = new GateService(gateProvider, runRegistry);

  // Visual services
  const workflowVisualService = new WorkflowVisualService(loader);
  const runVisualService = new RunVisualService(stateManager);
  const configDraftService = new ConfigDraftService(projectRoot);
  const runCompareService = new RunCompareService(stateManager);
  const diagnosticsService = new DiagnosticsService(stateManager);
  const runReuseService = new RunReuseService(stateManager, loader);

  return {
    loader,
    workflowService,
    runService,
    gateService,
    settingsService,
    runEventEmitter,
    workflowVisualService,
    runVisualService,
    configDraftService,
    runCompareService,
    diagnosticsService,
    runReuseService,
  };
}
