import { describe, it, expect, beforeEach, vi } from 'vitest';
import type http from 'node:http';
import { WebRouter } from '../web/routes.js';
import type { WebAppContext } from '../app/context.js';

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

const mockWorkflowVisualService = {
  getVisualSummary: vi.fn(),
};

const mockRunVisualService = {
  getVisualState: vi.fn(),
  getTimeline: vi.fn(),
  getNodeState: vi.fn(),
};

const mockConfigDraftService = {
  listDraftsByWorkflow: vi.fn(),
  createDraft: vi.fn(),
  getDraft: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraft: vi.fn(),
};

const mockRunCompareService = {
  compare: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
};

const mockDiagnosticsService = {
  getFailedRunsSummary: vi.fn(),
  getWaitingGatesSummary: vi.fn(),
  getRunDiagnostics: vi.fn(),
};

const mockRunReuseService = {
  getReusableConfig: vi.fn(),
  createRerunPayload: vi.fn(),
  createEditedRerunPayload: vi.fn(),
};

const mockRunEventEmitter = {
  addClient: vi.fn(),
  removeClient: vi.fn(),
  getCurrentSequence: vi.fn(),
};

const mockContext = {
  workflowService: mockWorkflowService,
  runService: mockRunService,
  gateService: mockGateService,
  settingsService: mockSettingsService,
  runEventEmitter: mockRunEventEmitter,
  workflowVisualService: mockWorkflowVisualService,
  runVisualService: mockRunVisualService,
  configDraftService: mockConfigDraftService,
  runCompareService: mockRunCompareService,
  diagnosticsService: mockDiagnosticsService,
  runReuseService: mockRunReuseService,
} as unknown as WebAppContext;

function createMockRequest(method: string, url: string): http.IncomingMessage {
  return {
    method,
    url,
    headers: {},
    on: vi.fn(),
  } as unknown as http.IncomingMessage;
}

function createMockResponse(): { res: http.ServerResponse; data: unknown[] } {
  const data: unknown[] = [];
  return {
    res: {
      writeHead: () => { /* noop */ },
      write: (chunk: unknown) => { data.push(chunk); },
      end: (chunk?: unknown) => { if (chunk) data.push(chunk); },
    } as unknown as http.ServerResponse,
    data,
  };
}

describe('WebRouter', () => {
  let router: WebRouter;

  beforeEach(() => {
    router = new WebRouter(mockContext);
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const req = createMockRequest('GET', '/api/health');
      const { res } = createMockResponse();
      const handled = await router.handle(req, res);
      expect(handled).toBe(true);
    });
  });

  describe('GET /api/workflows', () => {
    it('returns workflow list', async () => {
      const workflows = [{ id: 'wf1', name: 'Test', description: 'desc', stepCount: 2, hasGate: false, hasEval: false }];
      mockWorkflowService.listWorkflows.mockReturnValue(workflows);
      const req = createMockRequest('GET', '/api/workflows');
      const { res } = createMockResponse();
      await router.handle(req, res);
      expect(mockWorkflowService.listWorkflows).toHaveBeenCalled();
    });
  });

  describe('POST /api/runs', () => {
    it('starts a run', async () => {
      const result = { runId: 'run1', status: 'running' };
      mockRunService.startRun.mockReturnValue(result);
      const req = createMockRequest('POST', '/api/runs') as http.IncomingMessage & { on: ReturnType<typeof vi.fn> };
      (req as unknown as Record<string, unknown>)[Symbol.asyncIterator as unknown as string] = async function* () {
        yield Buffer.from(JSON.stringify({ workflowId: 'wf1' }));
      };
      const { res } = createMockResponse();
      const handled = await router.handle(req, res);
      expect(handled).toBe(true);
    });
  });

  describe('GET /api/runs', () => {
    it('returns runs list', async () => {
      mockRunService.listRuns.mockReturnValue([]);
      const req = createMockRequest('GET', '/api/runs');
      const { res } = createMockResponse();
      await router.handle(req, res);
      expect(mockRunService.listRuns).toHaveBeenCalledWith({});
    });

    it('passes filters to listRuns', async () => {
      mockRunService.listRuns.mockReturnValue([]);
      const req = createMockRequest('GET', '/api/runs?status=running&workflowId=wf1');
      const { res } = createMockResponse();
      await router.handle(req, res);
      expect(mockRunService.listRuns).toHaveBeenCalledWith({
        status: 'running',
        workflowId: 'wf1',
      });
    });
  });

  describe('GET /api/settings', () => {
    it('returns settings', async () => {
      const settings = { projectPath: '/test', locale: 'en', apiKeyConfigured: true, baseUrlConfigured: false };
      mockSettingsService.getSettings.mockReturnValue(settings);
      const req = createMockRequest('GET', '/api/settings');
      const { res } = createMockResponse();
      await router.handle(req, res);
      expect(mockSettingsService.getSettings).toHaveBeenCalled();
    });
  });

  describe('visual and diagnostics routes', () => {
    it('handles workflow visual summary', async () => {
      mockWorkflowVisualService.getVisualSummary.mockReturnValue({ workflowId: 'wf1', visualNodes: [], visualEdges: [] });
      const req = createMockRequest('GET', '/api/workflows/wf1/visual-summary');
      const { res } = createMockResponse();
      await router.handle(req, res);
      expect(mockWorkflowVisualService.getVisualSummary).toHaveBeenCalledWith('wf1');
    });

    it('handles run visual-state/timeline/node routes', async () => {
      mockRunVisualService.getVisualState.mockReturnValue({ runId: 'run1', nodeStates: {} });
      mockRunVisualService.getTimeline.mockReturnValue([]);
      mockRunVisualService.getNodeState.mockReturnValue({ nodeId: 'step1', status: 'running' });

      await router.handle(createMockRequest('GET', '/api/runs/run1/visual-state'), createMockResponse().res);
      await router.handle(createMockRequest('GET', '/api/runs/run1/timeline'), createMockResponse().res);
      await router.handle(createMockRequest('GET', '/api/runs/run1/node/step1'), createMockResponse().res);
      await router.handle(createMockRequest('GET', '/api/runs/run1/nodes/step1'), createMockResponse().res);

      expect(mockRunVisualService.getVisualState).toHaveBeenCalledWith('run1');
      expect(mockRunVisualService.getTimeline).toHaveBeenCalledWith('run1');
      expect(mockRunVisualService.getNodeState).toHaveBeenCalledWith('run1', 'step1');
    });

    it('handles diagnostics routes', async () => {
      mockDiagnosticsService.getFailedRunsSummary.mockReturnValue([]);
      mockDiagnosticsService.getWaitingGatesSummary.mockReturnValue([]);
      mockDiagnosticsService.getRunDiagnostics.mockReturnValue({ runId: 'run1' });
      await router.handle(createMockRequest('GET', '/api/diagnostics/failed-runs'), createMockResponse().res);
      await router.handle(createMockRequest('GET', '/api/diagnostics/waiting-gates'), createMockResponse().res);
      await router.handle(createMockRequest('GET', '/api/diagnostics/runs/run1'), createMockResponse().res);
      expect(mockDiagnosticsService.getFailedRunsSummary).toHaveBeenCalled();
      expect(mockDiagnosticsService.getWaitingGatesSummary).toHaveBeenCalled();
      expect(mockDiagnosticsService.getRunDiagnostics).toHaveBeenCalledWith('run1');
    });
  });

  describe('draft, compare and rerun routes', () => {
    it('handles config draft CRUD routes', async () => {
      mockConfigDraftService.listDraftsByWorkflow.mockReturnValue([]);
      mockConfigDraftService.createDraft.mockReturnValue({ draftId: 'd1' });
      mockConfigDraftService.getDraft.mockReturnValue({ draftId: 'd1' });
      mockConfigDraftService.updateDraft.mockReturnValue({ draftId: 'd1' });
      mockConfigDraftService.deleteDraft.mockReturnValue(true);

      await router.handle(createMockRequest('GET', '/api/workflows/wf1/drafts'), createMockResponse().res);

      const postReq = createMockRequest('POST', '/api/workflows/wf1/drafts') as http.IncomingMessage;
      (postReq as unknown as Record<symbol, unknown>)[Symbol.asyncIterator] = async function* () {
        yield Buffer.from(JSON.stringify({ name: 'd1', inputData: {} }));
      };
      await router.handle(postReq, createMockResponse().res);

      await router.handle(createMockRequest('GET', '/api/workflows/wf1/drafts/d1'), createMockResponse().res);

      const patchReq = createMockRequest('PATCH', '/api/workflows/wf1/drafts/d1') as http.IncomingMessage;
      (patchReq as unknown as Record<symbol, unknown>)[Symbol.asyncIterator] = async function* () {
        yield Buffer.from(JSON.stringify({ name: 'new' }));
      };
      await router.handle(patchReq, createMockResponse().res);

      await router.handle(createMockRequest('DELETE', '/api/workflows/wf1/drafts/d1'), createMockResponse().res);

      expect(mockConfigDraftService.listDraftsByWorkflow).toHaveBeenCalledWith('wf1');
      expect(mockConfigDraftService.createDraft).toHaveBeenCalled();
      expect(mockConfigDraftService.getDraft).toHaveBeenCalledWith('d1');
      expect(mockConfigDraftService.updateDraft).toHaveBeenCalledWith('d1', { name: 'new' });
      expect(mockConfigDraftService.deleteDraft).toHaveBeenCalledWith('d1');
    });

    it('handles compare session routes', async () => {
      mockRunCompareService.createSession.mockReturnValue({ sessionId: 'c1' });
      mockRunCompareService.getSession.mockReturnValue({ sessionId: 'c1' });
      mockRunCompareService.deleteSession.mockReturnValue(true);

      const postReq = createMockRequest('POST', '/api/compare') as http.IncomingMessage;
      (postReq as unknown as Record<symbol, unknown>)[Symbol.asyncIterator] = async function* () {
        yield Buffer.from(JSON.stringify({ runAId: 'a', runBId: 'b' }));
      };
      await router.handle(postReq, createMockResponse().res);
      await router.handle(createMockRequest('GET', '/api/compare/c1'), createMockResponse().res);
      await router.handle(createMockRequest('DELETE', '/api/compare/c1'), createMockResponse().res);

      expect(mockRunCompareService.createSession).toHaveBeenCalledWith('a', 'b');
      expect(mockRunCompareService.getSession).toHaveBeenCalledWith('c1');
      expect(mockRunCompareService.deleteSession).toHaveBeenCalledWith('c1');
    });

    it('handles reusable config and rerun routes', async () => {
      mockRunReuseService.getReusableConfig.mockReturnValue({ workflowId: 'wf1' });
      mockRunReuseService.createRerunPayload.mockReturnValue({ workflowId: 'wf1', input: 'x' });
      mockRunReuseService.createEditedRerunPayload.mockReturnValue({ workflowId: 'wf1', input: 'x' });
      mockRunService.startRun.mockReturnValue({ runId: 'run-next', status: 'running' });

      await router.handle(createMockRequest('GET', '/api/runs/run1/reusable-config'), createMockResponse().res);
      await router.handle(createMockRequest('POST', '/api/runs/run1/rerun'), createMockResponse().res);

      const postReq = createMockRequest('POST', '/api/runs/run1/rerun-with-edits') as http.IncomingMessage;
      (postReq as unknown as Record<symbol, unknown>)[Symbol.asyncIterator] = async function* () {
        yield Buffer.from(JSON.stringify({ inputData: { q: 1 } }));
      };
      await router.handle(postReq, createMockResponse().res);

      expect(mockRunReuseService.getReusableConfig).toHaveBeenCalledWith('run1');
      expect(mockRunReuseService.createRerunPayload).toHaveBeenCalledWith('run1');
      expect(mockRunReuseService.createEditedRerunPayload).toHaveBeenCalledWith('run1', { q: 1 });
      expect(mockRunService.startRun).toHaveBeenCalledTimes(2);
    });
  });

  describe('SSE stream route', () => {
    it('sends sync event with lastEventId sequence and registers client', async () => {
      mockRunVisualService.getVisualState.mockReturnValue({ runId: 'run1', workflowId: 'wf1', nodeStates: {} });
      mockRunEventEmitter.getCurrentSequence.mockReturnValue(12);

      const req = createMockRequest('GET', '/api/runs/run1/stream?lastEventId=run1%3A5') as http.IncomingMessage;
      const { res, data } = createMockResponse();

      await router.handle(req, res);

      expect(mockRunVisualService.getVisualState).toHaveBeenCalledWith('run1');
      expect(mockRunEventEmitter.addClient).toHaveBeenCalled();
      expect(data.some((chunk) => String(chunk).includes('event: sync'))).toBe(true);
      expect(data.some((chunk) => String(chunk).includes('"lastSequence":5'))).toBe(true);
    });
  });

  describe('non-API routes', () => {
    it('returns false for non-API routes', async () => {
      const req = createMockRequest('GET', '/');
      const { res } = createMockResponse();
      const handled = await router.handle(req, res);
      expect(handled).toBe(false);
    });
  });
});
