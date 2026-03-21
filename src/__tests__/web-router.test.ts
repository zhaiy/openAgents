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

const mockRunEventEmitter = {
  addClient: vi.fn(),
  removeClient: vi.fn(),
};

const mockContext = {
  workflowService: mockWorkflowService,
  runService: mockRunService,
  gateService: mockGateService,
  settingsService: mockSettingsService,
  runEventEmitter: mockRunEventEmitter,
} as unknown as WebAppContext;

function createMockRequest(method: string, url: string): http.IncomingMessage {
  return {
    method,
    url,
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
      const workflows = [{ id: 'wf1', name: 'Test', description: 'desc', stepCount: 2, hasEval: false }];
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

  describe('non-API routes', () => {
    it('returns false for non-API routes', async () => {
      const req = createMockRequest('GET', '/');
      const { res } = createMockResponse();
      const handled = await router.handle(req, res);
      expect(handled).toBe(false);
    });
  });
});
