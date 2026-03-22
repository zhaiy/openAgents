import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunVisualService } from '../app/services/run-visual-service.js';
import type { RunState } from '../types/index.js';

describe('RunVisualService', () => {
  let service: RunVisualService;
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
    service = new RunVisualService(mockStateManager as never);
  });

  describe('getVisualState', () => {
    it('should return visual state with correct run info', () => {
      const mockRun = createMockRunState({
        runId: 'run-abc',
        workflowId: 'wf-xyz',
        startedAt: 1000,
        completedAt: 3000,
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-abc');

      expect(result.runId).toBe('run-abc');
      expect(result.workflowId).toBe('wf-xyz');
      expect(result.status).toBe('completed');
      expect(result.durationMs).toBe(2000);
    });

    it('should map step statuses correctly', () => {
      const mockRun = createMockRunState({
        steps: {
          'step-1': { status: 'running', startedAt: 1000 },
          'step-2': { status: 'completed', startedAt: 1000, completedAt: 2000 },
          'step-3': { status: 'failed', startedAt: 1000, completedAt: 2000, error: 'oops' },
          'step-4': { status: 'gate_waiting', startedAt: 1000 },
          'step-5': { status: 'skipped', startedAt: 1000, completedAt: 2000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.nodeStates['step-1'].status).toBe('running');
      expect(result.nodeStates['step-2'].status).toBe('completed');
      expect(result.nodeStates['step-3'].status).toBe('failed');
      expect(result.nodeStates['step-3'].errorMessage).toBe('oops');
      expect(result.nodeStates['step-4'].status).toBe('gate_waiting');
      expect(result.nodeStates['step-5'].status).toBe('skipped');
    });

    it('should categorize active nodes correctly', () => {
      const mockRun = createMockRunState({
        steps: {
          'running-step': { status: 'running', startedAt: 1000 },
          'streaming-step': { status: 'streaming', startedAt: 1000 },
          'completed-step': { status: 'completed', startedAt: 1000, completedAt: 2000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.currentActiveNodeIds).toContain('running-step');
      expect(result.currentActiveNodeIds).toContain('streaming-step');
      expect(result.currentActiveNodeIds).not.toContain('completed-step');
    });

    it('should categorize gate waiting nodes correctly', () => {
      const mockRun = createMockRunState({
        steps: {
          'gate-step': { status: 'gate_waiting', startedAt: 1000 },
          'normal-step': { status: 'completed', startedAt: 1000, completedAt: 2000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.gateWaitingNodeIds).toContain('gate-step');
      expect(result.gateWaitingNodeIds).not.toContain('normal-step');
    });

    it('should categorize failed nodes correctly', () => {
      const mockRun = createMockRunState({
        steps: {
          'failed-step': { status: 'failed', startedAt: 1000, completedAt: 2000 },
          'ok-step': { status: 'completed', startedAt: 1000, completedAt: 2000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.failedNodeIds).toContain('failed-step');
      expect(result.failedNodeIds).not.toContain('ok-step');
    });

    it('should calculate total token usage', () => {
      const mockRun = createMockRunState({
        steps: {
          'step-1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            tokenUsage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          },
          'step-2': {
            status: 'completed',
            startedAt: 2000,
            completedAt: 3000,
            tokenUsage: { promptTokens: 50, completionTokens: 150, totalTokens: 200 },
          },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.tokenUsage).toEqual({
        promptTokens: 150,
        completionTokens: 350,
        totalTokens: 500,
      });
    });

    it('should return undefined token usage when no steps have usage', () => {
      const mockRun = createMockRunState({
        steps: {
          'step-1': { status: 'completed', startedAt: 1000, completedAt: 2000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.tokenUsage).toBeUndefined();
    });

    it('should handle unknown step status as pending', () => {
      const mockRun = createMockRunState({
        steps: {
          'unknown-step': { status: 'unknown_status' as never, startedAt: 1000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.nodeStates['unknown-step'].status).toBe('pending');
    });

    it('should set version to 1', () => {
      const mockRun = createMockRunState();
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.version).toBe(1);
    });

    it('should set lastEventId with runId and startedAt', () => {
      const mockRun = createMockRunState({ startedAt: 9999 });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getVisualState('run-123');

      expect(result.lastEventId).toBe('run:run-123:9999');
    });
  });

  describe('getNodeState', () => {
    it('should return node state for existing node', () => {
      const mockRun = createMockRunState({
        steps: {
          'step-1': {
            status: 'completed',
            startedAt: 1000,
            completedAt: 2000,
            durationMs: 1000,
            tokenUsage: { totalTokens: 100 },
          },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getNodeState('run-123', 'step-1');

      expect(result).toEqual({
        nodeId: 'step-1',
        status: 'completed',
        inputPreview: '{\n  "query": "test"\n}',
        startedAt: 1000,
        completedAt: 2000,
        durationMs: 1000,
        errorMessage: undefined,
        tokenUsage: { totalTokens: 100 },
        retryCount: undefined,
      });
    });

    it('should return null for non-existent node', () => {
      const mockRun = createMockRunState({ steps: {} });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getNodeState('run-123', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTimeline', () => {
    it('should return timeline with workflow started entry', () => {
      const mockRun = createMockRunState({ startedAt: 1000 });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getTimeline('run-123');

      expect(result).toContainEqual({
        id: 'workflow.started:run-123',
        event: 'Workflow started',
        timestamp: 1000,
        status: 'info',
      });
    });

    it('should include step started and completed entries', () => {
      const mockRun = createMockRunState({
        startedAt: 1000,
        completedAt: 5000,
        steps: {
          'step-1': { status: 'completed', startedAt: 1000, completedAt: 2000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getTimeline('run-123');

      expect(result.some(e => e.event === 'Step started' && e.stepId === 'step-1')).toBe(true);
      expect(result.some(e => e.event === 'Step completed' && e.stepId === 'step-1')).toBe(true);
    });

    it('should mark failed steps with error status', () => {
      const mockRun = createMockRunState({
        startedAt: 1000,
        completedAt: 5000,
        status: 'failed',
        steps: {
          'step-1': { status: 'failed', startedAt: 1000, completedAt: 2000, error: 'something went wrong' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getTimeline('run-123');
      const failedEntry = result.find(e => e.stepId === 'step-1' && e.status === 'error');

      expect(failedEntry).toBeDefined();
      expect(failedEntry?.details).toBe('something went wrong');
    });

    it('should mark workflow completed with success status', () => {
      const mockRun = createMockRunState({
        startedAt: 1000,
        completedAt: 5000,
        status: 'completed',
        steps: {},
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getTimeline('run-123');
      const completedEntry = result.find(e => e.event === 'Workflow completed');

      expect(completedEntry).toBeDefined();
      expect(completedEntry?.status).toBe('success');
    });

    it('should mark workflow failed with error status', () => {
      const mockRun = createMockRunState({
        startedAt: 1000,
        completedAt: 5000,
        status: 'failed',
        steps: {},
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getTimeline('run-123');
      const failedEntry = result.find(e => e.event === 'Workflow failed');

      expect(failedEntry).toBeDefined();
      expect(failedEntry?.status).toBe('error');
    });

    it('should sort timeline by timestamp ascending', () => {
      const mockRun = createMockRunState({
        startedAt: 1000,
        completedAt: 6000,
        steps: {
          'step-1': { status: 'completed', startedAt: 2000, completedAt: 3000 },
          'step-2': { status: 'completed', startedAt: 4000, completedAt: 5000 },
        },
      });
      mockStateManager.findRunById.mockReturnValue(mockRun);

      const result = service.getTimeline('run-123');
      const timestamps = result.map(e => e.timestamp);

      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });
});
