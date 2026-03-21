import { RuntimeError } from '../errors.js';
import type { AgentRuntime, ExecuteParams, ExecuteResult } from '../types/index.js';

const DEFAULT_BASE_URL = '';
const MAX_TOOL_CALL_ROUNDS = 10;

interface LLMDirectRuntimeConfig {
  apiKey?: string;
  baseUrl?: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: OpenAIMessage;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
    message?: OpenAIMessage;
  }>;
  usage?: OpenAIChatCompletionResponse['usage'];
}

function normalizeResponseBody(text: string): string {
  if (!text) {
    return '';
  }
  return text.length > 4000 ? `${text.slice(0, 4000)}...(truncated)` : text;
}

function extractMessageOutput(message?: OpenAIMessage): string | undefined {
  if (!message) {
    return undefined;
  }

  if (typeof message.content === 'string' && message.content.length > 0) {
    return message.content;
  }

  if (typeof message.reasoning_content === 'string' && message.reasoning_content.length > 0) {
    return message.reasoning_content;
  }

  return undefined;
}

function extractStreamChunkOutput(chunk: OpenAIStreamChunk): string | undefined {
  const choice = chunk.choices?.[0];
  if (!choice) {
    return undefined;
  }

  if (choice.delta) {
    if (typeof choice.delta.content === 'string' && choice.delta.content.length > 0) {
      return choice.delta.content;
    }

    if (typeof choice.delta.reasoning_content === 'string' && choice.delta.reasoning_content.length > 0) {
      return choice.delta.reasoning_content;
    }
  }

  return extractMessageOutput(choice.message);
}

function buildTokenUsage(usage?: OpenAIChatCompletionResponse['usage']) {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens ?? 0,
  };
}

export class LLMDirectRuntime implements AgentRuntime {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: LLMDirectRuntimeConfig) {
    const apiKey = process.env.OPENAGENTS_API_KEY || config.apiKey;
    if (!apiKey) {
      throw new RuntimeError(
        'Missing API key. Please set OPENAGENTS_API_KEY or runtime.api_key in openagents.yaml',
        'runtime',
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = process.env.OPENAGENTS_API_BASE_URL || config.baseUrl || DEFAULT_BASE_URL;
  }

  async execute(params: ExecuteParams): Promise<ExecuteResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutMs = params.timeoutSeconds * 1000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = this.baseUrl;

    // Build initial messages
    const messages: OpenAIMessage[] = [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ];

    try {
      let round = 0;
      let lastResponse: OpenAIChatCompletionResponse | undefined;

      while (round < MAX_TOOL_CALL_ROUNDS) {
        const requestBody: Record<string, unknown> = {
          model: params.model,
          messages,
        };

        // Add tools if provided
        if (params.tools) {
          requestBody.tools = params.tools;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify(requestBody),
        });

        const rawText = await response.text();
        try {
          lastResponse = rawText ? (JSON.parse(rawText) as OpenAIChatCompletionResponse) : undefined;
        } catch {
          lastResponse = undefined;
        }

        if (!response.ok) {
          const detail = lastResponse?.error?.message || `HTTP ${response.status}`;
          throw new RuntimeError(`LLM request failed: ${detail}`, 'runtime', {
            httpStatus: response.status,
            responseBody: normalizeResponseBody(rawText),
          });
        }

        const message = lastResponse?.choices?.[0]?.message;

        // If no tool_calls, return the content
        if (!message?.tool_calls || message.tool_calls.length === 0) {
          const output = extractMessageOutput(message);
          if (!output) {
            throw new RuntimeError(
              'LLM response does not contain a supported output field (message.content or message.reasoning_content)',
              'runtime',
              {
              httpStatus: response.status,
              responseBody: normalizeResponseBody(rawText),
              },
            );
          }

          return {
            output,
            tokensUsed: lastResponse?.usage?.total_tokens,
            tokenUsage: buildTokenUsage(lastResponse?.usage),
            duration: Date.now() - startedAt,
          };
        }

        // Execute tool calls
        if (!params.toolExecutor) {
          throw new RuntimeError('LLM requested tool calls but no toolExecutor was provided', 'runtime');
        }

        const toolResults: OpenAIMessage[] = [];

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

          try {
            const result = await params.toolExecutor(functionName, functionArgs);
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: result,
            });
          } catch (toolError) {
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: toolError instanceof Error ? `Error: ${toolError.message}` : 'Unknown error',
            });
          }
        }

        // Add assistant message and tool results to conversation
        messages.push({
          role: 'assistant',
          content: extractMessageOutput(message),
          tool_calls: message.tool_calls,
        });
        messages.push(...toolResults);

        round++;
      }

      // Max rounds exceeded
      throw new RuntimeError(`Max tool call rounds (${MAX_TOOL_CALL_ROUNDS}) exceeded`, 'runtime');
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RuntimeError(`LLM request timed out after ${params.timeoutSeconds}s`, 'runtime', {
          isTimeout: true,
          timeoutSeconds: params.timeoutSeconds,
        });
      }
      throw new RuntimeError(error instanceof Error ? error.message : 'unknown runtime error', 'runtime', {
        cause: error instanceof Error ? error.message : 'unknown runtime error',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async executeStream(
    params: ExecuteParams,
    onChunk: (chunk: string) => void,
  ): Promise<ExecuteResult> {
    // If tools are provided, fall back to non-streaming to handle tool calls properly
    if (params.tools) {
      const result = await this.execute(params);
      onChunk(result.output);
      return result;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutMs = params.timeoutSeconds * 1000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = this.baseUrl;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const rawText = await response.text();
        let json: OpenAIChatCompletionResponse | undefined;
        try {
          json = rawText ? (JSON.parse(rawText) as OpenAIChatCompletionResponse) : undefined;
        } catch {
          json = undefined;
        }
        const detail = json?.error?.message || `HTTP ${response.status}`;
        throw new RuntimeError(`LLM request failed: ${detail}`, 'runtime', {
          httpStatus: response.status,
          responseBody: normalizeResponseBody(rawText),
        });
      }

      if (!response.body) {
        throw new RuntimeError('LLM response does not have a body', 'runtime');
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      if (!contentType.includes('text/event-stream')) {
        const rawText = await response.text();
        let json: OpenAIChatCompletionResponse | undefined;
        try {
          json = rawText ? (JSON.parse(rawText) as OpenAIChatCompletionResponse) : undefined;
        } catch {
          json = undefined;
        }

        const output = extractMessageOutput(json?.choices?.[0]?.message);
        if (!output) {
          throw new RuntimeError(
            'LLM non-stream response does not contain a supported output field (message.content or message.reasoning_content)',
            'runtime',
            {
              httpStatus: response.status,
              responseBody: normalizeResponseBody(rawText),
            },
          );
        }

        onChunk(output);
        return {
          output,
          tokensUsed: json?.usage?.total_tokens,
          tokenUsage: buildTokenUsage(json?.usage),
          duration: Date.now() - startedAt,
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullOutput = '';
      let usage: OpenAIChatCompletionResponse['usage'] = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data) as OpenAIStreamChunk;
              const content = extractStreamChunkOutput(parsed);
              if (content) {
                fullOutput += content;
                onChunk(content);
              }
              // Some providers send usage in streaming responses
              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch {
              // Ignore parse errors for malformed messages
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk;
            const content = extractStreamChunkOutput(parsed);
            if (content) {
              fullOutput += content;
              onChunk(content);
            }
            if (parsed.usage) {
              usage = parsed.usage;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      return {
        output: fullOutput,
        tokensUsed: usage?.total_tokens,
        tokenUsage: buildTokenUsage(usage),
        duration: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RuntimeError(`LLM request timed out after ${params.timeoutSeconds}s`, 'runtime', {
          isTimeout: true,
          timeoutSeconds: params.timeoutSeconds,
        });
      }
      throw new RuntimeError(error instanceof Error ? error.message : 'unknown runtime error', 'runtime', {
        cause: error instanceof Error ? error.message : 'unknown runtime error',
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
