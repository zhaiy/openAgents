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
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`event: sync\ndata: ${JSON.stringify({ runId, ts: Date.now() })}\n\n`);
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
