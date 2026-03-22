import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticsService } from '../app/services/diagnostics-service.js';
import type { RunState } from '../types/index.js';

describe('DiagnosticsService', () => {
  let service: DiagnosticsService;
  let mockStateManager: {
    listRuns: ReturnType<typeof vi.fn>;
    findRunById: ReturnType<typeof vi.fn>;
  };

  const createMockRunState = (overrides: Partial<RunState> = {}): RunState => ({
    runId: 'run-123',
    workflowId: 'wf-456',
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
    service = new DiagnosticsService(mockStateManager as never);
  });

  describe('getFailedRunsSummary', () => {
    it('should return all failed runs', () => {
      const failedRun = createMockRunState({
        runId: 'run-failed',
        status: 'failed',
        completedAt: 5000,
        steps: {
          'step-1': { status: 'failed', error: 'something went wrong' },
        },
      });

      mockStateManager.listRuns.mockReturnValue([failedRun]);

      const result = service.getFailedRunsSummary();

      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('run-failed');
      expect(result[0].failedAt).toBe(5000);
      expect(result[0].errorMessage).toBe('something went wrong');
      expect(result[0].failedNodeId).toBe('step-1');
    });

    it('should return empty array when no failed runs', () => {
      const completedRun = createMockRunState({ status: 'completed' });
      mockStateManager.listRuns.mockReturnValue([completedRun]);

      const result = service.getFailedRunsSummary();

      expect(result).toHaveLength(0);
    });

    it('should filter out non-failed statuses', () => {
      const runs = [
        createMockRunState({ runId: 'run-1', status: 'completed' }),
        createMockRunState({ runId: 'run-2', status: 'failed' }),
        createMockRunState({ runId: 'run-3', status: 'running' }),
      ];
      mockStateManager.listRuns.mockReturnValue(runs);

      const result = service.getFailedRunsSummary();

      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('run-2');
    });

    it('should identify failed node with error', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'node-a': { status: 'completed' },
          'node-b': { status: 'failed', error: 'critical error' },
          'node-c': { status: 'skipped' },
        },
      });
      mockStateManager.listRuns.mockReturnValue([failedRun]);

      const result = service.getFailedRunsSummary();

      expect(result[0].failedNodeId).toBe('node-b');
      expect(result[0].errorMessage).toBe('critical error');
    });
  });

  describe('getWaitingGatesSummary', () => {
    it('should return all runs with gate_waiting nodes', () => {
      const waitingRun = createMockRunState({
        status: 'running',
        steps: {
          'gate-step': { status: 'gate_waiting', startedAt: 3000 },
        },
      });
      mockStateManager.listRuns.mockReturnValue([waitingRun]);

      const result = service.getWaitingGatesSummary();

      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('run-123');
      expect(result[0].stepId).toBe('gate-step');
      expect(result[0].waitedAt).toBe(3000);
    });

    it('should return empty array when no waiting gates', () => {
      const completedRun = createMockRunState({
        status: 'completed',
        steps: {
          'normal-step': { status: 'completed' },
        },
      });
      mockStateManager.listRuns.mockReturnValue([completedRun]);

      const result = service.getWaitingGatesSummary();

      expect(result).toHaveLength(0);
    });

    it('should filter to only running status runs', () => {
      const runs = [
        createMockRunState({ runId: 'run-1', status: 'completed', steps: { 'step-1': { status: 'gate_waiting' } } }),
        createMockRunState({ runId: 'run-2', status: 'failed', steps: { 'step-1': { status: 'gate_waiting' } } }),
        createMockRunState({ runId: 'run-3', status: 'running', steps: { 'step-1': { status: 'gate_waiting' } } }),
      ];
      mockStateManager.listRuns.mockReturnValue(runs);

      const result = service.getWaitingGatesSummary();

      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('run-3');
    });

    it('should identify multiple waiting gates', () => {
      const runWithTwoGates = createMockRunState({
        status: 'running',
        steps: {
          'gate-1': { status: 'gate_waiting', startedAt: 1000 },
          'gate-2': { status: 'gate_waiting', startedAt: 2000 },
          'normal-step': { status: 'completed' },
        },
      });
      mockStateManager.listRuns.mockReturnValue([runWithTwoGates]);

      const result = service.getWaitingGatesSummary();

      expect(result).toHaveLength(2);
      expect(result.map(r => r.stepId)).toContain('gate-1');
      expect(result.map(r => r.stepId)).toContain('gate-2');
    });
  });

  describe('getRunDiagnostics', () => {
    it('should return diagnostics for a failed run', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        completedAt: 5000,
        steps: {
          'step-1': { status: 'completed', startedAt: 1000, completedAt: 2000 },
          'step-2': { status: 'failed', startedAt: 2000, completedAt: 3000, error: 'step 2 failed' },
          'step-3': { status: 'skipped', startedAt: 3000, completedAt: 4000 },
        },
      });

      mockStateManager.findRunById.mockReturnValue(failedRun);

      const result = service.getRunDiagnostics('run-123');

      expect(result).not.toBeNull();
      expect(result!.runId).toBe('run-123');
      expect(result!.failedNodeIds).toContain('step-2');
      expect(result!.errorSummary).toHaveLength(1);
      expect(result!.errorSummary[0].errorMessage).toBe('step 2 failed');
    });

    it('should return null when run not found', () => {
      mockStateManager.findRunById.mockImplementation(() => {
        throw new Error('Run not found');
      });

      const result = service.getRunDiagnostics('non-existent');

      expect(result).toBeNull();
    });

    it('should return diagnostics for completed run with no issues', () => {
      const completedRun = createMockRunState({
        status: 'completed',
        steps: {
          'step-1': { status: 'completed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(completedRun);

      const result = service.getRunDiagnostics('run-123');

      expect(result).not.toBeNull();
      expect(result!.failedNodeIds).toHaveLength(0);
      expect(result!.gateWaitingNodeIds).toHaveLength(0);
    });

    it('should identify gate waiting nodes', () => {
      const waitingRun = createMockRunState({
        status: 'running',
        steps: {
          'gate-step': { status: 'gate_waiting', startedAt: 3000 },
          'other-step': { status: 'running', startedAt: 1000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(waitingRun);

      const result = service.getRunDiagnostics('run-123');

      expect(result).not.toBeNull();
      expect(result!.gateWaitingNodeIds).toContain('gate-step');
    });

    it('should show upstream states for all nodes', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'upstream-1': { status: 'completed' },
          'upstream-2': { status: 'completed' },
          'failed-step': { status: 'failed', error: 'downstream failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);

      const result = service.getRunDiagnostics('run-123');

      expect(result).not.toBeNull();
      expect(result!.upstreamStates['upstream-1']).toBe('completed');
      expect(result!.upstreamStates['upstream-2']).toBe('completed');
      expect(result!.upstreamStates['failed-step']).toBe('failed');
    });

    it('should map error patterns to suggested actions', () => {
      const authErrorRun = createMockRunState({
        status: 'failed',
        steps: {
          'auth-step': { status: 'failed', error: 'API key is invalid' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(authErrorRun);

      const result = service.getRunDiagnostics('run-123');

      expect(result).not.toBeNull();
      expect(result!.errorSummary[0].errorType).toBe('AuthenticationError');
      expect(result!.errorSummary[0].suggestedActions).toContain('Check your API key configuration in Settings');
    });
  });
});
