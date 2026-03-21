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
  it('falls back to reasoning_content for non-streaming responses', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '', reasoning_content: 'Reasoned answer' } }],
          usage: {
            total_tokens: 42,
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

    expect(result.output).toBe('Reasoned answer');
    expect(result.tokensUsed).toBe(42);
  });

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

describe('LLMDirectRuntime streaming', () => {
  it('falls back to reasoning_content in streaming deltas', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        const first = JSON.stringify({
          choices: [{ delta: { reasoning_content: 'Reasoned ' } }],
        });
        const second = JSON.stringify({
          choices: [{ delta: { reasoning_content: 'stream' } }],
        });
        controller.enqueue(new TextEncoder().encode(`data: ${first}\n\n`));
        controller.enqueue(new TextEncoder().encode(`data: ${second}\n\n`));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn(async () => {
      return new Response(mockStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const onChunk = vi.fn();

    const result = await runtime.executeStream!(
      {
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 10,
      },
      onChunk,
    );

    expect(result.output).toBe('Reasoned stream');
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenCalledWith('Reasoned ');
    expect(onChunk).toHaveBeenCalledWith('stream');
  });

  it('adapts when a streaming request returns a non-stream JSON response', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '', reasoning_content: 'JSON fallback answer' } }],
          usage: { total_tokens: 21 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const onChunk = vi.fn();

    const result = await runtime.executeStream!(
      {
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 10,
      },
      onChunk,
    );

    expect(result.output).toBe('JSON fallback answer');
    expect(result.tokensUsed).toBe(21);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('JSON fallback answer');
  });

  it('calls onChunk for each streaming delta', async () => {
    const chunks = ['Hello', ' world', '!'];

    // Create a mock streaming response body
    const mockStream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          const data = JSON.stringify({
            choices: [{ delta: { content: chunk } }],
          });
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn(async () => {
      return new Response(mockStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const onChunk = vi.fn();

    const result = await runtime.executeStream!(
      {
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 10,
      },
      onChunk,
    );

    expect(result.output).toBe('Hello world!');
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenCalledWith('Hello');
    expect(onChunk).toHaveBeenCalledWith(' world');
    expect(onChunk).toHaveBeenCalledWith('!');
  });

  it('handles streaming with empty deltas', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        const data1 = JSON.stringify({
          choices: [{ delta: { content: 'Hello' } }],
        });
        const data2 = JSON.stringify({
          choices: [{ delta: {} }], // empty delta
        });
        const data3 = JSON.stringify({
          choices: [{ delta: { content: ' world' } }],
        });
        controller.enqueue(new TextEncoder().encode(`data: ${data1}\n\n`));
        controller.enqueue(new TextEncoder().encode(`data: ${data2}\n\n`));
        controller.enqueue(new TextEncoder().encode(`data: ${data3}\n\n`));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn(async () => {
      return new Response(mockStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const onChunk = vi.fn();

    const result = await runtime.executeStream!(
      {
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 10,
      },
      onChunk,
    );

    expect(result.output).toBe('Hello world');
    expect(onChunk).toHaveBeenCalledTimes(2);
  });

  it('returns complete output from streaming', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 10; i++) {
          const data = JSON.stringify({
            choices: [{ delta: { content: `chunk${i} ` } }],
          });
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn(async () => {
      return new Response(mockStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const runtime = new LLMDirectRuntime({ apiKey: 'test-key', baseUrl: 'https://example.com' });
    const onChunk = vi.fn();

    const result = await runtime.executeStream!(
      {
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'test-model',
        timeoutSeconds: 10,
      },
      onChunk,
    );

    expect(result.output).toBe('chunk0 chunk1 chunk2 chunk3 chunk4 chunk5 chunk6 chunk7 chunk8 chunk9 ');
    expect(onChunk).toHaveBeenCalledTimes(10);
  });

  it('marks streaming timeout errors with timeout details', async () => {
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
    const onChunk = vi.fn();

    await expect(
      runtime.executeStream!(
        {
          systemPrompt: 'sys',
          userPrompt: 'user',
          model: 'test-model',
          timeoutSeconds: 0,
        },
        onChunk,
      ),
    ).rejects.toMatchObject({
      name: 'RuntimeError',
      details: {
        isTimeout: true,
        timeoutSeconds: 0,
      },
    });
  });
});
