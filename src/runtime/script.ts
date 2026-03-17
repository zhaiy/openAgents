import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { RuntimeError } from '../errors.js';
import type { AgentRuntime, ExecuteParams, ExecuteResult } from '../types/index.js';

interface ScriptRuntimeConfig {
  projectRoot: string;
  scriptFile?: string;
  scriptInline?: string;
}

export class ScriptRuntime implements AgentRuntime {
  private readonly config: ScriptRuntimeConfig;

  constructor(config: ScriptRuntimeConfig) {
    this.config = config;
  }

  async execute(params: ExecuteParams): Promise<ExecuteResult> {
    const startedAt = Date.now();
    const scriptCode = this.loadScript();
    const timeoutMs = params.timeoutSeconds * 1000;

    try {
      const sandbox = {
        require: (id: string) => this.safeRequire(id),
        console: { log: console.log, error: console.error, warn: console.warn },
        __input: params.userPrompt,
        __systemPrompt: params.systemPrompt,
        __result: undefined as string | undefined,
        process: { env: { ...process.env }, cwd: () => this.config.projectRoot },
      };

      const context = vm.createContext(sandbox);
      const wrappedScript = `
        (async () => {
          const input = __input;
          const systemPrompt = __systemPrompt;
          ${scriptCode}
        })().then(r => { __result = typeof r === 'string' ? r : JSON.stringify(r); });
      `;

      const script = new vm.Script(wrappedScript);

      // vm timeout protects against sync CPU-bound loops (e.g. while(true) {}).
      const executionPromise = script.runInContext(context, { timeout: timeoutMs });

      // Promise.race still protects async "never resolves" scripts.
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new RuntimeError(`Script execution timed out after ${params.timeoutSeconds}s`, 'script-runtime'));
        }, timeoutMs);
      });

      try {
        await Promise.race([executionPromise, timeoutPromise]);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      const output = sandbox.__result ?? '';
      return { output, duration: Date.now() - startedAt };
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'script execution failed';
      throw new RuntimeError(`Script execution failed: ${message}`, 'script-runtime');
    }
  }

  private loadScript(): string {
    if (this.config.scriptInline) {
      return this.config.scriptInline;
    }
    if (this.config.scriptFile) {
      const fullPath = path.resolve(this.config.projectRoot, this.config.scriptFile);
      if (!fs.existsSync(fullPath)) {
        throw new RuntimeError(`Script file not found: ${fullPath}`, 'script-runtime');
      }
      return fs.readFileSync(fullPath, 'utf8');
    }
    throw new RuntimeError('No script file or inline script provided', 'script-runtime');
  }

  private safeRequire(id: string): unknown {
    const allowedModules = ['fs', 'path', 'url', 'util', 'crypto', 'os'];
    if (allowedModules.includes(id)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(id);
    }
    if (id.startsWith('./') || id.startsWith('../')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(path.resolve(this.config.projectRoot, id));
    }
    throw new Error(`Module "${id}" is not allowed in script runtime. Allowed: ${allowedModules.join(', ')}`);
  }
}