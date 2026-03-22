import { StateManager } from '../../engine/state.js';
import type { DiagnosticsSummaryDto, ErrorSummary, NodeStatus } from '../dto.js';

interface ErrorMapping {
  pattern: RegExp;
  type: string;
  suggestedActions: string[];
}

const ERROR_MAPPINGS: ErrorMapping[] = [
  {
    pattern: /API key|api_key|authentication|unauthorized/i,
    type: 'AuthenticationError',
    suggestedActions: [
      'Check your API key configuration in Settings',
      'Verify the API key has sufficient permissions',
    ],
  },
  {
    pattern: /rate limit|too many requests|429/i,
    type: 'RateLimitError',
    suggestedActions: [
      'Wait before retrying',
      'Consider reducing request frequency',
    ],
  },
  {
    pattern: /timeout|timed out|ETIMEDOUT/i,
    type: 'TimeoutError',
    suggestedActions: [
      'The operation took too long to complete',
      'Check your network connection',
    ],
  },
  {
    pattern: /network|connection|ECONNREFUSED|DNS/i,
    type: 'NetworkError',
    suggestedActions: [
      'Check your network connection',
      'Verify the service endpoint is accessible',
    ],
  },
  {
    pattern: /parse|json|invalid.*format/i,
    type: 'ParseError',
    suggestedActions: [
      'Check the input data format',
      'Verify the input is valid JSON',
    ],
  },
  {
    pattern: /memory|heap|out of memory/i,
    type: 'MemoryError',
    suggestedActions: [
      'The operation required too much memory',
      'Consider breaking down the task into smaller steps',
    ],
  },
];

export class DiagnosticsService {
  constructor(private readonly stateManager: StateManager) {}

  /**
   * Get list of failed runs with summary
   */
  getFailedRunsSummary(): Array<{
    runId: string;
    workflowId: string;
    failedAt: number;
    failedNodeId?: string;
    errorType?: string;
    errorMessage?: string;
  }> {
    const runs = this.stateManager.listRuns();

    return runs
      .filter((run) => run.status === 'failed')
      .map((run) => {
        const failedNodeId = this.findFailedNodeId(run.steps);
        const errorInfo = this.extractErrorInfo(run.steps);

        return {
          runId: run.runId,
          workflowId: run.workflowId,
          failedAt: run.completedAt ?? Date.now(),
          failedNodeId,
          errorType: errorInfo.type,
          errorMessage: errorInfo.message,
        };
      })
      .sort((a, b) => b.failedAt - a.failedAt);
  }

  /**
   * Get list of runs with waiting gates
   */
  getWaitingGatesSummary(): Array<{
    runId: string;
    workflowId: string;
    stepId: string;
    waitedAt: number;
    preview?: string;
  }> {
    const runs = this.stateManager.listRuns();

    return runs
      .filter((run) => run.status === 'running')
      .flatMap((run) => {
        const waitingGates: Array<{
          runId: string;
          workflowId: string;
          stepId: string;
          waitedAt: number;
          preview?: string;
        }> = [];

        for (const [stepId, stepState] of Object.entries(run.steps)) {
          if (stepState.status === 'gate_waiting') {
            waitingGates.push({
              runId: run.runId,
              workflowId: run.workflowId,
              stepId,
              waitedAt: stepState.startedAt ?? Date.now(),
              preview: stepState.error,
            });
          }
        }

        return waitingGates;
      })
      .sort((a, b) => b.waitedAt - a.waitedAt);
  }

  /**
   * Get diagnostics summary for a specific run
   */
  getRunDiagnostics(runId: string): DiagnosticsSummaryDto | null {
    try {
      const run = this.stateManager.findRunById(runId);

      const failedNodeIds = this.findFailedNodeIds(run.steps);
      const gateWaitingNodeIds = this.findGateWaitingNodeIds(run.steps);
      const errorSummary = this.buildErrorSummary(run.steps);
      const upstreamStates = this.buildUpstreamStates(run.steps);

      return {
        runId,
        failedNodeIds,
        gateWaitingNodeIds,
        errorSummary,
        upstreamStates,
        downstreamImpact: {}, // Empty - depends_on info not available in run state
      };
    } catch {
      return null;
    }
  }

  /**
   * Get suggested actions for a specific error
   */
  getSuggestedActions(errorMessage?: string): string[] {
    if (!errorMessage) {
      return ['No specific error information available'];
    }

    for (const mapping of ERROR_MAPPINGS) {
      if (mapping.pattern.test(errorMessage)) {
        return mapping.suggestedActions;
      }
    }

    return [
      'Review the error message carefully',
      'Check the logs for more details',
      'Try running with debug mode if available',
      'Consider creating a new run with adjusted parameters',
    ];
  }

  private findFailedNodeId(steps: Record<string, { status: string }>): string | undefined {
    for (const [stepId, step] of Object.entries(steps)) {
      if (step.status === 'failed') {
        return stepId;
      }
    }
    return undefined;
  }

  private findFailedNodeIds(steps: Record<string, { status: string }>): string[] {
    return Object.entries(steps)
      .filter(([, step]) => step.status === 'failed')
      .map(([stepId]) => stepId);
  }

  private findGateWaitingNodeIds(steps: Record<string, { status: string }>): string[] {
    return Object.entries(steps)
      .filter(([, step]) => step.status === 'gate_waiting')
      .map(([stepId]) => stepId);
  }

  private extractErrorInfo(steps: Record<string, { status: string; error?: string }>): {
    type?: string;
    message?: string;
  } {
    for (const step of Object.values(steps)) {
      if (step.status === 'failed' && step.error) {
        const errorMsg = step.error as string;
        const mapped = ERROR_MAPPINGS.find((m) => m.pattern.test(errorMsg));
        return {
          type: mapped?.type ?? 'UnknownError',
          message: errorMsg,
        };
      }
    }
    return {};
  }

  private buildErrorSummary(
    steps: Record<string, { status: string; error?: string }>,
  ): ErrorSummary[] {
    const summaries: ErrorSummary[] = [];

    for (const [stepId, step] of Object.entries(steps)) {
      if (step.status === 'failed' && step.error) {
        const errorMsg = step.error as string;
        const mapped = ERROR_MAPPINGS.find((m) => m.pattern.test(errorMsg));
        summaries.push({
          nodeId: stepId,
          errorType: mapped?.type ?? 'UnknownError',
          errorMessage: errorMsg,
          suggestedActions: mapped?.suggestedActions ?? this.getSuggestedActions(errorMsg),
        });
      }
    }

    return summaries;
  }

  private buildUpstreamStates(
    steps: Record<string, { status: string }>,
  ): Record<string, NodeStatus> {
    const states: Record<string, NodeStatus> = {};
    const statusMap: Record<string, NodeStatus> = {
      pending: 'pending',
      running: 'running',
      completed: 'completed',
      failed: 'failed',
      skipped: 'skipped',
      gate_waiting: 'gate_waiting',
    };

    for (const [stepId, step] of Object.entries(steps)) {
      states[stepId] = statusMap[step.status] ?? 'pending';
    }

    return states;
  }
}
