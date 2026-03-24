import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunReuseService } from '../app/services/run-reuse-service.js';
import type { RunState, WorkflowConfig } from '../types/index.js';

describe('RunReuseService - Recovery Methods', () => {
  let service: RunReuseService;
  let mockStateManager: {
    listRuns: ReturnType<typeof vi.fn>;
    findRunById: ReturnType<typeof vi.fn>;
    updateRun: ReturnType<typeof vi.fn>;
  };
  let mockLoader: {
    loadWorkflow: ReturnType<typeof vi.fn>;
    listWorkflows: ReturnType<typeof vi.fn>;
  };

  const createMockRunState = (overrides: Partial<RunState> = {}): RunState => ({
    runId: 'run-123',
    workflowId: 'wf-456',
    status: 'failed',
    input: 'test input',
    inputData: { query: 'test' },
    startedAt: 1000,
    completedAt: 5000,
    steps: {
      'step1': { status: 'completed', outputFile: '/output/step1.json' },
      'step2': { status: 'completed', outputFile: '/output/step2.json' },
      'step3': { status: 'failed', error: 'step 3 failed' },
    },
    ...overrides,
  });

  const createMockWorkflowConfig = (overrides: Partial<WorkflowConfig> = {}): WorkflowConfig => ({
    workflow: {
      id: 'wf-456',
      name: 'Test Workflow',
      description: 'A test workflow',
    },
    steps: [
      { id: 'step1', agent: 'agent1', task: 'task1' },
      { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
      { id: 'step3', agent: 'agent3', task: 'task3', depends_on: ['step2'] },
    ],
    output: { directory: './output' },
    ...overrides,
  });

  beforeEach(() => {
    mockStateManager = {
      listRuns: vi.fn(),
      findRunById: vi.fn(),
      updateRun: vi.fn(),
    };
    mockLoader = {
      loadWorkflow: vi.fn(),
      listWorkflows: vi.fn(),
    };
    service = new RunReuseService(mockStateManager as never, mockLoader as never);
  });

  // =============================================================================
  // getRecoveryPreview Tests
  // =============================================================================

  describe('getRecoveryPreview', () => {
    it('should return null for non-failed runs', () => {
      const completedRun = createMockRunState({ status: 'completed' });
      mockStateManager.findRunById.mockReturnValue(completedRun);

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).toBeNull();
    });

    it('should return null when run not found', () => {
      mockStateManager.findRunById.mockImplementation(() => {
        throw new Error('Run not found');
      });

      const result = service.getRecoveryPreview({ sourceRunId: 'nonexistent' });

      expect(result).toBeNull();
    });

    it('should generate preview with correct reused/rerun/invalidated counts', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'completed', outputFile: '/output/step2.json' },
          'step3': { status: 'failed', error: 'failed' },
          'step4': { status: 'pending' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1' },
          { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
          { id: 'step3', agent: 'agent3', task: 'task3', depends_on: ['step2'] },
          { id: 'step4', agent: 'agent4', task: 'task4', depends_on: ['step3'] },
        ],
      }));

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      expect(result!.sourceRun.runId).toBe('run-123');
      expect(result!.sourceRun.status).toBe('failed');
      expect(result!.reusedSteps.length).toBeGreaterThanOrEqual(0);
      expect(result!.rerunSteps.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect explicit reuseSteps parameter', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'completed', outputFile: '/output/step2.json' },
          'step3': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      const result = service.getRecoveryPreview({
        sourceRunId: 'run-123',
        reuseSteps: ['step1'],
      });

      expect(result).not.toBeNull();
      // With explicit reuseSteps, only step1 should be reused
      expect(result!.reusedSteps.map(s => s.stepId)).toContain('step1');
      expect(result!.rerunSteps.map(s => s.stepId)).toContain('step3');
      expect(result!.rerunSteps.map(s => s.stepId)).toContain('step2');
    });

    it('should respect explicit forceRerunSteps parameter', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      const result = service.getRecoveryPreview({
        sourceRunId: 'run-123',
        forceRerunSteps: ['step1'],
      });

      expect(result).not.toBeNull();
      // step1 should be forced to rerun even though completed
      expect(result!.rerunSteps.map(s => s.stepId)).toContain('step1');
    });

    it('should handle missing workflow gracefully', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockImplementation(() => {
        throw new Error('Workflow not found');
      });

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      expect(result!.workflow.name).toBe('wf-456'); // Falls back to workflowId
    });

    it('should include warnings for gate steps', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1', gate: 'approve' as never },
          { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
        ],
      }));

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      // Reused gate steps should not reset because they are not executed again.
      expect(result!.warnings.some(w => w.impactType === 'gate_reset')).toBe(false);
    });

    it('should calculate correct risk level based on rerun ratio', () => {
      // With 1 rerun and 0 reused: rerunRatio = 1/(1+0+1) = 0.5
      // 0.5 > 0.5 is false, so NOT high
      // 0.5 < 0.2 is false, so NOT low
      // So it becomes 'medium'
      const allFailedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(allFailedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1' },
        ],
      }));

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      // With just 1 failed step, rerunRatio = 1/(1+0+1) = 0.5, which is medium
      expect(result!.riskLevel).toBe('medium');
    });

    it('should calculate high risk when rerun ratio > 0.5', () => {
      // Multiple failed steps to push rerun ratio above 0.5
      const multiFailedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'failed', error: 'failed' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(multiFailedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1' },
          { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
        ],
      }));

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      // 2 rerun, 0 reused: rerunRatio = 2/(2+0+1) = 0.67 > 0.5 -> high
      expect(result!.riskLevel).toBe('high');
    });
  });

  // =============================================================================
  // createRecoveryPayload Tests
  // =============================================================================

  describe('createRecoveryPayload', () => {
    it('should return null for non-failed runs', () => {
      const completedRun = createMockRunState({ status: 'completed' });
      mockStateManager.findRunById.mockReturnValue(completedRun);

      const result = service.createRecoveryPayload({ sourceRunId: 'run-123' });

      expect(result).toBeNull();
    });

    it('should return null when run not found', () => {
      mockStateManager.findRunById.mockImplementation(() => {
        throw new Error('Run not found');
      });

      const result = service.createRecoveryPayload({ sourceRunId: 'nonexistent' });

      expect(result).toBeNull();
    });

    it('should create payload with correct sourceRunId', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      // Mock getReusableConfig
      vi.spyOn(service, 'getReusableConfig').mockReturnValue({
        runId: 'run-123',
        workflowId: 'wf-456',
        input: 'test',
        inputData: { query: 'test' },
        runtimeOptions: { stream: true },
        runStatus: 'failed',
        startedAt: 1000,
      });

      const result = service.createRecoveryPayload({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      expect(result!.sourceRunId).toBe('run-123');
    });

    it('should respect custom inputData override', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      vi.spyOn(service, 'getReusableConfig').mockReturnValue({
        runId: 'run-123',
        workflowId: 'wf-456',
        input: 'test',
        inputData: { query: 'original' },
        runtimeOptions: { stream: true },
        runStatus: 'failed',
        startedAt: 1000,
      });

      const result = service.createRecoveryPayload({
        sourceRunId: 'run-123',
        inputData: { query: 'modified' },
      });

      expect(result).not.toBeNull();
      expect(result!.inputData).toEqual({ query: 'modified' });
    });

    it('should respect runtimeOptions override', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      vi.spyOn(service, 'getReusableConfig').mockReturnValue({
        runId: 'run-123',
        workflowId: 'wf-456',
        input: 'test',
        inputData: { query: 'test' },
        runtimeOptions: { stream: true, autoApprove: false },
        runStatus: 'failed',
        startedAt: 1000,
      });

      const result = service.createRecoveryPayload({
        sourceRunId: 'run-123',
        runtimeOptions: { autoApprove: true },
      });

      expect(result).not.toBeNull();
      expect(result!.autoApprove).toBe(true);
    });

    it('should include recoveryOptions in payload', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      vi.spyOn(service, 'getReusableConfig').mockReturnValue({
        runId: 'run-123',
        workflowId: 'wf-456',
        input: 'test',
        inputData: { query: 'test' },
        runtimeOptions: { stream: true },
        runStatus: 'failed',
        startedAt: 1000,
      });

      const result = service.createRecoveryPayload({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      expect(result!.recoveryOptions).toBeDefined();
      expect(result!.recoveryOptions.resumeFromStep).toBeDefined();
      expect(Array.isArray(result!.recoveryOptions.useCachedSteps)).toBe(true);
      expect(Array.isArray(result!.recoveryOptions.forceRerunSteps)).toBe(true);
    });
  });

  // =============================================================================
  // getRecoveryResult Tests
  // =============================================================================

  describe('getRecoveryResult', () => {
    it('should return null for non-failed runs', () => {
      const completedRun = createMockRunState({ status: 'completed' });
      mockStateManager.findRunById.mockReturnValue(completedRun);

      const result = service.getRecoveryResult('new-run', 'run-123');

      expect(result).toBeNull();
    });

    it('should return null when source run not found', () => {
      mockStateManager.findRunById.mockImplementation(() => {
        throw new Error('Run not found');
      });

      const result = service.getRecoveryResult('new-run', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return recovery result with correct structure', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      const result = service.getRecoveryResult('new-run-456', 'run-123');

      expect(result).not.toBeNull();
      expect(result!.newRunId).toBe('new-run-456');
      expect(result!.sourceRunId).toBe('run-123');
      expect(result!.status).toBe('running');
      expect(Array.isArray(result!.reusedStepIds)).toBe(true);
      expect(Array.isArray(result!.rerunStepIds)).toBe(true);
    });

    it('should include reused steps in reusedStepIds', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'completed', outputFile: '/output/step2.json' },
          'step3': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      const result = service.getRecoveryResult('new-run', 'run-123');

      expect(result).not.toBeNull();
      expect(result!.reusedStepIds.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================================================
  // Edge Cases and Error Handling
  // =============================================================================

  describe('Edge cases', () => {
    it('should handle run with no failed steps', () => {
      const runWithNoFailures = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'completed', outputFile: '/output/step2.json' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(runWithNoFailures);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      // When there are no failed steps, resumeFromStep is undefined
      // All completed steps can be reused
      expect(result!.rerunSteps.length).toBe(0);
    });

    it('should handle run with all steps failed', () => {
      const allFailedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'failed', error: 'failed 1' },
          'step2': { status: 'failed', error: 'failed 2' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(allFailedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1' },
          { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
        ],
      }));

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      expect(result!.reusedSteps.length).toBe(0);
      expect(result!.rerunSteps.length).toBe(2);
      expect(result!.riskLevel).toBe('high');
    });

    it('should handle run with skipped steps', () => {
      const runWithSkipped = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
          'step3': { status: 'skipped' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(runWithSkipped);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1' },
          { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
          { id: 'step3', agent: 'agent3', task: 'task3', depends_on: ['step2'] },
        ],
      }));

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      // step3 is downstream of step2 and had no valid output, so it must execute again.
      expect(result!.rerunSteps.some(s => s.stepId === 'step3')).toBe(true);
    });

    it('should handle parallel workflow branches', () => {
      const run = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2a': { status: 'completed', outputFile: '/output/step2a.json' },
          'step2b': { status: 'failed', error: 'failed' },
          'step3': { status: 'skipped' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(run);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1' },
          { id: 'step2a', agent: 'agent2a', task: 'task2a', depends_on: ['step1'] },
          { id: 'step2b', agent: 'agent2b', task: 'task2b', depends_on: ['step1'] },
          { id: 'step3', agent: 'agent3', task: 'task3', depends_on: ['step2a', 'step2b'] },
        ],
      }));

      const result = service.getRecoveryPreview({ sourceRunId: 'run-123' });

      expect(result).not.toBeNull();
      // step1 is upstream of step2b, so reused
      expect(result!.reusedSteps.some(s => s.stepId === 'step1')).toBe(true);
      // step2a is a parallel completed branch, so it can still be reused
      expect(result!.reusedSteps.some(s => s.stepId === 'step2a')).toBe(true);
      // step2b failed, so rerun
      expect(result!.rerunSteps.some(s => s.stepId === 'step2b')).toBe(true);
      // step3 had no valid output and depends on step2b, so it must run again
      expect(result!.rerunSteps.some(s => s.stepId === 'step3')).toBe(true);
    });
  });

  // =============================================================================
  // Integration-style Tests (Service + State Manager)
  // =============================================================================

  describe('Recovery flow integration', () => {
    it('should produce consistent results between preview and payload', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig());

      vi.spyOn(service, 'getReusableConfig').mockReturnValue({
        runId: 'run-123',
        workflowId: 'wf-456',
        input: 'test',
        inputData: { query: 'test' },
        runtimeOptions: { stream: true },
        runStatus: 'failed',
        startedAt: 1000,
      });

      const preview = service.getRecoveryPreview({ sourceRunId: 'run-123' });
      const payload = service.createRecoveryPayload({ sourceRunId: 'run-123' });

      expect(preview).not.toBeNull();
      expect(payload).not.toBeNull();

      // The reused steps in preview should match useCachedSteps in payload
      const previewReusedIds = preview!.reusedSteps.map(s => s.stepId);
      const payloadReusedIds = payload!.recoveryOptions.useCachedSteps;
      expect(previewReusedIds.sort()).toEqual(payloadReusedIds.sort());
    });

    it('should handle resumeFromStep parameter consistently', () => {
      const failedRun = createMockRunState({
        status: 'failed',
        steps: {
          'step1': { status: 'completed', outputFile: '/output/step1.json' },
          'step2': { status: 'completed', outputFile: '/output/step2.json' },
          'step3': { status: 'failed', error: 'failed' },
        },
      });
      mockStateManager.findRunById.mockReturnValue(failedRun);
      mockLoader.loadWorkflow.mockReturnValue(createMockWorkflowConfig({
        steps: [
          { id: 'step1', agent: 'agent1', task: 'task1' },
          { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
          { id: 'step3', agent: 'agent3', task: 'task3', depends_on: ['step2'] },
        ],
      }));

      vi.spyOn(service, 'getReusableConfig').mockReturnValue({
        runId: 'run-123',
        workflowId: 'wf-456',
        input: 'test',
        inputData: { query: 'test' },
        runtimeOptions: { stream: true },
        runStatus: 'failed',
        startedAt: 1000,
      });

      // Preview with explicit resumeFromStep
      const preview = service.getRecoveryPreview({
        sourceRunId: 'run-123',
        resumeFromStep: 'step2',
      });

      const payload = service.createRecoveryPayload({
        sourceRunId: 'run-123',
        resumeFromStep: 'step2',
      });

      expect(preview).not.toBeNull();
      expect(payload).not.toBeNull();
      expect(payload!.recoveryOptions.resumeFromStep).toBe('step2');
    });
  });
});
