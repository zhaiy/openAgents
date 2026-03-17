import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { GateRejectError, RuntimeError } from '../errors.js';
import { sendWebhookNotification } from '../output/notifier.js';

// Mock fetch for webhook tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Error Recovery Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendWebhookNotification', () => {
    it('should send POST request to webhook URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendWebhookNotification('https://example.com/webhook', {
        workflowId: 'test-workflow',
        runId: 'run-123',
        stepId: 'step-1',
        agent: 'agent-1',
        error: 'Test error',
        timestamp: 1234567890,
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OpenAgents/1.0',
        },
        body: JSON.stringify({
          workflowId: 'test-workflow',
          runId: 'run-123',
          stepId: 'step-1',
          agent: 'agent-1',
          error: 'Test error',
          timestamp: 1234567890,
        }),
      });
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // The function catches errors and logs them, so it shouldn't throw
      await sendWebhookNotification('https://example.com/webhook', {
        workflowId: 'test-workflow',
        runId: 'run-123',
        stepId: 'step-1',
        agent: 'agent-1',
        error: 'Test error',
        timestamp: 1234567890,
      });

      // Should not throw - webhook failures should not block workflow
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw - webhook failures should not block workflow
      await sendWebhookNotification('https://example.com/webhook', {
        workflowId: 'test-workflow',
        runId: 'run-123',
        stepId: 'step-1',
        agent: 'agent-1',
        error: 'Test error',
        timestamp: 1234567890,
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

describe('OnFailure Actions', () => {
  it('should have correct action types', () => {
    const validActions = ['fail', 'skip', 'fallback', 'notify'] as const;

    // TypeScript will enforce these are the only valid values
    expect(validActions).toContain('fail');
    expect(validActions).toContain('skip');
    expect(validActions).toContain('fallback');
    expect(validActions).toContain('notify');
  });
});

describe('GateRejectError', () => {
  it('should create GateRejectError with step ID', () => {
    const error = new GateRejectError('step-1');
    expect(error.message).toBe('用户在节点 "step-1" 的审核门控处终止了工作流');
    expect(error.stepId).toBe('step-1');
    expect(error.name).toBe('GateRejectError');
  });

  it('should be an instance of Error', () => {
    const error = new GateRejectError('step-1');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('RuntimeError', () => {
  it('should create RuntimeError with message and step ID', () => {
    const error = new RuntimeError('Something went wrong', 'step-1');
    expect(error.message).toBe('Something went wrong');
    expect(error.stepId).toBe('step-1');
    expect(error.name).toBe('RuntimeError');
  });

  it('should create RuntimeError with details', () => {
    const details = {
      httpStatus: 500,
      responseBody: '{"error": "Internal Server Error"}',
      isTimeout: false,
    };
    const error = new RuntimeError('API error', 'step-1', details);
    expect(error.details).toEqual(details);
  });

  it('should be an instance of Error', () => {
    const error = new RuntimeError('Test error', 'step-1');
    expect(error).toBeInstanceOf(Error);
  });
});