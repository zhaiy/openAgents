import type http from 'node:http';

import type { WebRunEvent, WebRunEventPayload } from '../dto.js';

type RunClient = {
  id: string;
  res: http.ServerResponse;
};

export class RunEventEmitter {
  private readonly clientsByRunId = new Map<string, Map<string, RunClient>>();
  private seqByRunId = new Map<string, number>();

  addClient(runId: string, clientId: string, res: http.ServerResponse): void {
    const bucket = this.clientsByRunId.get(runId) ?? new Map<string, RunClient>();
    bucket.set(clientId, { id: clientId, res });
    this.clientsByRunId.set(runId, bucket);

    // Initialize sequence counter for this run if not exists
    if (!this.seqByRunId.has(runId)) {
      this.seqByRunId.set(runId, 0);
    }
  }

  removeClient(runId: string, clientId: string): void {
    const bucket = this.clientsByRunId.get(runId);
    if (!bucket) {
      return;
    }
    bucket.delete(clientId);
    if (bucket.size === 0) {
      this.clientsByRunId.delete(runId);
      // Clean up sequence counter when last client disconnects
      this.seqByRunId.delete(runId);
    }
  }

  /**
   * Emit an event to all connected clients for a run.
   * Each event is assigned a sequence number for ordering.
   */
  emit(event: WebRunEventPayload & { ts: number; runId: string }): WebRunEvent {
    // Get or initialize sequence for this run
    const seq = this.seqByRunId.get(event.runId) ?? 0;
    this.seqByRunId.set(event.runId, seq + 1);

    const enriched: WebRunEvent = {
      ...event,
      id: `${event.runId}:${seq}`,
      sequence: seq, // Expose sequence for client-side ordering
    };

    const clients = this.clientsByRunId.get(event.runId);
    if (!clients || clients.size === 0) {
      return enriched;
    }

    // SSE format with id for Last-Event-ID support
    const payload = `id: ${enriched.id}\nevent: ${event.type}\ndata: ${JSON.stringify(enriched)}\n\n`;
    for (const client of clients.values()) {
      client.res.write(payload);
    }
    return enriched;
  }

  /**
   * Get current sequence number for a run (for snapshot alignment)
   */
  getCurrentSequence(runId: string): number {
    return this.seqByRunId.get(runId) ?? 0;
  }

  closeRun(runId: string): void {
    const clients = this.clientsByRunId.get(runId);
    if (!clients) {
      return;
    }
    for (const client of clients.values()) {
      // Send final event before closing
      client.res.write(`event: run.closed\ndata: ${JSON.stringify({ runId, ts: Date.now() })}\n\n`);
      client.res.end();
    }
    this.clientsByRunId.delete(runId);
    this.seqByRunId.delete(runId);
  }
}
