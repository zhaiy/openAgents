import type http from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';

import type { WebAppContext } from '../app/context.js';
import type { GateActionRequestDto, RunStartRequestDto } from '../app/dto.js';

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

export class WebRouter {
  constructor(private readonly context: WebAppContext) {}

  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const method = req.method ?? 'GET';
    const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = parsed.pathname;

    if (!pathname.startsWith('/api')) {
      return false;
    }

    try {
      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (method === 'GET' && pathname === '/api/workflows') {
        sendJson(res, 200, this.context.workflowService.listWorkflows());
        return true;
      }

      const workflowMatch = pathname.match(/^\/api\/workflows\/([^/]+)$/);
      if (method === 'GET' && workflowMatch) {
        sendJson(res, 200, this.context.workflowService.getWorkflow(decodeURIComponent(workflowMatch[1])));
        return true;
      }

      if (method === 'POST' && pathname === '/api/runs') {
        const body = await parseJsonBody<RunStartRequestDto>(req);
        sendJson(res, 200, this.context.runService.startRun(body));
        return true;
      }

      const resumeMatch = pathname.match(/^\/api\/runs\/([^/]+)\/resume$/);
      if (method === 'POST' && resumeMatch) {
        const runId = decodeURIComponent(resumeMatch[1]);
        sendJson(res, 200, this.context.runService.resumeRun(runId));
        return true;
      }

      if (method === 'GET' && pathname === '/api/runs') {
        sendJson(
          res,
          200,
          this.context.runService.listRuns({
            status: (parsed.searchParams.get('status') ?? undefined) as
              | 'running'
              | 'completed'
              | 'failed'
              | 'interrupted'
              | undefined,
            workflowId: parsed.searchParams.get('workflowId') ?? undefined,
          }),
        );
        return true;
      }

      const runDetailMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (method === 'GET' && runDetailMatch) {
        sendJson(res, 200, this.context.runService.getRun(decodeURIComponent(runDetailMatch[1])));
        return true;
      }

      const runEventsMatch = pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
      if (method === 'GET' && runEventsMatch) {
        sendJson(res, 200, this.context.runService.getRunEvents(decodeURIComponent(runEventsMatch[1])));
        return true;
      }

      const runOutputMatch = pathname.match(/^\/api\/runs\/([^/]+)\/steps\/([^/]+)\/output$/);
      if (method === 'GET' && runOutputMatch) {
        const text = this.context.runService.getStepOutput(
          decodeURIComponent(runOutputMatch[1]),
          decodeURIComponent(runOutputMatch[2]),
        );
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(text);
        return true;
      }

      const runEvalMatch = pathname.match(/^\/api\/runs\/([^/]+)\/eval$/);
      if (method === 'GET' && runEvalMatch) {
        sendJson(res, 200, this.context.runService.getRunEval(decodeURIComponent(runEvalMatch[1])));
        return true;
      }

      const runStreamMatch = pathname.match(/^\/api\/runs\/([^/]+)\/stream$/);
      if (method === 'GET' && runStreamMatch) {
        const runId = decodeURIComponent(runStreamMatch[1]);
        const clientId = randomUUID();

        // Support Last-Event-ID header for reconnection
        const lastEventId =
          (req.headers['last-event-id'] as string | undefined) ??
          parsed.searchParams.get('lastEventId') ??
          undefined;
        const lastSequence = lastEventId ? parseInt(lastEventId.split(':').pop() ?? '0', 10) : 0;

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering if present
        });

        // Initial sync event with visual state for state recovery
        // This helps clients reconstruct state after reconnection
        try {
          const visualState = this.context.runVisualService.getVisualState(runId);
          const currentSeq = this.context.runEventEmitter.getCurrentSequence(runId);
          const initialSync = {
            type: 'sync',
            runId,
            visualState,
            sequence: currentSeq,
            lastSequence, // Last sequence client has processed
            ts: Date.now(),
          };
          res.write(`id: sync:${runId}:${currentSeq}\nevent: sync\ndata: ${JSON.stringify(initialSync)}\n\n`);
        } catch {
          // If run not found or error, send empty sync
          res.write(`event: sync\ndata: ${JSON.stringify({ runId, ts: Date.now() })}\n\n`);
        }

        this.context.runEventEmitter.addClient(runId, clientId, res);
        req.on('close', () => {
          this.context.runEventEmitter.removeClient(runId, clientId);
        });
        return true;
      }

      const gateActionMatch = pathname.match(/^\/api\/runs\/([^/]+)\/gates\/([^/]+)\/action$/);
      if (method === 'POST' && gateActionMatch) {
        const runId = decodeURIComponent(gateActionMatch[1]);
        const stepId = decodeURIComponent(gateActionMatch[2]);
        const body = await parseJsonBody<GateActionRequestDto>(req);
        sendJson(res, 200, this.context.gateService.submitAction(runId, stepId, body));
        return true;
      }

      if (method === 'GET' && pathname === '/api/settings') {
        sendJson(res, 200, this.context.settingsService.getSettings());
        return true;
      }

      // ===== Visual API Routes =====

      // Workflow Visual Summary: GET /api/workflows/:id/visual-summary
      const workflowVisualMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/visual-summary$/);
      if (method === 'GET' && workflowVisualMatch) {
        const workflowId = decodeURIComponent(workflowVisualMatch[1]);
        const summary = this.context.workflowVisualService.getVisualSummary(workflowId);
        if (!summary) {
          sendJson(res, 404, { error: { message: 'Workflow not found' } });
          return true;
        }
        sendJson(res, 200, summary);
        return true;
      }

      // Run Visual State: GET /api/runs/:id/visual-state
      const runVisualMatch = pathname.match(/^\/api\/runs\/([^/]+)\/visual-state$/);
      if (method === 'GET' && runVisualMatch) {
        const runId = decodeURIComponent(runVisualMatch[1]);
        try {
          const visualState = this.context.runVisualService.getVisualState(runId);
          sendJson(res, 200, visualState);
        } catch {
          sendJson(res, 404, { error: { message: 'Run not found' } });
        }
        return true;
      }

      // Run Timeline: GET /api/runs/:id/timeline
      const runTimelineMatch = pathname.match(/^\/api\/runs\/([^/]+)\/timeline$/);
      if (method === 'GET' && runTimelineMatch) {
        const runId = decodeURIComponent(runTimelineMatch[1]);
        try {
          const timeline = this.context.runVisualService.getTimeline(runId);
          sendJson(res, 200, timeline);
        } catch {
          sendJson(res, 404, { error: { message: 'Run not found' } });
        }
        return true;
      }

      // Run Node State: GET /api/runs/:id/node/:nodeId (and legacy /nodes/:nodeId)
      const runNodeMatch = pathname.match(/^\/api\/runs\/([^/]+)\/node(?:s)?\/([^/]+)$/);
      if (method === 'GET' && runNodeMatch) {
        const runId = decodeURIComponent(runNodeMatch[1]);
        const nodeId = decodeURIComponent(runNodeMatch[2]);
        try {
          const nodeState = this.context.runVisualService.getNodeState(runId, nodeId);
          if (!nodeState) {
            sendJson(res, 404, { error: { message: 'Node not found' } });
            return true;
          }
          sendJson(res, 200, nodeState);
        } catch {
          sendJson(res, 404, { error: { message: 'Run not found' } });
        }
        return true;
      }

      // Diagnostics - Failed Runs: GET /api/diagnostics/failed-runs
      if (method === 'GET' && pathname === '/api/diagnostics/failed-runs') {
        const failedRuns = this.context.diagnosticsService.getFailedRunsSummary();
        sendJson(res, 200, failedRuns);
        return true;
      }

      // Diagnostics - Waiting Gates: GET /api/diagnostics/waiting-gates
      if (method === 'GET' && pathname === '/api/diagnostics/waiting-gates') {
        const waitingGates = this.context.diagnosticsService.getWaitingGatesSummary();
        sendJson(res, 200, waitingGates);
        return true;
      }

      // Diagnostics - Run Detail: GET /api/diagnostics/runs/:id
      const diagnosticsRunMatch = pathname.match(/^\/api\/diagnostics\/runs\/([^/]+)$/);
      if (method === 'GET' && diagnosticsRunMatch) {
        const runId = decodeURIComponent(diagnosticsRunMatch[1]);
        const diagnostics = this.context.diagnosticsService.getRunDiagnostics(runId);
        if (!diagnostics) {
          sendJson(res, 404, { error: { message: 'Run not found' } });
          return true;
        }
        sendJson(res, 200, diagnostics);
        return true;
      }

      // Config Drafts - List: GET /api/workflows/:id/drafts
      const draftListMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/drafts$/);
      if (method === 'GET' && draftListMatch) {
        const workflowId = decodeURIComponent(draftListMatch[1]);
        const drafts = this.context.configDraftService.listDraftsByWorkflow(workflowId);
        sendJson(res, 200, drafts);
        return true;
      }

      // Config Drafts - Create: POST /api/workflows/:id/drafts
      if (method === 'POST' && pathname.match(/^\/api\/workflows\/([^/]+)\/drafts$/)) {
        const match = pathname.match(/^\/api\/workflows\/([^/]+)\/drafts$/);
        if (match) {
          const workflowId = decodeURIComponent(match[1]);
          const body = await parseJsonBody<{
            name: string;
            inputData: Record<string, unknown>;
            runtimeOptions?: { stream?: boolean; autoApprove?: boolean; noEval?: boolean };
          }>(req);
          const draft = this.context.configDraftService.createDraft({
            workflowId,
            name: body.name,
            inputData: body.inputData,
            runtimeOptions: body.runtimeOptions,
          });
          sendJson(res, 201, draft);
          return true;
        }
      }

      // Config Drafts - Get: GET /api/workflows/:id/drafts/:draftId
      const draftGetMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/drafts\/([^/]+)$/);
      if (method === 'GET' && draftGetMatch) {
        const draftId = decodeURIComponent(draftGetMatch[2]);
        const draft = this.context.configDraftService.getDraft(draftId);
        if (!draft) {
          sendJson(res, 404, { error: { message: 'Draft not found' } });
          return true;
        }
        sendJson(res, 200, draft);
        return true;
      }

      // Config Drafts - Update: PATCH /api/workflows/:id/drafts/:draftId
      if (method === 'PATCH' && pathname.match(/^\/api\/workflows\/([^/]+)\/drafts\/([^/]+)$/)) {
        const match = pathname.match(/^\/api\/workflows\/([^/]+)\/drafts\/([^/]+)$/);
        if (match) {
          const draftId = decodeURIComponent(match[2]);
          const body = await parseJsonBody<{
            name?: string;
            inputData?: Record<string, unknown>;
            runtimeOptions?: { stream?: boolean; autoApprove?: boolean; noEval?: boolean };
          }>(req);
          const draft = this.context.configDraftService.updateDraft(draftId, body);
          if (!draft) {
            sendJson(res, 404, { error: { message: 'Draft not found' } });
            return true;
          }
          sendJson(res, 200, draft);
          return true;
        }
      }

      // Config Drafts - Delete: DELETE /api/workflows/:id/drafts/:draftId
      if (method === 'DELETE' && pathname.match(/^\/api\/workflows\/([^/]+)\/drafts\/([^/]+)$/)) {
        const match = pathname.match(/^\/api\/workflows\/([^/]+)\/drafts\/([^/]+)$/);
        if (match) {
          const draftId = decodeURIComponent(match[2]);
          const deleted = this.context.configDraftService.deleteDraft(draftId);
          if (!deleted) {
            sendJson(res, 404, { error: { message: 'Draft not found' } });
            return true;
          }
          sendJson(res, 204, {});
          return true;
        }
      }

      // Run Comparison (stateless): GET /api/runs/compare?runA=&runB=
      if (method === 'GET' && pathname === '/api/runs/compare') {
        const runA = parsed.searchParams.get('runA');
        const runB = parsed.searchParams.get('runB');
        if (!runA || !runB) {
          sendJson(res, 400, { error: { message: 'Both runA and runB query parameters are required' } });
          return true;
        }
        try {
          const comparison = this.context.runCompareService.compare(runA, runB);
          sendJson(res, 200, comparison);
        } catch {
          sendJson(res, 404, { error: { message: 'Run not found' } });
        }
        return true;
      }

      if (method === 'POST' && pathname === '/api/compare') {
        const body = await parseJsonBody<{ runAId?: string; runBId?: string }>(req);
        if (!body.runAId || !body.runBId) {
          sendJson(res, 400, { error: { message: 'runAId and runBId are required' } });
          return true;
        }
        try {
          sendJson(res, 201, this.context.runCompareService.createSession(body.runAId, body.runBId));
        } catch {
          sendJson(res, 404, { error: { message: 'Run not found' } });
        }
        return true;
      }

      const compareSessionMatch = pathname.match(/^\/api\/compare\/([^/]+)$/);
      if (method === 'GET' && compareSessionMatch) {
        const sessionId = decodeURIComponent(compareSessionMatch[1]);
        const session = this.context.runCompareService.getSession(sessionId);
        if (!session) {
          sendJson(res, 404, { error: { message: 'Comparison session not found' } });
          return true;
        }
        sendJson(res, 200, session);
        return true;
      }

      if (method === 'DELETE' && compareSessionMatch) {
        const sessionId = decodeURIComponent(compareSessionMatch[1]);
        const deleted = this.context.runCompareService.deleteSession(sessionId);
        if (!deleted) {
          sendJson(res, 404, { error: { message: 'Comparison session not found' } });
          return true;
        }
        sendJson(res, 204, {});
        return true;
      }

      // Reusable Config: GET /api/runs/:id/reusable-config
      const reusableConfigMatch = pathname.match(/^\/api\/runs\/([^/]+)\/reusable-config$/);
      if (method === 'GET' && reusableConfigMatch) {
        const runId = decodeURIComponent(reusableConfigMatch[1]);
        const config = this.context.runReuseService.getReusableConfig(runId);
        if (!config) {
          sendJson(res, 404, { error: { message: 'Run not found' } });
          return true;
        }
        sendJson(res, 200, config);
        return true;
      }

      // Rerun: POST /api/runs/:id/rerun
      const rerunMatch = pathname.match(/^\/api\/runs\/([^/]+)\/rerun$/);
      if (method === 'POST' && rerunMatch) {
        const runId = decodeURIComponent(rerunMatch[1]);
        try {
          const payload = this.context.runReuseService.createRerunPayload(runId);
          if (!payload) {
            sendJson(res, 404, { error: { message: 'Run not found' } });
            return true;
          }
          // Start new run with the payload
          const newRun = this.context.runService.startRun(payload);
          sendJson(res, 200, { runId: newRun.runId, status: newRun.status });
          return true;
        } catch (error) {
          sendJson(res, 400, { error: { message: error instanceof Error ? error.message : String(error) } });
          return true;
        }
      }

      // Rerun with edits: POST /api/runs/:id/rerun-with-edits
      const rerunWithEditsMatch = pathname.match(/^\/api\/runs\/([^/]+)\/rerun-with-edits$/);
      if (method === 'POST' && rerunWithEditsMatch) {
        const runId = decodeURIComponent(rerunWithEditsMatch[1]);
        try {
          const body = await parseJsonBody<{ inputData?: Record<string, unknown> }>(req);
          const editedInputData = body.inputData || {};
          const payload = this.context.runReuseService.createEditedRerunPayload(runId, editedInputData);
          if (!payload) {
            sendJson(res, 404, { error: { message: 'Run not found' } });
            return true;
          }
          // Start new run with the edited payload
          const newRun = this.context.runService.startRun(payload);
          sendJson(res, 200, { runId: newRun.runId, status: newRun.status });
          return true;
        } catch (error) {
          sendJson(res, 400, { error: { message: error instanceof Error ? error.message : String(error) } });
          return true;
        }
      }

      sendJson(res, 404, { error: { message: 'Not Found' } });
      return true;
    } catch (error) {
      sendJson(res, 400, {
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return true;
    }
  }
}
