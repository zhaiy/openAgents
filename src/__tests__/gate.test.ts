import { describe, expect, it, vi } from 'vitest';

import readline from 'node:readline/promises';

import { GateManager } from '../engine/gate.js';

describe('GateManager', () => {
  it('returns continue for non-approve gate', async () => {
    const manager = new GateManager();
    const decision = await manager.handleGate('outline', 'auto', 'content');
    expect(decision).toEqual({ action: 'continue' });
  });

  it('returns continue when user types yes', async () => {
    const question = vi.fn(async () => 'yes');
    const close = vi.fn();
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      question,
      close,
    } as unknown as ReturnType<typeof readline.createInterface>);

    const manager = new GateManager();
    const decision = await manager.handleGate('outline', 'approve', 'content');

    expect(decision).toEqual({ action: 'continue' });
    expect(question).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns abort when user types no', async () => {
    const question = vi.fn(async () => 'no');
    const close = vi.fn();
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      question,
      close,
    } as unknown as ReturnType<typeof readline.createInterface>);

    const manager = new GateManager();
    const decision = await manager.handleGate('outline', 'approve', 'content');

    expect(decision).toEqual({ action: 'abort' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('re-prompts on invalid input then accepts yes', async () => {
    const answers = ['invalid', 'yes'];
    const question = vi.fn(async () => answers.shift() ?? 'yes');
    const close = vi.fn();
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      question,
      close,
    } as unknown as ReturnType<typeof readline.createInterface>);

    const manager = new GateManager();
    const decision = await manager.handleGate('outline', 'approve', 'content');

    expect(decision).toEqual({ action: 'continue' });
    expect(question).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns edited output when user chooses edit', async () => {
    const question = vi.fn(async () => 'edit');
    const close = vi.fn();
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      question,
      close,
    } as unknown as ReturnType<typeof readline.createInterface>);

    const manager = new GateManager();
    vi.spyOn(manager as unknown as { editOutput: (content: string) => string }, 'editOutput').mockReturnValue(
      'edited-content',
    );

    const decision = await manager.handleGate('outline', 'approve', 'content');
    expect(decision).toEqual({ action: 'edit', editedOutput: 'edited-content' });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
