import { StateManager } from '../../engine/state.js';
import { ConfigLoader } from '../../config/loader.js';
import type { RunStartRequestDto, RuntimeOptions } from '../dto.js';

export interface ReusableConfig {
  workflowId: string;
  input: string;
  inputData: Record<string, unknown>;
  runtimeOptions: RuntimeOptions;
}

export class RunReuseService {
  constructor(
    private readonly stateManager: StateManager,
    private readonly loader: ConfigLoader,
  ) {}

  /**
   * Get reusable config from a historical run
   */
  getReusableConfig(runId: string): ReusableConfig | null {
    try {
      const run = this.stateManager.findRunById(runId);

      return {
        workflowId: run.workflowId,
        input: run.input,
        inputData: run.inputData ?? {},
        runtimeOptions: {
          stream: true, // default
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Create a rerun payload from a historical run
   */
  createRerunPayload(runId: string, edits?: Partial<RunStartRequestDto>): RunStartRequestDto | null {
    const config = this.getReusableConfig(runId);
    if (!config) return null;

    return {
      workflowId: config.workflowId,
      input: edits?.input ?? config.input,
      inputData: edits?.inputData ?? config.inputData,
      stream: edits?.stream ?? config.runtimeOptions.stream,
      autoApprove: edits?.autoApprove,
      noEval: edits?.noEval,
    };
  }

  /**
   * Create a rerun payload with edits
   */
  createEditedRerunPayload(
    runId: string,
    editedInputData: Record<string, unknown>,
  ): RunStartRequestDto | null {
    const config = this.getReusableConfig(runId);
    if (!config) return null;

    return {
      workflowId: config.workflowId,
      input: config.input,
      inputData: editedInputData,
      stream: config.runtimeOptions.stream,
      autoApprove: config.runtimeOptions.autoApprove,
      noEval: config.runtimeOptions.noEval,
    };
  }

  /**
   * Get the most recent run for a workflow
   */
  getMostRecentRun(workflowId: string, status?: 'completed' | 'failed'): string | null {
    const runs = this.stateManager.listRuns({ workflowId });

    const filtered = status
      ? runs.filter((r) => r.status === status)
      : runs;

    if (filtered.length === 0) return null;

    // Sort by startedAt descending
    filtered.sort((a, b) => b.startedAt - a.startedAt);

    return filtered[0].runId;
  }

  /**
   * Get last successful run for a workflow
   */
  getLastSuccessfulRun(workflowId: string): string | null {
    return this.getMostRecentRun(workflowId, 'completed');
  }

  /**
   * Get last failed run for a workflow
   */
  getLastFailedRun(workflowId: string): string | null {
    return this.getMostRecentRun(workflowId, 'failed');
  }

  /**
   * List recent runs for a workflow suitable for reuse
   */
  listReusableRuns(
    workflowId: string,
    limit: number = 5,
  ): Array<{
    runId: string;
    status: string;
    startedAt: number;
    completedAt?: number;
    inputSummary: string;
  }> {
    const runs = this.stateManager.listRuns({ workflowId });

    return runs
      .filter((r) => r.status === 'completed' || r.status === 'failed')
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
      .map((run) => ({
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        inputSummary: this.summarizeInput(run.inputData),
      }));
  }

  private summarizeInput(inputData?: Record<string, unknown>): string {
    if (!inputData) return 'No input data';
    const keys = Object.keys(inputData);
    if (keys.length === 0) return 'Empty input';
    if (keys.length <= 3) {
      return keys.map((k) => `${k}`).join(', ');
    }
    return `${keys.slice(0, 3).join(', ')} and ${keys.length - 3} more`;
  }
}
