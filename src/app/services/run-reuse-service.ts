import { ConfigLoader } from '../../config/loader.js';
import { StateManager } from '../../engine/state.js';
import type {
  InputDiffItem,
  ReusableConfigDto,
  RerunPreviewDto,
  RunStartRequestDto,
  RuntimeOptions,
} from '../dto.js';

/**
 * Service for managing run reuse, rerun, and recovery operations.
 *
 * Data Model Relationships:
 * - ReusableConfigDto: Extracted from historical run, contains full context for rerun
 * - ConfigDraftDto: User-saved draft, independent of runs
 * - RunStartRequestDto: Request to start a new run, can reference sourceRunId
 *
 * Rerun Flow:
 * 1. User selects a historical run
 * 2. getReusableConfig() extracts the config
 * 3. getRerunPreview() shows differences (if editing)
 * 4. createRerunPayload() creates the new run request
 */
export class RunReuseService {
  constructor(
    private readonly stateManager: StateManager,
    private readonly loader: ConfigLoader,
  ) {}

  /**
   * Get reusable config from a historical run.
   * Returns full context including run status and timestamps.
   */
  getReusableConfig(runId: string): ReusableConfigDto | null {
    try {
      const run = this.stateManager.findRunById(runId);

      // Get workflow name
      let workflowName: string | undefined;
      try {
        const workflow = this.loader.loadWorkflow(run.workflowId);
        workflowName = workflow.workflow.name;
      } catch {
        // Workflow config may not be available
      }

      return {
        runId: run.runId,
        workflowId: run.workflowId,
        workflowName,
        input: run.input,
        inputData: run.inputData ?? {},
        runtimeOptions: {
          stream: true, // Default
        },
        runStatus: run.status as 'completed' | 'failed' | 'interrupted',
        startedAt: run.startedAt,
        durationMs: run.completedAt ? run.completedAt - run.startedAt : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get a preview of rerun changes.
   * Compares original config with proposed edits.
   */
  getRerunPreview(
    runId: string,
    edits?: {
      inputData?: Record<string, unknown>;
      runtimeOptions?: RuntimeOptions;
    },
  ): RerunPreviewDto | null {
    const config = this.getReusableConfig(runId);
    if (!config) return null;

    // Get workflow info
    let workflowInfo: RerunPreviewDto['workflow'];
    try {
      const workflow = this.loader.loadWorkflow(config.workflowId);
      workflowInfo = {
        workflowId: config.workflowId,
        name: workflow.workflow.name,
        stepCount: workflow.steps.length,
        hasGate: workflow.steps.some((s) => s.gate === 'approve'),
      };
    } catch {
      workflowInfo = {
        workflowId: config.workflowId,
        name: config.workflowName || config.workflowId,
        stepCount: 0,
        hasGate: false,
      };
    }

    // Calculate input diff
    const inputDiff = this.calculateInputDiff(
      config.inputData,
      edits?.inputData ?? config.inputData,
    );

    // Calculate runtime options diff
    const runtimeOptionsDiff = this.calculateRuntimeOptionsDiff(
      config.runtimeOptions,
      edits?.runtimeOptions ?? config.runtimeOptions,
    );

    // Generate warnings
    const warnings = this.generateWarnings(config, workflowInfo);

    return {
      sourceRun: {
        runId: config.runId,
        status: config.runStatus,
        startedAt: config.startedAt,
        durationMs: config.durationMs,
      },
      workflow: workflowInfo,
      inputDiff: inputDiff.length > 0 ? inputDiff : undefined,
      runtimeOptionsDiff: runtimeOptionsDiff.length > 0 ? runtimeOptionsDiff : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Create a rerun payload from a historical run.
   * Optionally includes edits and tracks the source run.
   */
  createRerunPayload(
    runId: string,
    edits?: Partial<RunStartRequestDto>,
  ): RunStartRequestDto | null {
    const config = this.getReusableConfig(runId);
    if (!config) return null;

    return {
      workflowId: config.workflowId,
      input: edits?.input ?? config.input,
      inputData: edits?.inputData ?? config.inputData,
      stream: edits?.stream ?? config.runtimeOptions.stream,
      autoApprove: edits?.autoApprove ?? config.runtimeOptions.autoApprove,
      noEval: edits?.noEval ?? config.runtimeOptions.noEval,
      sourceRunId: runId,
      recoveryOptions: edits?.recoveryOptions,
    };
  }

  /**
   * Create a rerun payload with edited input data.
   * Convenience method for the common edit-and-rerun case.
   */
  createEditedRerunPayload(
    runId: string,
    editedInputData: Record<string, unknown>,
    runtimeOptions?: RuntimeOptions,
  ): RunStartRequestDto | null {
    return this.createRerunPayload(runId, {
      inputData: editedInputData,
      stream: runtimeOptions?.stream,
      autoApprove: runtimeOptions?.autoApprove,
      noEval: runtimeOptions?.noEval,
    });
  }

  /**
   * Get the most recent run for a workflow.
   * Useful for suggesting rerun candidates.
   */
  getMostRecentRun(workflowId: string, status?: 'completed' | 'failed' | 'interrupted'): string | null {
    const runs = this.stateManager.listRuns({ workflowId });

    const filtered = status
      ? runs.filter((r) => r.status === status)
      : runs.filter((r) => r.status === 'completed' || r.status === 'failed' || r.status === 'interrupted');

    if (filtered.length === 0) return null;

    // Sort by startedAt descending
    filtered.sort((a, b) => b.startedAt - a.startedAt);

    return filtered[0].runId;
  }

  /**
   * Get last successful run for a workflow.
   */
  getLastSuccessfulRun(workflowId: string): string | null {
    return this.getMostRecentRun(workflowId, 'completed');
  }

  /**
   * Get last failed run for a workflow.
   */
  getLastFailedRun(workflowId: string): string | null {
    return this.getMostRecentRun(workflowId, 'failed');
  }

  /**
   * List recent runs for a workflow suitable for reuse.
   */
  listReusableRuns(
    workflowId: string,
    limit: number = 5,
  ): Array<{
    runId: string;
    status: string;
    startedAt: number;
    completedAt?: number;
    durationMs?: number;
    inputSummary: string;
  }> {
    const runs = this.stateManager.listRuns({ workflowId });

    return runs
      .filter((r) => r.status === 'completed' || r.status === 'failed' || r.status === 'interrupted')
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
      .map((run) => ({
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        durationMs: run.completedAt ? run.completedAt - run.startedAt : undefined,
        inputSummary: this.summarizeInput(run.inputData),
      }));
  }

  // ===========================================================================
  // Private helper methods
  // ===========================================================================

  private calculateInputDiff(
    original: Record<string, unknown>,
    newInput: Record<string, unknown>,
  ): InputDiffItem[] {
    const diff: InputDiffItem[] = [];
    const allKeys = new Set([...Object.keys(original), ...Object.keys(newInput)]);

    for (const key of allKeys) {
      const hasOriginal = key in original;
      const hasNew = key in newInput;

      if (!hasOriginal && hasNew) {
        diff.push({ field: key, new: newInput[key], type: 'added' });
      } else if (hasOriginal && !hasNew) {
        diff.push({ field: key, original: original[key], type: 'removed' });
      } else if (JSON.stringify(original[key]) !== JSON.stringify(newInput[key])) {
        diff.push({ field: key, original: original[key], new: newInput[key], type: 'changed' });
      }
    }

    return diff;
  }

  private calculateRuntimeOptionsDiff(
    original: RuntimeOptions,
    newOptions: RuntimeOptions,
  ): Array<{ field: 'stream' | 'autoApprove' | 'noEval'; original: boolean; new: boolean }> {
    const diff: Array<{ field: 'stream' | 'autoApprove' | 'noEval'; original: boolean; new: boolean }> = [];

    const fields: Array<'stream' | 'autoApprove' | 'noEval'> = ['stream', 'autoApprove', 'noEval'];

    for (const field of fields) {
      const originalValue = original[field] ?? false;
      const newValue = newOptions[field] ?? false;

      if (originalValue !== newValue) {
        diff.push({ field, original: originalValue, new: newValue });
      }
    }

    return diff;
  }

  private generateWarnings(
    config: ReusableConfigDto,
    workflowInfo: RerunPreviewDto['workflow'],
  ): string[] {
    const warnings: string[] = [];

    // Warn if rerunning a failed run without changes
    if (config.runStatus === 'failed') {
      warnings.push('This run previously failed. Consider reviewing the error before rerunning.');
    }

    // Warn if workflow has gates but autoApprove is not set
    if (workflowInfo.hasGate) {
      warnings.push('This workflow has gates that may require manual approval.');
    }

    // Warn if rerunning an interrupted run
    if (config.runStatus === 'interrupted') {
      warnings.push('This run was interrupted. The new run will start from the beginning.');
    }

    return warnings;
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