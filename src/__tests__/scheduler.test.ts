import { describe, expect, it } from 'vitest';

import { Scheduler } from '../engine/scheduler.js';
import type { ExecutionPlan, RunState } from '../types/index.js';

function makeState(stepIds: string[]): RunState {
  return {
    runId: 'run_1',
    workflowId: 'wf_1',
    status: 'running',
    input: 'input',
    startedAt: Date.now(),
    steps: Object.fromEntries(stepIds.map((id) => [id, { status: 'pending' as const }])),
  };
}

describe('Scheduler', () => {
  it('executes same-group nodes in parallel', async () => {
    const plan: ExecutionPlan = {
      nodes: [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: [] },
      ],
      order: ['a', 'b'],
      parallelGroups: [['a', 'b']],
    };
    const state = makeState(['a', 'b']);

    const started = Date.now();
    const scheduler = new Scheduler(plan, state, async (stepId) => {
      await new Promise<void>((resolve) => setTimeout(resolve, stepId === 'a' ? 120 : 150));
      state.steps[stepId] = { ...state.steps[stepId], status: 'completed', completedAt: Date.now() };
    });

    await scheduler.run();
    const elapsed = Date.now() - started;

    expect(state.steps.a.status).toBe('completed');
    expect(state.steps.b.status).toBe('completed');
    expect(elapsed).toBeLessThan(250);
  });

  it('stops following groups when one step fails', async () => {
    const plan: ExecutionPlan = {
      nodes: [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
      ],
      order: ['a', 'b'],
      parallelGroups: [['a'], ['b']],
    };
    const state = makeState(['a', 'b']);
    let executedB = false;

    const scheduler = new Scheduler(plan, state, async (stepId) => {
      if (stepId === 'a') {
        throw new Error('fail');
      }
      executedB = true;
    });

    await expect(scheduler.run()).rejects.toThrow('fail');
    expect(executedB).toBe(false);
  });

  it('treats skipped dependency as satisfied', async () => {
    const plan: ExecutionPlan = {
      nodes: [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
      ],
      order: ['a', 'b'],
      parallelGroups: [['a'], ['b']],
    };
    const state = makeState(['a', 'b']);

    const scheduler = new Scheduler(plan, state, async (stepId) => {
      if (stepId === 'a') {
        state.steps.a = { ...state.steps.a, status: 'skipped', completedAt: Date.now() };
        return;
      }
      state.steps.b = { ...state.steps.b, status: 'completed', completedAt: Date.now() };
    });

    await expect(scheduler.run()).resolves.toBeUndefined();
    expect(state.steps.a.status).toBe('skipped');
    expect(state.steps.b.status).toBe('completed');
  });
});
