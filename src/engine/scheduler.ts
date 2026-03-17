import type { ExecutionPlan, RunState } from '../types/index.js';

export class Scheduler {
  constructor(
    private readonly plan: ExecutionPlan,
    private readonly state: RunState,
    private readonly stepExecutor: (stepId: string) => Promise<void>,
  ) {}

  getReadyNodes(): string[] {
    return this.plan.nodes
      .filter((node) => this.state.steps[node.id]?.status === 'pending')
      .filter((node) =>
        node.dependencies.every((dependencyId) => {
          const status = this.state.steps[dependencyId]?.status;
          return status === 'completed' || status === 'skipped';
        }),
      )
      .map((node) => node.id);
  }

  async run(): Promise<void> {
    for (const group of this.plan.parallelGroups) {
      const executable = group.filter((stepId) => this.state.steps[stepId]?.status === 'pending');
      if (executable.length === 0) {
        continue;
      }
      const ready = new Set(this.getReadyNodes());
      const toRun = executable.filter((stepId) => ready.has(stepId));
      if (toRun.length === 0) {
        continue;
      }

      const results = await Promise.allSettled(toRun.map(async (stepId) => this.stepExecutor(stepId)));
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (rejected) {
        throw rejected.reason;
      }
    }

    const unfinished = Object.entries(this.state.steps)
      .filter(([, step]) => step.status === 'pending' || step.status === 'running')
      .map(([stepId]) => stepId);
    if (unfinished.length > 0) {
      throw new Error(
        `Workflow stalled with unfinished steps: ${unfinished.join(', ')}. Check dependency statuses or failure strategy.`,
      );
    }
  }
}
