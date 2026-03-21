import type { RunState } from '../../types/index.js';
import type { WebEventHandler } from '../events/web-event-handler.js';

interface ActiveRunContext {
  runId: string;
  workflowId: string;
  startedAt: number;
  promise: Promise<RunState>;
  eventHandler: WebEventHandler;
}

export class RunRegistry {
  private readonly activeRuns = new Map<string, ActiveRunContext>();

  register(context: ActiveRunContext): void {
    this.activeRuns.set(context.runId, context);
    context.promise.finally(() => {
      this.activeRuns.delete(context.runId);
    });
  }

  get(runId: string): ActiveRunContext | undefined {
    return this.activeRuns.get(runId);
  }

  listActiveRunIds(): string[] {
    return [...this.activeRuns.keys()];
  }
}
