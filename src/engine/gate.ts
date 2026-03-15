import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { getDefaultLocale, t, type Locale } from '../i18n/index.js';
import type { GateType } from '../types/index.js';

export type GateDecision =
  | { action: 'continue' }
  | { action: 'abort' }
  | { action: 'edit'; editedOutput: string };

export class GateManager {
  constructor(private readonly locale: Locale = getDefaultLocale()) {}

  async handleGate(stepId: string, gateType: GateType, output: string): Promise<GateDecision> {
    if (gateType !== 'approve') {
      return { action: 'continue' };
    }

    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
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
    } finally {
      rl.close();
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
