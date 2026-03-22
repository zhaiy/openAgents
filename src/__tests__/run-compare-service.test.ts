import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunCompareService } from '../app/services/run-compare-service.js';
import type { RunState } from '../types/index.js';

describe('RunCompareService', () => {
  let service: RunCompareService;
  let mockStateManager: {
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
      findRunById: vi.fn(),
    };
    service = new RunCompareService(mockStateManager as never);
  });

  describe('compare', () => {
    it('should compare two runs and return differences', () => {
      const runA = createMockRunState({
        runId: 'run-a',
        workflowId: 'wf-1',
        status: 'completed',
        startedAt: 1000,
        completedAt: 5000,
        inputData: { query: 'test a' },
        steps: {
          'step-1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            durationMs: 1000,
            tokenUsage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          },
          'step-2': {
            status: 'completed',
            startedAt: 2000,
            completedAt: 3000,
            durationMs: 1000,
            tokenUsage: { promptTokens: 150, completionTokens: 250, totalTokens: 400 },
          },
        },
      });

      const runB = createMockRunState({
        runId: 'run-b',
        workflowId: 'wf-1',
        status: 'failed',
        startedAt: 1000,
        completedAt: 4000,
        inputData: { query: 'test b' },
        steps: {
          'step-1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2500,
            durationMs: 1500,
            tokenUsage: { promptTokens: 120, completionTokens: 220, totalTokens: 340 },
          },
          'step-2': {
            status: 'failed',
            startedAt: 2500,
            completedAt: 3500,
            error: 'step failed',
          },
        },
      });

      mockStateManager.findRunById.mockImplementation((runId: string) => {
        if (runId === 'run-a') return runA;
        if (runId === 'run-b') return runB;
        throw new Error(`Run not found: ${runId}`);
      });

      const result = service.compare('run-a', 'run-b');

      expect(result.runAId).toBe('run-a');
      expect(result.runBId).toBe('run-b');
      expect(result.statusDiff).toEqual({ runA: 'completed', runB: 'failed' });
      expect(result.inputDiff).toHaveLength(1);
      expect(result.inputDiff?.[0]).toEqual({
        field: 'query',
        valueA: 'test a',
        valueB: 'test b',
      });
      expect(result.durationDiff).toEqual({ runA: 4000, runB: 3000 });
      expect(result.tokenUsageDiff).toEqual({
        runA: { promptTokens: 250, completionTokens: 450, totalTokens: 700 },
        runB: { promptTokens: 120, completionTokens: 220, totalTokens: 340 },
      });
      expect(result.nodeStatusDiff).toHaveLength(1);
      expect(result.nodeStatusDiff?.[0]).toEqual({
        nodeId: 'step-2',
        statusA: 'completed',
        statusB: 'failed',
      });
    });

    it('should return empty diffs for identical runs', () => {
      const runA = createMockRunState({
        runId: 'run-a',
        status: 'completed',
        inputData: { query: 'same' },
        steps: {
          'step-1': { status: 'completed', startedAt: 1000, completedAt: 2000 },
        },
      });

      const runB = createMockRunState({
        runId: 'run-b',
        status: 'completed',
        inputData: { query: 'same' },
        steps: {
          'step-1': { status: 'completed', startedAt: 1000, completedAt: 2000 },
        },
      });

      mockStateManager.findRunById.mockImplementation((runId: string) => {
        if (runId === 'run-a') return runA;
        if (runId === 'run-b') return runB;
        throw new Error(`Run not found: ${runId}`);
      });

      const result = service.compare('run-a', 'run-b');

      expect(result.inputDiff).toBeUndefined();
      expect(result.statusDiff).toEqual({ runA: 'completed', runB: 'completed' });
      expect(result.durationDiff).toBeUndefined();
    });

    it('should throw error when runA not found', () => {
      mockStateManager.findRunById.mockImplementation(() => {
        throw new Error('Run not found');
      });

      expect(() => service.compare('run-a', 'run-b')).toThrow('Run not found');
    });

    it('should handle runs with no steps', () => {
      const runA = createMockRunState({ runId: 'run-a', steps: {} });
      const runB = createMockRunState({ runId: 'run-b', steps: {} });

      mockStateManager.findRunById.mockImplementation((runId: string) => {
        if (runId === 'run-a') return runA;
        if (runId === 'run-b') return runB;
        throw new Error(`Run not found: ${runId}`);
      });

      const result = service.compare('run-a', 'run-b');

      expect(result.nodeStatusDiff).toBeUndefined();
      expect(result.tokenUsageDiff).toBeUndefined();
    });

    it('should handle partial token usage across steps', () => {
      const runA = createMockRunState({
        steps: {
          'step-1': {
            status: 'completed',
            tokenUsage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          },
          'step-2': {
            status: 'completed',
            // No token usage
          },
        },
      });

      const runB = createMockRunState({
        steps: {
          'step-1': {
            status: 'completed',
            tokenUsage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
          },
        },
      });

      mockStateManager.findRunById.mockImplementation((runId: string) => {
        if (runId === 'run-a') return runA;
        if (runId === 'run-b') return runB;
        throw new Error(`Run not found: ${runId}`);
      });

      const result = service.compare('run-a', 'run-b');

      expect(result.tokenUsageDiff).toEqual({
        runA: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        runB: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      });
    });
  });
});
