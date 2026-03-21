import type { WebRunEventPayload } from '../dto.js';

export function mapEvent(event: WebRunEventPayload & { ts: number; runId: string }): WebRunEventPayload & { ts: number; runId: string } {
  return event;
}
