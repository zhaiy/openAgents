import { StateManager } from '../../engine/state.js';
import { randomUUID } from 'node:crypto';
import type {
  DurationDiff,
  InputDiff,
  NodeStatusDiff,
  RunComparisonDto,
  RunComparisonSessionDto,
  TokenUsage,
} from '../dto.js';

export class RunCompareService {
  private readonly sessions = new Map<string, RunComparisonSessionDto>();

  constructor(private readonly stateManager: StateManager) {}

  /**
   * Compare two runs (stateless - no session management)
   */
  compare(runAId: string, runBId: string): RunComparisonDto {
    const runA = this.stateManager.findRunById(runAId);
    const runB = this.stateManager.findRunById(runBId);

    const inputDiff = this.computeInputDiff(runA.inputData, runB.inputData);
    const nodeStatusDiff = this.computeNodeStatusDiff(runA.steps, runB.steps);
    const durationDiff = this.computeDurationDiff(runA, runB);
    const tokenUsageDiff = this.computeTokenUsageDiff(runA.steps, runB.steps);
    const outputDiffSummary = this.computeOutputDiffSummary(runA.steps, runB.steps);

    return {
      runAId,
      runBId,
      inputDiff: inputDiff.length > 0 ? inputDiff : undefined,
      statusDiff: {
        runA: runA.status,
        runB: runB.status,
      },
      nodeStatusDiff: nodeStatusDiff.length > 0 ? nodeStatusDiff : undefined,
      durationDiff,
      tokenUsageDiff,
      outputDiffSummary,
    };
  }

  createSession(runAId: string, runBId: string): RunComparisonSessionDto {
    const session: RunComparisonSessionDto = {
      sessionId: randomUUID(),
      createdAt: Date.now(),
      comparison: this.compare(runAId, runBId),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId: string): RunComparisonSessionDto | null {
    return this.sessions.get(sessionId) ?? null;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  private computeInputDiff(
    inputDataA?: Record<string, unknown>,
    inputDataB?: Record<string, unknown>,
  ): InputDiff[] {
    const diffs: InputDiff[] = [];
    const keysA = new Set(Object.keys(inputDataA ?? {}));
    const keysB = new Set(Object.keys(inputDataB ?? {}));
    const allKeys = new Set([...keysA, ...keysB]);

    for (const key of allKeys) {
      const valueA = inputDataA?.[key];
      const valueB = inputDataB?.[key];

      if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
        diffs.push({ field: key, valueA, valueB });
      }
    }

    return diffs;
  }

  private computeNodeStatusDiff(
    stepsA: Record<string, { status: string }>,
    stepsB: Record<string, { status: string }>,
  ): NodeStatusDiff[] {
    const diffs: NodeStatusDiff[] = [];
    const keysA = new Set(Object.keys(stepsA));
    const keysB = new Set(Object.keys(stepsB));
    const allKeys = new Set([...keysA, ...keysB]);

    for (const key of allKeys) {
      const stepA = stepsA[key];
      const stepB = stepsB[key];

      if (!stepA || !stepB) continue;
      if (stepA.status !== stepB.status) {
        diffs.push({
          nodeId: key,
          statusA: stepA.status as NodeStatusDiff['statusA'],
          statusB: stepB.status as NodeStatusDiff['statusB'],
        });
      }
    }

    return diffs;
  }

  private computeDurationDiff(
    runA: { startedAt: number; completedAt?: number },
    runB: { startedAt: number; completedAt?: number },
  ): DurationDiff | undefined {
    const durationA = runA.completedAt
      ? runA.completedAt - runA.startedAt
      : Date.now() - runA.startedAt;
    const durationB = runB.completedAt
      ? runB.completedAt - runB.startedAt
      : Date.now() - runB.startedAt;

    if (durationA === durationB) return undefined;

    return { runA: durationA, runB: durationB };
  }

  private computeTokenUsageDiff(
    stepsA: Record<string, { tokenUsage?: TokenUsage }>,
    stepsB: Record<string, { tokenUsage?: TokenUsage }>,
  ): { runA: TokenUsage; runB: TokenUsage } | undefined {
    const usageA = this.sumTokenUsage(stepsA);
    const usageB = this.sumTokenUsage(stepsB);

    if (!usageA && !usageB) return undefined;
    if (!usageA || !usageB) return { runA: usageA!, runB: usageB! };

    if (
      usageA.promptTokens === usageB.promptTokens &&
      usageA.completionTokens === usageB.completionTokens &&
      usageA.totalTokens === usageB.totalTokens
    ) {
      return undefined;
    }

    return { runA: usageA, runB: usageB };
  }

  private computeOutputDiffSummary(
    stepsA: Record<string, { status: string; outputFile?: string }>,
    stepsB: Record<string, { status: string; outputFile?: string }>,
  ): string | undefined {
    // Compare number of completed steps with outputs
    const completedWithOutputA = Object.values(stepsA).filter(
      (s) => s.status === 'completed' && s.outputFile,
    ).length;
    const completedWithOutputB = Object.values(stepsB).filter(
      (s) => s.status === 'completed' && s.outputFile,
    ).length;

    if (completedWithOutputA !== completedWithOutputB) {
      return `Run A completed ${completedWithOutputA} steps with output, Run B completed ${completedWithOutputB} steps with output`;
    }

    return undefined;
  }

  private sumTokenUsage(
    steps: Record<string, { tokenUsage?: TokenUsage }>,
  ): TokenUsage | undefined {
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for (const step of Object.values(steps)) {
      if (step.tokenUsage) {
        promptTokens += step.tokenUsage.promptTokens ?? 0;
        completionTokens += step.tokenUsage.completionTokens ?? 0;
        totalTokens += step.tokenUsage.totalTokens ?? 0;
      }
    }

    if (totalTokens === 0) return undefined;

    return { promptTokens, completionTokens, totalTokens };
  }
}
