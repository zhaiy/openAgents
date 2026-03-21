import { describe, expect, it, vi } from 'vitest';

import { DeferredGateProvider } from '../engine/gate.js';

describe('DeferredGateProvider', () => {
  it('resolves pending gate by submitted decision', async () => {
    const provider = new DeferredGateProvider(5_000);
    const decisionPromise = provider.waitForDecision('draft', 'output', { runId: 'run-1' });

    const submit = provider.submitDecision('run-1', 'draft', { action: 'continue' });
    const decision = await decisionPromise;

    expect(submit.status).toBe('accepted');
    expect(decision).toEqual({ action: 'continue' });
  });

  it('returns idempotent result when submitting action repeatedly', async () => {
    const provider = new DeferredGateProvider(5_000);
    const decisionPromise = provider.waitForDecision('draft', 'output', { runId: 'run-1' });

    const first = provider.submitDecision('run-1', 'draft', { action: 'abort' });
    const second = provider.submitDecision('run-1', 'draft', { action: 'continue' });
    const decision = await decisionPromise;

    expect(first.status).toBe('accepted');
    expect(second.status).toBe('already_resolved');
    expect(decision).toEqual({ action: 'abort' });
  });

  it('aborts gate on timeout', async () => {
    vi.useFakeTimers();
    const provider = new DeferredGateProvider(2_000);
    const decisionPromise = provider.waitForDecision('draft', 'output', { runId: 'run-1' });

    await vi.advanceTimersByTimeAsync(2_000);
    const decision = await decisionPromise;

    expect(decision).toEqual({ action: 'abort' });
    vi.useRealTimers();
  });

  it('cancels all pending gates by run id', async () => {
    const provider = new DeferredGateProvider(30_000);
    const promiseA = provider.waitForDecision('s1', 'output-a', { runId: 'run-1' });
    const promiseB = provider.waitForDecision('s2', 'output-b', { runId: 'run-2' });

    provider.cancelPendingRun('run-1');

    expect(await promiseA).toEqual({ action: 'abort' });
    expect(provider.listPending('run-1')).toHaveLength(0);
    expect(provider.listPending('run-2')).toHaveLength(1);

    provider.submitDecision('run-2', 's2', { action: 'continue' });
    expect(await promiseB).toEqual({ action: 'continue' });
  });
});
