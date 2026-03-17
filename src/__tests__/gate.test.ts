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

describe('GateManager with GateOptions', () => {
  it('auto-approves when autoApprove option is true', async () => {
    const manager = new GateManager(undefined, { autoApprove: true });
    const decision = await manager.handleGate('outline', 'approve', 'content');

    // Should return continue without prompting
    expect(decision).toEqual({ action: 'continue' });
  });

  it('auto-approves non-approve gate regardless of options', async () => {
    const manager = new GateManager(undefined, { autoApprove: false });
    const decision = await manager.handleGate('outline', 'auto', 'content');

    expect(decision).toEqual({ action: 'continue' });
  });

  it('behaves normally when no gate options provided', async () => {
    const question = vi.fn(async () => 'yes');
    const close = vi.fn();
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      question,
      close,
    } as unknown as ReturnType<typeof readline.createInterface>);

    const manager = new GateManager(undefined, {});
    const decision = await manager.handleGate('outline', 'approve', 'content');

    expect(decision).toEqual({ action: 'continue' });
    expect(question).toHaveBeenCalledTimes(1);
  });

  it('timeout auto-approves after specified seconds', async () => {
    vi.useFakeTimers();

    const question = vi.fn(async () => {
      // Simulate a long wait that should timeout
      await new Promise(() => {}); // Never resolves
      return 'no';
    });
    const close = vi.fn();
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      question,
      close,
    } as unknown as ReturnType<typeof readline.createInterface>);

    const manager = new GateManager(undefined, { gateTimeoutSeconds: 5 });
    const decisionPromise = manager.handleGate('outline', 'approve', 'content');

    // Fast-forward time by 5 seconds
    await vi.advanceTimersByTimeAsync(5000);

    const decision = await decisionPromise;

    expect(decision).toEqual({ action: 'continue' });

    vi.useRealTimers();
  });

  it('timeout returns user response if answered before timeout', async () => {
    vi.useFakeTimers();

    const question = vi.fn(async () => {
      // Simulate quick response (within 1 second)
      await vi.advanceTimersByTimeAsync(500);
      return 'no';
    });
    const close = vi.fn();
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      question,
      close,
    } as unknown as ReturnType<typeof readline.createInterface>);

    const manager = new GateManager(undefined, { gateTimeoutSeconds: 5 });
    const decision = await manager.handleGate('outline', 'approve', 'content');

    // User responded before timeout, should return abort
    expect(decision).toEqual({ action: 'abort' });

    vi.useRealTimers();
  });

  it('autoApprove takes precedence over timeout', async () => {
    const manager = new GateManager(undefined, { autoApprove: true, gateTimeoutSeconds: 5 });
    const decision = await manager.handleGate('outline', 'approve', 'content');

    // autoApprove should immediately return without waiting for timeout
    expect(decision).toEqual({ action: 'continue' });
  });
});
