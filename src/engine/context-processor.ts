import type { AgentRuntime, ContextStrategy } from '../types/index.js';

export interface ProcessContextParams {
  rawContent: string;
  strategy: ContextStrategy;
  maxTokens?: number;
  autoThresholds?: { rawLimit: number; truncateLimit: number };
  summarizeRuntime?: AgentRuntime;
  summarizeModel?: string;
}

const DEFAULT_AUTO_THRESHOLDS = {
  rawLimit: 500,
  truncateLimit: 2000,
};

const CHARS_PER_TOKEN = 4;

export async function processContext(params: ProcessContextParams): Promise<string> {
  const {
    rawContent,
    strategy,
    maxTokens,
    autoThresholds = DEFAULT_AUTO_THRESHOLDS,
    summarizeRuntime,
    summarizeModel,
  } = params;

  // Determine actual strategy (handle 'auto')
  const actualStrategy = strategy === 'auto' ? resolveAutoStrategy(rawContent, autoThresholds) : strategy;

  switch (actualStrategy) {
    case 'raw':
      return rawContent;

    case 'truncate': {
      const targetChars = (maxTokens ?? 500) * CHARS_PER_TOKEN;
      if (rawContent.length <= targetChars) {
        return rawContent;
      }
      return rawContent.slice(0, targetChars);
    }

    case 'summarize': {
      if (!summarizeRuntime || !summarizeModel) {
        throw new Error('summarize strategy requires summarizeRuntime and summarizeModel');
      }
      const targetTokens = maxTokens ?? 500;
      const summarizePrompt = `Summarize the following content into a summary of no more than ${targetTokens} tokens, preserving key information:

${rawContent}

Please output the summary directly without additional explanations.`;

      const result = await summarizeRuntime.execute({
        systemPrompt: 'You are a text summarization assistant.',
        userPrompt: summarizePrompt,
        model: summarizeModel,
        timeoutSeconds: 60,
      });

      return result.output;
    }

    default:
      return rawContent;
  }
}

function resolveAutoStrategy(
  rawContent: string,
  thresholds: { rawLimit: number; truncateLimit: number },
): Exclude<ContextStrategy, 'auto'> {
  // Estimate token count
  const estimatedTokens = rawContent.length / CHARS_PER_TOKEN;

  if (estimatedTokens <= thresholds.rawLimit) {
    return 'raw';
  }

  if (estimatedTokens <= thresholds.truncateLimit) {
    return 'truncate';
  }

  return 'summarize';
}
