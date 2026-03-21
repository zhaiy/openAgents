import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { getDefaultLocale, t, type Locale } from '../i18n/index.js';
import type { GateType, GateOptions } from '../types/index.js';

export type GateDecision =
  | { action: 'continue' }
  | { action: 'abort' }
  | { action: 'edit'; editedOutput: string };

export interface GateRequestContext {
  runId?: string;
}

export interface GateProvider {
  waitForDecision(stepId: string, output: string, context?: GateRequestContext): Promise<GateDecision>;
}

export class InteractiveGateProvider implements GateProvider {
  constructor(
    private readonly locale: Locale = getDefaultLocale(),
    private readonly options: GateOptions = {},
  ) {}

  async waitForDecision(stepId: string, output: string): Promise<GateDecision> {
    if (this.options.gateTimeoutSeconds && this.options.gateTimeoutSeconds > 0) {
      return this.handleGateWithTimeout(stepId, output, this.options.gateTimeoutSeconds);
    }
    return this.handleGateInteractive(stepId, output);
  }

  private async handleGateWithTimeout(
    stepId: string,
    output: string,
    timeoutSeconds: number,
  ): Promise<GateDecision> {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const timeoutMs = timeoutSeconds * 1000;

    try {
      const timeoutPromise = new Promise<GateDecision>((resolve) => {
        setTimeout(() => {
          resolve({ action: 'continue' });
        }, timeoutMs);
      });
      const interactivePromise = this.handleGateInteractiveWithRl(stepId, output, rl);
      return await Promise.race([timeoutPromise, interactivePromise]);
    } finally {
      rl.close();
    }
  }

  private async handleGateInteractive(stepId: string, output: string): Promise<GateDecision> {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      return await this.handleGateInteractiveWithRl(stepId, output, rl);
    } finally {
      rl.close();
    }
  }

  private async handleGateInteractiveWithRl(
    stepId: string,
    output: string,
    rl: readline.Interface,
  ): Promise<GateDecision> {
    while (true) {
      const answer = (await rl.question(t(this.locale, 'gatePrompt', { stepId }))).trim().toLowerCase();
      if (answer === '' || answer === 'yes' || answer === 'y' || answer === '是') {
        return { action: 'continue' };
      }
      if (answer === 'no' || answer === 'n' || answer === '否') {
        return { action: 'abort' };
      }
      if (answer === 'edit' || answer === 'e' || answer === '编辑') {
        const edited = this.editOutput(output);
        return { action: 'edit', editedOutput: edited };
      }
      console.log(t(this.locale, 'gateInvalidInput'));
    }
  }

  private editOutput(content: string): string {
    const editor = process.env.EDITOR || 'vi';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-gate-'));
    const tmpFile = path.join(tmpDir, 'gate-edit.md');
    fs.writeFileSync(tmpFile, content, 'utf8');
    const result = spawnSync(editor, [tmpFile], { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(t(this.locale, 'gateEditorExitError', { code: String(result.status ?? -1) }));
    }
    const edited = fs.readFileSync(tmpFile, 'utf8');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return edited;
  }
}

type PendingGate = {
  stepId: string;
  runId?: string;
  output: string;
  createdAt: number;
  settled: boolean;
  resolve: (decision: GateDecision) => void;
  timeout: NodeJS.Timeout;
};

export type GateActionSubmitResult =
  | { status: 'accepted'; decision: GateDecision }
  | { status: 'already_resolved'; decision: GateDecision }
  | { status: 'not_found' };

export class DeferredGateProvider implements GateProvider {
  private readonly pending = new Map<string, PendingGate>();
  private readonly resolved = new Map<string, GateDecision>();

  constructor(private readonly timeoutMs: number = 30 * 60 * 1000) {}

  async waitForDecision(stepId: string, output: string, context?: GateRequestContext): Promise<GateDecision> {
    const key = this.buildKey(context?.runId, stepId);
    if (this.pending.has(key)) {
      throw new Error(`Gate already pending for step "${stepId}"`);
    }
    return await new Promise<GateDecision>((resolve) => {
      const timeout = setTimeout(() => {
        const current = this.pending.get(key);
        if (!current || current.settled) {
          return;
        }
        current.settled = true;
        this.pending.delete(key);
        const decision: GateDecision = { action: 'abort' };
        this.resolved.set(key, decision);
        resolve(decision);
      }, this.timeoutMs);

      this.pending.set(key, {
        stepId,
        runId: context?.runId,
        output,
        createdAt: Date.now(),
        settled: false,
        resolve: (decision) => {
          clearTimeout(timeout);
          resolve(decision);
        },
        timeout,
      });
    });
  }

  submitDecision(runId: string | undefined, stepId: string, decision: GateDecision): GateActionSubmitResult {
    const key = this.buildKey(runId, stepId);
    const pending = this.pending.get(key);
    if (!pending) {
      const existing = this.resolved.get(key);
      if (existing) {
        return { status: 'already_resolved', decision: existing };
      }
      return { status: 'not_found' };
    }
    if (pending.settled) {
      const existing = this.resolved.get(key) ?? decision;
      return { status: 'already_resolved', decision: existing };
    }
    pending.settled = true;
    this.pending.delete(key);
    this.resolved.set(key, decision);
    pending.resolve(decision);
    return { status: 'accepted', decision };
  }

  cancelPendingRun(runId: string): void {
    for (const [key, pending] of this.pending.entries()) {
      if (pending.runId !== runId) {
        continue;
      }
      if (pending.settled) {
        continue;
      }
      pending.settled = true;
      this.pending.delete(key);
      clearTimeout(pending.timeout);
      const decision: GateDecision = { action: 'abort' };
      this.resolved.set(key, decision);
      pending.resolve(decision);
    }
  }

  listPending(runId?: string): Array<{ runId?: string; stepId: string; createdAt: number; outputPreview: string }> {
    return [...this.pending.values()]
      .filter((item) => (runId ? item.runId === runId : true))
      .map((item) => ({
        runId: item.runId,
        stepId: item.stepId,
        createdAt: item.createdAt,
        outputPreview: item.output.slice(0, 500),
      }));
  }

  private buildKey(runId: string | undefined, stepId: string): string {
    return `${runId ?? '__global__'}::${stepId}`;
  }
}

export class GateManager {
  private readonly gateProvider: GateProvider;

  constructor(
    locale: Locale = getDefaultLocale(),
    private readonly options: GateOptions = {},
    gateProvider?: GateProvider,
  ) {
    this.gateProvider = gateProvider ?? new InteractiveGateProvider(locale, options);
  }

  async handleGate(stepId: string, gateType: GateType, output: string, context?: GateRequestContext): Promise<GateDecision> {
    if (gateType !== 'approve') {
      return { action: 'continue' };
    }

    // Auto-approve mode: skip all prompts
    if (this.options.autoApprove) {
      return { action: 'continue' };
    }
    return await this.gateProvider.waitForDecision(stepId, output, context);
  }
}
