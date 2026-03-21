import type http from 'node:http';

import type { WebRunEvent, WebRunEventPayload } from '../dto.js';

type RunClient = {
  id: string;
  res: http.ServerResponse;
};

export class RunEventEmitter {
  private readonly clientsByRunId = new Map<string, Map<string, RunClient>>();
  private seq = 0;

  addClient(runId: string, clientId: string, res: http.ServerResponse): void {
    const bucket = this.clientsByRunId.get(runId) ?? new Map<string, RunClient>();
    bucket.set(clientId, { id: clientId, res });
    this.clientsByRunId.set(runId, bucket);
  }

  removeClient(runId: string, clientId: string): void {
    const bucket = this.clientsByRunId.get(runId);
    if (!bucket) {
      return;
    }
    bucket.delete(clientId);
    if (bucket.size === 0) {
      this.clientsByRunId.delete(runId);
    }
  }

  emit(event: WebRunEventPayload & { ts: number; runId: string }): WebRunEvent {
    const enriched = {
      ...event,
      id: `${event.runId}:${event.ts}:${this.seq++}`,
    } satisfies WebRunEvent;

    const clients = this.clientsByRunId.get(event.runId);
    if (!clients || clients.size === 0) {
      return enriched;
    }

    const payload = `id: ${enriched.id}\nevent: ${event.type}\ndata: ${JSON.stringify(enriched)}\n\n`;
    for (const client of clients.values()) {
      client.res.write(payload);
    }
    return enriched;
  }

  closeRun(runId: string): void {
    const clients = this.clientsByRunId.get(runId);
    if (!clients) {
      return;
    }
    for (const client of clients.values()) {
      client.res.end();
    }
    this.clientsByRunId.delete(runId);
  }
}
