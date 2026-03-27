/**
 * Review Chain Integration Tests (E6)
 *
 * Tests the complete failure review main chain:
 * 1. Failed run -> diagnostics summary
 * 2. Diagnostics -> recovery classification
 * 3. Failed run vs successful run comparison
 * 4. Version snapshot, diff analysis, and trend statistics
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticsService } from '../app/services/diagnostics-service.js';
import { RunCompareService } from '../app/services/run-compare-service.js';
import type { RunState, StepConfig } from '../types/index.js';

describe('Review Chain Integration (E6)', () => {
  let diagnosticsService: DiagnosticsService;
  let compareService: RunCompareService;
  let mockStateManager: {
    listRuns: ReturnType<typeof vi.fn>;
    findRunById: ReturnType<typeof vi.fn>;
  };

  const createMockRunState = (overrides: Partial<RunState> = {}): RunState => ({
    runId: 'run-123',
    workflowId: 'wf-456',
    workflowName: 'Test Workflow',
    status: 'completed',
    input: 'test input',
    inputData: { query: 'test' },
    startedAt: 1000,
    completedAt: 5000,
    steps: {},
    ...overrides,
  });

  beforeEach(() => {
    mockStateManager = {
      listRuns: vi.fn(),
      findRunById: vi.fn(),
    };
    diagnosticsService = new DiagnosticsService(mockStateManager as never);
    // Use a short TTL for testing
    compareService = new RunCompareService(mockStateManager as never, 1000);
  });

  describe('Failure Review Main Chain', () => {
    it('should provide complete diagnostics for a failed run', () => {
      const failedRun = createMockRunState({
        runId: 'run-failed',
        status: 'failed',
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
          'step2': {
            status: 'failed',
            startedAt: 2000,
            completedAt: 3000,
            error: 'API key is invalid',
          },
          'step3': {
            status: 'skipped',
            startedAt: 3000,
          },
        },
      });

      mockStateManager.findRunById.mockReturnValue(failedRun);

      const diagnostics = diagnosticsService.getRunDiagnostics('run-failed');

      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.runId).toBe('run-failed');
      expect(diagnostics!.runStatus).toBe('failed');
      expect(diagnostics!.failedNodeIds).toContain('step2');
      expect(diagnostics!.errorSummary).toHaveLength(1);
      expect(diagnostics!.errorSummary[0].errorType).toBe('AuthenticationError');
      expect(diagnostics!.recommendedActions).toBeDefined();
      expect(diagnostics!.recommendedActions.length).toBeGreaterThan(0);
    });

    it('should compute recovery scope for failed runs', () => {
      const failedRun = createMockRunState({
        runId: 'run-failed',
        status: 'failed',
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
          'step2': {
            status: 'failed',
            startedAt: 2000,
            completedAt: 3000,
            error: 'timeout error',
          },
        },
      });

      mockStateManager.findRunById.mockReturnValue(failedRun);

      const diagnostics = diagnosticsService.getRunDiagnostics('run-failed');

      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.recoveryScope).toBeDefined();
      expect(diagnostics!.recoveryScope!.reusedCount).toBe(1);
      expect(diagnostics!.recoveryScope!.rerunCount).toBe(1);
    });

    it('should compute failureRecap for failed runs (E4)', () => {
      const failedRun = createMockRunState({
        runId: 'run-failed',
        status: 'failed',
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
          'step2': {
            status: 'failed',
            startedAt: 2000,
            completedAt: 3000,
            error: 'API key is invalid',
          },
        },
      });

      mockStateManager.findRunById.mockReturnValue(failedRun);

      const diagnostics = diagnosticsService.getRunDiagnostics('run-failed');

      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.failureRecap).toBeDefined();
      expect(diagnostics!.failureRecap!.primaryErrorType).toBe('AuthenticationError');
      expect(diagnostics!.failureRecap!.totalAffectedNodes).toBe(1);
      expect(diagnostics!.failureRecap!.summary).toContain('step2');
      expect(diagnostics!.failureRecap!.insight).toBeTruthy();
    });

    it('should not compute failureRecap for successful runs', () => {
      const successfulRun = createMockRunState({
        runId: 'run-success',
        status: 'completed',
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
        },
      });

      mockStateManager.findRunById.mockReturnValue(successfulRun);

      const diagnostics = diagnosticsService.getRunDiagnostics('run-success');

      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.failureRecap).toBeUndefined();
    });

    it('should compute sourceRunInfo for recovery runs (E4)', () => {
      const recoveryRun = createMockRunState({
        runId: 'run-recovery',
        status: 'completed',
        sourceRunId: 'run-original',
        recoveryInfo: {
          reusedStepIds: ['step1'],
          rerunStepIds: ['step2'],
        },
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
          'step2': {
            status: 'completed',
            startedAt: 2000,
            completedAt: 3000,
            outputFile: '/output/step2.json',
          },
        },
      });

      mockStateManager.findRunById.mockReturnValue(recoveryRun);

      const diagnostics = diagnosticsService.getRunDiagnostics('run-recovery');

      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.sourceRunInfo).toBeDefined();
      expect(diagnostics!.sourceRunInfo!.sourceRunId).toBe('run-original');
      expect(diagnostics!.sourceRunInfo!.relationship).toBe('recover');
      expect(diagnostics!.sourceRunInfo!.reusedStepCount).toBe(1);
      expect(diagnostics!.sourceRunInfo!.rerunStepCount).toBe(1);
    });

    it('should not compute sourceRunInfo for non-recovery runs', () => {
      const normalRun = createMockRunState({
        runId: 'run-normal',
        status: 'completed',
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
        },
      });

      mockStateManager.findRunById.mockReturnValue(normalRun);

      const diagnostics = diagnosticsService.getRunDiagnostics('run-normal');

      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.sourceRunInfo).toBeUndefined();
    });

    it('should classify rerun_with_edits relationship when explicitly tagged', () => {
      const editedRerun = createMockRunState({
        runId: 'run-edited',
        status: 'completed',
        sourceRunId: 'run-original',
        sourceRunRelationship: 'rerun_with_edits',
        steps: {
          step1: {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
        },
      });

      mockStateManager.findRunById.mockReturnValue(editedRerun);

      const diagnostics = diagnosticsService.getRunDiagnostics('run-edited');

      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.sourceRunInfo?.relationship).toBe('rerun_with_edits');
    });

    it('should classify error types correctly', () => {
      const runsWithErrors = [
        createMockRunState({
          runId: 'run-1',
          status: 'failed',
          steps: { step1: { status: 'failed', error: 'API key is invalid' } },
        }),
        createMockRunState({
          runId: 'run-2',
          status: 'failed',
          steps: { step1: { status: 'failed', error: 'Rate limit exceeded (429)' } },
        }),
        createMockRunState({
          runId: 'run-3',
          status: 'failed',
          steps: { step1: { status: 'failed', error: 'Request timed out' } },
        }),
      ];

      mockStateManager.listRuns.mockReturnValue(runsWithErrors);

      const summary = diagnosticsService.getWorkflowQualitySummary('wf-456');

      expect(summary).not.toBeNull();
      expect(summary!.failureTypes.length).toBeGreaterThan(0);
      expect(summary!.failureTypes[0].errorType).toBe('AuthenticationError');
      expect(summary!.failureTypes[0].count).toBe(1);
    });
  });

  describe('Run Comparison for Review', () => {
    it('should compare failed run with successful run', () => {
      const failedRun = createMockRunState({
        runId: 'run-failed',
        workflowId: 'wf-1',
        workflowName: 'Workflow A',
        status: 'failed',
        startedAt: 1000,
        completedAt: 4000,
        inputData: { query: 'test', count: 10 },
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
          'step2': {
            status: 'failed',
            startedAt: 2000,
            completedAt: 3000,
            error: 'timeout error',
          },
        },
        workflowSnapshot: {
          workflowId: 'wf-1',
          versionHash: 'v1',
          capturedAt: 1000,
          steps: {
            step1: {
              id: 'step1',
              agent: { id: 'agent-a', name: 'Agent A', model: 'gpt-4', runtimeType: 'llm-direct' },
              systemPrompt: 'Prompt A',
              task: 'Task A',
              dependsOn: [],
              gate: 'auto',
            },
            step2: {
              id: 'step2',
              agent: { id: 'agent-b', name: 'Agent B', model: 'gpt-4', runtimeType: 'llm-direct' },
              systemPrompt: 'Prompt B',
              task: 'Task B',
              dependsOn: ['step1'],
              gate: 'auto',
            },
          },
        },
      });

      const successfulRun = createMockRunState({
        runId: 'run-success',
        workflowId: 'wf-1',
        workflowName: 'Workflow A',
        status: 'completed',
        startedAt: 1000,
        completedAt: 5000,
        inputData: { query: 'test', count: 10 },
        steps: {
          'step1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            outputFile: '/output/step1.json',
          },
          'step2': {
            status: 'completed',
            startedAt: 2000,
            completedAt: 4000,
            outputFile: '/output/step2.json',
          },
        },
        workflowSnapshot: {
          workflowId: 'wf-1',
          versionHash: 'v2',
          capturedAt: 1001,
          steps: {
            step1: {
              id: 'step1',
              agent: { id: 'agent-a', name: 'Agent A', model: 'gpt-4.1', runtimeType: 'llm-direct' },
              systemPrompt: 'Prompt A updated',
              task: 'Task A',
              dependsOn: [],
              gate: 'auto',
            },
            step2: {
              id: 'step2',
              agent: { id: 'agent-b', name: 'Agent B', model: 'gpt-4', runtimeType: 'llm-direct' },
              systemPrompt: 'Prompt B',
              task: 'Task B',
              dependsOn: ['step1'],
              gate: 'auto',
            },
          },
        },
      });

      mockStateManager.findRunById.mockImplementation((runId: string) => {
        if (runId === 'run-failed') return failedRun;
        if (runId === 'run-success') return successfulRun;
        throw new Error(`Run not found: ${runId}`);
      });

      const comparison = compareService.compare('run-failed', 'run-success');

      expect(comparison.runAId).toBe('run-failed');
      expect(comparison.runBId).toBe('run-success');
      expect(comparison.workflowInfo?.isSameWorkflow).toBe(true);
      expect(comparison.statusDiff).toEqual({ runA: 'failed', runB: 'completed' });
      expect(comparison.workflowConfigDiff).toBeDefined();
      expect(comparison.summary.versionDiffSummary?.hasConfigDiff).toBe(true);
      expect(comparison.summary.warnings.length).toBeGreaterThan(0);
      expect(comparison.summary.recommendations).toContain(
        'Run B appears to have fixed the issue from Run A',
      );
    });

    it('should detect critical failure nodes in comparison', () => {
      const failedRun = createMockRunState({
        runId: 'run-failed',
        status: 'failed',
        steps: {
          'step1': {
            status: 'failed',
            startedAt: 1000,
            completedAt: 2000,
            error: 'critical error',
          },
        },
      });

      const anotherFailedRun = createMockRunState({
        runId: 'run-failed-2',
        status: 'failed',
        steps: {
          'step1': {
            status: 'failed',
            startedAt: 1000,
            completedAt: 3000,
            error: 'same critical error',
          },
        },
      });

      mockStateManager.findRunById.mockImplementation((runId: string) => {
        if (runId === 'run-failed') return failedRun;
        if (runId === 'run-failed-2') return anotherFailedRun;
        throw new Error(`Run not found: ${runId}`);
      });

      const comparison = compareService.compare('run-failed', 'run-failed-2');

      expect(comparison.nodeStatusDiff).toBeDefined();
      const step1Diff = comparison.nodeStatusDiff?.find((d) => d.nodeId === 'step1');
      expect(step1Diff?.isCritical).toBe(true);
      expect(comparison.summary.warnings).toContain(
        'Both runs failed - consider reviewing the workflow configuration',
      );
    });
  });

  describe('Trend Statistics', () => {
    it('should compute quality trends across multiple runs', () => {
      const runs = [
        createMockRunState({ runId: 'run-1', status: 'completed', startedAt: 1000, completedAt: 2000 }),
        createMockRunState({ runId: 'run-2', status: 'completed', startedAt: 2000, completedAt: 3000 }),
        createMockRunState({ runId: 'run-3', status: 'failed', startedAt: 3000, completedAt: 3500, steps: { step1: { status: 'failed', error: 'error' } } }),
        createMockRunState({ runId: 'run-4', status: 'completed', startedAt: 4000, completedAt: 5000 }),
        createMockRunState({ runId: 'run-5', status: 'running', startedAt: 5000 }),
      ];

      mockStateManager.listRuns.mockReturnValue(runs);

      const summary = diagnosticsService.getWorkflowQualitySummary('wf-456');

      expect(summary).not.toBeNull();
      expect(summary!.totalRuns).toBe(5);
      expect(summary!.successCount).toBe(3);
      expect(summary!.failureCount).toBe(1);
      expect(summary!.activeCount).toBe(1);
      expect(summary!.successRate).toBe(60);
      expect(summary!.failureRate).toBe(20);
      expect(summary!.avgDurationMs).toBe(1000); // Average of 3 completed runs: (1000 + 1000 + 1000) / 3
    });

    it('should identify failure type distribution', () => {
      const runs = [
        createMockRunState({
          runId: 'run-1',
          status: 'failed',
          steps: { step1: { status: 'failed', error: 'API key is invalid' } },
        }),
        createMockRunState({
          runId: 'run-2',
          status: 'failed',
          steps: { step1: { status: 'failed', error: 'API key is invalid' } },
        }),
        createMockRunState({
          runId: 'run-3',
          status: 'failed',
          steps: { step1: { status: 'failed', error: 'timeout error' } },
        }),
      ];

      mockStateManager.listRuns.mockReturnValue(runs);

      const summary = diagnosticsService.getWorkflowQualitySummary('wf-456');

      expect(summary).not.toBeNull();
      expect(summary!.failureTypes.length).toBe(2);
      expect(summary!.failureTypes[0].errorType).toBe('AuthenticationError');
      expect(summary!.failureTypes[0].count).toBe(2);
      expect(summary!.failureTypes[1].errorType).toBe('TimeoutError');
      expect(summary!.failureTypes[1].count).toBe(1);
    });

    it('should compute gate wait statistics', () => {
      const runs = [
        createMockRunState({
          runId: 'run-1',
          status: 'running',
          steps: { 'gate-step': { status: 'gate_waiting', startedAt: 3000 } },
        }),
        createMockRunState({
          runId: 'run-2',
          status: 'completed',
          steps: {},
        }),
      ];

      mockStateManager.listRuns.mockReturnValue(runs);

      const summary = diagnosticsService.getWorkflowQualitySummary('wf-456');

      expect(summary).not.toBeNull();
      expect(summary!.gateWaitStats.totalGateWaits).toBe(1);
      expect(summary!.gateWaitStats.runsWithGateWait).toBe(1);
      expect(summary!.gateWaitStats.lastGateWaitAt).toBe(3000);
    });
  });

  describe('Failed Runs Summary', () => {
    it('should list all failed runs sorted by time', () => {
      const runs = [
        createMockRunState({
          runId: 'run-old',
          workflowId: 'wf-1',
          status: 'failed',
          completedAt: 1000,
          steps: { step1: { status: 'failed', error: 'old error' } },
        }),
        createMockRunState({
          runId: 'run-new',
          workflowId: 'wf-1',
          status: 'failed',
          completedAt: 5000,
          steps: { step1: { status: 'failed', error: 'new error' } },
        }),
        createMockRunState({
          runId: 'run-success',
          workflowId: 'wf-1',
          status: 'completed',
          completedAt: 3000,
        }),
      ];

      mockStateManager.listRuns.mockReturnValue(runs);

      const failedRuns = diagnosticsService.getFailedRunsSummary();

      expect(failedRuns).toHaveLength(2);
      expect(failedRuns[0].runId).toBe('run-new'); // Most recent first
      expect(failedRuns[1].runId).toBe('run-old');
    });

    it('should extract error information from failed runs', () => {
      const runs = [
        createMockRunState({
          runId: 'run-1',
          workflowId: 'wf-1',
          status: 'failed',
          completedAt: 5000,
          steps: { step1: { status: 'failed', error: 'API key is invalid' } },
        }),
      ];

      mockStateManager.listRuns.mockReturnValue(runs);

      const failedRuns = diagnosticsService.getFailedRunsSummary();

      expect(failedRuns[0].errorType).toBe('AuthenticationError');
      expect(failedRuns[0].errorMessage).toBe('API key is invalid');
    });
  });
});
