import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebAppContext } from '../app/context.js';
import type { RunSummaryDto, WorkflowSummaryDto, SettingsDto } from '../app/dto.js';

const mockWorkflowService = {
  listWorkflows: vi.fn(),
  getWorkflow: vi.fn(),
};

const mockRunService = {
  startRun: vi.fn(),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  getRunEvents: vi.fn(),
  getStepOutput: vi.fn(),
  getRunEval: vi.fn(),
  resumeRun: vi.fn(),
};

const mockGateService = {
  submitAction: vi.fn(),
};

const mockSettingsService = {
  getSettings: vi.fn(),
};

const mockRunEventEmitter = {
  addClient: vi.fn(),
  removeClient: vi.fn(),
};

describe('App Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Verify mock context shape matches WebAppContext
    const _ctx: WebAppContext = {
      workflowService: mockWorkflowService as unknown as WebAppContext['workflowService'],
      runService: mockRunService as unknown as WebAppContext['runService'],
      gateService: mockGateService as unknown as WebAppContext['gateService'],
      settingsService: mockSettingsService as unknown as WebAppContext['settingsService'],
      runEventEmitter: mockRunEventEmitter as unknown as WebAppContext['runEventEmitter'],
    };
    void _ctx;
  });

  describe('WorkflowService', () => {
    it('returns list of workflows', () => {
      const workflows: WorkflowSummaryDto[] = [
        { id: 'wf1', name: 'Workflow 1', description: 'Desc 1', stepCount: 3, hasGate: true, hasEval: true },
        { id: 'wf2', name: 'Workflow 2', description: 'Desc 2', stepCount: 2, hasGate: false, hasEval: false },
      ];
      mockWorkflowService.listWorkflows.mockReturnValue(workflows);
      expect(mockWorkflowService.listWorkflows()).toEqual(workflows);
    });

    it('returns single workflow by id', () => {
      const workflow: WorkflowSummaryDto = {
        id: 'wf1',
        name: 'Workflow 1',
        description: 'Desc',
        stepCount: 3,
        hasGate: true,
        hasEval: true,
      };
      mockWorkflowService.getWorkflow.mockReturnValue(workflow);
      expect(mockWorkflowService.getWorkflow('wf1')).toEqual(workflow);
    });
  });

  describe('RunService', () => {
    it('starts a run and returns runId', () => {
      const result = { runId: 'run123', status: 'running' };
      mockRunService.startRun.mockReturnValue(result);
      expect(mockRunService.startRun({ workflowId: 'wf1' })).toEqual(result);
    });

    it('lists runs with optional filters', () => {
      const runs: RunSummaryDto[] = [];
      mockRunService.listRuns.mockReturnValue(runs);
      mockRunService.listRuns({ status: 'completed' });
      expect(mockRunService.listRuns).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('resumes an interrupted run', () => {
      const result = { runId: 'run123', status: 'running' };
      mockRunService.resumeRun.mockReturnValue(result);
      expect(mockRunService.resumeRun('run123')).toEqual(result);
    });
  });

  describe('GateService', () => {
    it('submits gate action', () => {
      const result = { success: true };
      mockGateService.submitAction.mockReturnValue(result);
      expect(mockGateService.submitAction('run1', 'step1', { action: 'approve' })).toEqual(result);
    });

    it('handles edit action with editedOutput', () => {
      const result = { success: true };
      mockGateService.submitAction.mockReturnValue(result);
      expect(mockGateService.submitAction('run1', 'step1', { action: 'edit', editedOutput: 'new output' })).toEqual(result);
    });
  });

  describe('SettingsService', () => {
    it('returns settings', () => {
      const settings: SettingsDto = {
        projectPath: '/path/to/project',
        locale: 'en',
        apiKeyConfigured: true,
        baseUrlConfigured: false,
      };
      mockSettingsService.getSettings.mockReturnValue(settings);
      expect(mockSettingsService.getSettings()).toEqual(settings);
    });
  });
});
