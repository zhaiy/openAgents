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

export class GateManager {
  constructor(
    private readonly locale: Locale = getDefaultLocale(),
    private readonly options: GateOptions = {},
  ) {}

  async handleGate(stepId: string, gateType: GateType, output: string): Promise<GateDecision> {
    if (gateType !== 'approve') {
      return { action: 'continue' };
    }

    // Auto-approve mode: skip all prompts
    if (this.options.autoApprove) {
      return { action: 'continue' };
    }

    // Timeout auto-approve mode
    if (this.options.gateTimeoutSeconds && this.options.gateTimeoutSeconds > 0) {
      return this.handleGateWithTimeout(stepId, output, this.options.gateTimeoutSeconds);
    }

    // Default interactive mode
    return this.handleGateInteractive(stepId, output);
  }

  private async handleGateWithTimeout(
    stepId: string,
    output: string,
    timeoutSeconds: number,
  ): Promise<GateDecision> {
    const rl = readline.createInterface({ input: stdin, output: stdout });

    try {
      const timeoutPromise = new Promise<GateDecision>((resolve) => {
        setTimeout(() => {
          resolve({ action: 'continue' });
        }, timeoutSeconds * 1000);
      });

      const interactivePromise = this.handleGateInteractiveWithRl(stepId, output, rl);

      const decision = await Promise.race([timeoutPromise, interactivePromise]);
      return decision;
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
