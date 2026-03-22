import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunEventEmitter } from '../app/events/run-event-emitter.js';
import type { WebRunEventPayload } from '../app/dto.js';
import type { ServerResponse } from 'node:http';

describe('RunEventEmitter', () => {
  let emitter: RunEventEmitter;
  let mockResponse: ServerResponse;

  const createMockResponse = (): ServerResponse => {
    const chunks: string[] = [];
    return {
      write: vi.fn((chunk: string) => {
        chunks.push(chunk);
        return true;
      }),
      end: vi.fn(),
    } as unknown as ServerResponse & { _chunks?: string[] };
  };

  beforeEach(() => {
    emitter = new RunEventEmitter();
    mockResponse = createMockResponse();
  });

  describe('addClient / removeClient', () => {
    it('should add a client and track it', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      // Verify client was registered by checking emit behavior
      const event: WebRunEventPayload = {
        type: 'step.started',
        stepId: 'step-1',
        runId: 'run-1',
        ts: Date.now(),
      };
      emitter.emit(event);

      expect(mockResponse.write).toHaveBeenCalled();
    });

    it('should remove a client', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);
      emitter.removeClient('run-1', 'client-1');

      // After removal, write should not be called
      mockResponse.write.mockClear();
      const event: WebRunEventPayload = {
        type: 'step.started',
        stepId: 'step-1',
        runId: 'run-1',
        ts: Date.now(),
      };
      emitter.emit(event);

      expect(mockResponse.write).not.toHaveBeenCalled();
    });

    it('should clean up sequence counter when last client disconnects', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      const event: WebRunEventPayload = {
        type: 'step.started',
        stepId: 'step-1',
        runId: 'run-1',
        ts: Date.now(),
      };
      emitter.emit(event); // seq becomes 1
      emitter.emit(event); // seq becomes 2

      emitter.removeClient('run-1', 'client-1');

      expect(emitter.getCurrentSequence('run-1')).toBe(0);
    });

    it('should handle removeClient for non-existent client gracefully', () => {
      expect(() => emitter.removeClient('run-1', 'non-existent')).not.toThrow();
    });

    it('should handle removeClient for non-existent run gracefully', () => {
      expect(() => emitter.removeClient('non-existent-run', 'client-1')).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should assign sequential sequence numbers to events', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      const event1: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-1', ts: 1000 };
      const event2: WebRunEventPayload = { type: 'step.completed', stepId: 'step-1', runId: 'run-1', ts: 2000 };
      const event3: WebRunEventPayload = { type: 'step.failed', stepId: 'step-2', runId: 'run-1', ts: 3000 };

      const result1 = emitter.emit(event1);
      const result2 = emitter.emit(event2);
      const result3 = emitter.emit(event3);

      expect(result1.sequence).toBe(0);
      expect(result2.sequence).toBe(1);
      expect(result3.sequence).toBe(2);
    });

    it('should assign id in format runId:sequence', () => {
      emitter.addClient('run-abc', 'client-1', mockResponse);

      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-abc', ts: 1000 };
      const result = emitter.emit(event);

      expect(result.id).toBe('run-abc:0');
    });

    it('should write SSE formatted data to client', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-1', ts: 1000 };
      emitter.emit(event);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('id: run-1:0')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: step.started')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('data:')
      );
    });

    it('should not write if no clients connected', () => {
      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-1', ts: 1000 };
      const result = emitter.emit(event);

      expect(mockResponse.write).not.toHaveBeenCalled();
      expect(result.id).toBe('run-1:0');
      expect(result.sequence).toBe(0);
    });

    it('should write to all clients for a run', () => {
      const response2 = createMockResponse();
      emitter.addClient('run-1', 'client-1', mockResponse);
      emitter.addClient('run-1', 'client-2', response2);

      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-1', ts: 1000 };
      emitter.emit(event);

      expect(mockResponse.write).toHaveBeenCalled();
      expect(response2.write).toHaveBeenCalled();
    });

    it('should only write to clients of the specific run', () => {
      const responseForRun2 = createMockResponse();
      emitter.addClient('run-1', 'client-1', mockResponse);
      emitter.addClient('run-2', 'client-2', responseForRun2);

      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-1', ts: 1000 };
      emitter.emit(event);

      expect(mockResponse.write).toHaveBeenCalled();
      expect(responseForRun2.write).not.toHaveBeenCalled();
    });

    it('should return enriched event with id and sequence', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      const event: WebRunEventPayload = {
        type: 'step.started',
        stepId: 'step-1',
        runId: 'run-1',
        ts: 1000,
      };
      const result = emitter.emit(event);

      expect(result).toEqual(expect.objectContaining({
        id: 'run-1:0',
        sequence: 0,
        type: 'step.started',
        stepId: 'step-1',
        runId: 'run-1',
        ts: 1000,
      }));
    });

    it('should initialize sequence counter when adding first client', () => {
      emitter.addClient('run-new', 'client-1', mockResponse);

      expect(emitter.getCurrentSequence('run-new')).toBe(0);

      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-new', ts: 1000 };
      emitter.emit(event);

      expect(emitter.getCurrentSequence('run-new')).toBe(1);
    });
  });

  describe('getCurrentSequence', () => {
    it('should return 0 for unknown run', () => {
      expect(emitter.getCurrentSequence('unknown-run')).toBe(0);
    });

    it('should return current sequence for known run', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-1', ts: 1000 };
      emitter.emit(event);
      emitter.emit(event);
      emitter.emit(event);

      expect(emitter.getCurrentSequence('run-1')).toBe(3);
    });
  });

  describe('closeRun', () => {
    it('should send run.closed event to all clients', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      emitter.closeRun('run-1');

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: run.closed')
      );
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should clean up clients and sequence after close', () => {
      emitter.addClient('run-1', 'client-1', mockResponse);

      emitter.closeRun('run-1');

      expect(emitter.getCurrentSequence('run-1')).toBe(0);
      // Client should not receive new events after close
      mockResponse.write.mockClear();
      const event: WebRunEventPayload = { type: 'step.started', stepId: 'step-1', runId: 'run-1', ts: 1000 };
      emitter.emit(event);

      expect(mockResponse.write).not.toHaveBeenCalled();
    });

    it('should handle closeRun for non-existent run gracefully', () => {
      expect(() => emitter.closeRun('unknown-run')).not.toThrow();
    });
  });
});
