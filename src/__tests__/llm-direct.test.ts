import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeError } from '../errors.js';
import { LLMDirectRuntime } from '../runtime/llm-direct.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe('LLMDirectRuntime error details', () => {
  it('captures HTTP status and response body on non-2xx', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    await expect(
      runtime.execute({
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 1,
      }),
    ).rejects.toMatchObject({
      name: 'RuntimeError',
      details: {
        httpStatus: 429,
      },
    });

    try {
      await runtime.execute({
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 1,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeError);
      const runtimeError = error as RuntimeError;
      expect(runtimeError.details?.responseBody).toContain('rate limited');
    }
  });

  it('marks timeout errors with timeout details', async () => {
    globalThis.fetch = vi.fn((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    await expect(
      runtime.execute({
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 0,
      }),
    ).rejects.toMatchObject({
      name: 'RuntimeError',
      details: {
        isTimeout: true,
        timeoutSeconds: 0,
      },
    });
  });
});

describe('LLMDirectRuntime token usage', () => {
  it('extracts detailed token usage from response', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hello world' } }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const result = await runtime.execute({
      systemPrompt: 'sys',
      userPrompt: 'user',
      model: 'test-model',
      timeoutSeconds: 10,
    });

    expect(result.output).toBe('Hello world');
    expect(result.tokensUsed).toBe(150);
    expect(result.tokenUsage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('handles response without usage field', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'No usage info' } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const result = await runtime.execute({
      systemPrompt: 'sys',
      userPrompt: 'user',
      model: 'test-model',
      timeoutSeconds: 10,
    });

    expect(result.output).toBe('No usage info');
    expect(result.tokensUsed).toBeUndefined();
    expect(result.tokenUsage).toBeUndefined();
  });

  it('handles partial usage fields', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Partial usage' } }],
          usage: {
            total_tokens: 200,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const result = await runtime.execute({
      systemPrompt: 'sys',
      userPrompt: 'user',
      model: 'test-model',
      timeoutSeconds: 10,
    });

    expect(result.output).toBe('Partial usage');
    expect(result.tokensUsed).toBe(200);
    expect(result.tokenUsage).toEqual({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: 200,
    });
  });
});
