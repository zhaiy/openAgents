import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { AgentRuntime, EvalConfig, EvaluationResult } from '../types/index.js';
import { LLMJudgeEvaluator } from '../eval/llm-judge.js';
import type { EvalParams } from '../eval/interface.js';

// Mock LLM runtime for testing
const createMockRuntime = (responses: Array<{ output: string; tokenUsage?: { totalTokens: number } }>) => {
  let callCount = 0;
  return {
    execute: vi.fn(async () => {
      const response = responses[callCount % responses.length];
      callCount++;
      return {
        output: response.output,
        tokensUsed: response.tokenUsage?.totalTokens,
        tokenUsage: response.tokenUsage,
        duration: 100,
      };
    }),
  } as unknown as AgentRuntime;
};

describe('LLMJudgeEvaluator', () => {
  const testOutputDir = path.join('/tmp', 'openagents-eval-test', Date.now().toString());

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up test directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  describe('evaluate', () => {
    it('correctly calculates weighted score from mock LLM responses', async () => {
      const mockRuntime = createMockRuntime([
        { output: '{"score": 80, "reason": "内容相关性好"}', tokenUsage: { totalTokens: 100 } },
        { output: '{"score": 90, "reason": "结构清晰"}', tokenUsage: { totalTokens: 80 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        judge_model: 'test-model',
        dimensions: [
          { name: 'relevance', weight: 0.6, prompt: '评估相关性' },
          { name: 'coherence', weight: 0.4, prompt: '评估连贯性' },
        ],
      };

      const params: EvalParams = {
        workflowId: 'test-workflow',
        runId: 'run_001',
        input: '测试输入',
        stepOutputs: { step1: '输出内容1', step2: '输出内容2' },
        evalConfig,
      };

      const result = await evaluator.evaluate(params);

      // Weighted score: 80 * 0.6 + 90 * 0.4 = 48 + 36 = 84
      expect(result.score).toBe(84);
      expect(result.dimensions.relevance.score).toBe(80);
      expect(result.dimensions.coherence.score).toBe(90);
      expect(result.tokenCost).toBe(180);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('writes eval.json to output directory', async () => {
      const mockRuntime = createMockRuntime([
        { output: '{"score": 75, "reason": "评分理由"}', tokenUsage: { totalTokens: 50 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        dimensions: [{ name: 'quality', weight: 1.0, prompt: '评估质量' }],
      };

      const params: EvalParams = {
        workflowId: 'test-workflow',
        runId: 'run_002',
        input: '测试输入',
        stepOutputs: { step1: '内容' },
        evalConfig,
      };

      await evaluator.evaluate(params);

      const evalPath = path.join(testOutputDir, 'test-workflow', 'run_002', 'eval.json');
      expect(fs.existsSync(evalPath)).toBe(true);

      const savedEval = JSON.parse(fs.readFileSync(evalPath, 'utf8')) as EvaluationResult;
      expect(savedEval.score).toBe(75);
      expect(savedEval.runId).toBe('run_002');
      expect(savedEval.workflowId).toBe('test-workflow');
      expect(savedEval.evaluatedAt).toBeDefined();
    });

    it('calculates comparedToLast when previous eval exists', async () => {
      // Create previous run's eval first
      const prevEvalDir = path.join(testOutputDir, 'test-workflow', 'run_000');
      fs.mkdirSync(prevEvalDir, { recursive: true });
      const prevEval: EvaluationResult = {
        runId: 'run_000',
        workflowId: 'test-workflow',
        evaluatedAt: new Date().toISOString(),
        score: 70,
        dimensions: { quality: { score: 70, reason: '还行' } },
        tokenCost: 100,
        duration: 500,
      };
      fs.writeFileSync(path.join(prevEvalDir, 'eval.json'), JSON.stringify(prevEval, null, 2));

      const mockRuntime = createMockRuntime([
        { output: '{"score": 85, "reason": "显著提升"}', tokenUsage: { totalTokens: 50 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        dimensions: [{ name: 'quality', weight: 1.0, prompt: '评估质量' }],
      };

      const params: EvalParams = {
        workflowId: 'test-workflow',
        runId: 'run_001',
        input: '测试输入',
        stepOutputs: { step1: '内容' },
        evalConfig,
      };

      const result = await evaluator.evaluate(params);

      expect(result.comparedToLast).toBeDefined();
      expect(result.comparedToLast!.lastRunId).toBe('run_000');
      expect(result.comparedToLast!.lastScore).toBe(70);
      expect(result.comparedToLast!.scoreDelta).toBe(15); // 85 - 70
      expect(result.comparedToLast!.direction).toBe('improved');
    });

    it('returns undefined comparedToLast when no previous eval exists', async () => {
      const mockRuntime = createMockRuntime([
        { output: '{"score": 80, "reason": "首次评估"}', tokenUsage: { totalTokens: 50 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        dimensions: [{ name: 'quality', weight: 1.0, prompt: '评估质量' }],
      };

      const params: EvalParams = {
        workflowId: 'new-workflow',
        runId: 'run_first',
        input: '测试输入',
        stepOutputs: { step1: '内容' },
        evalConfig,
      };

      const result = await evaluator.evaluate(params);

      expect(result.comparedToLast).toBeUndefined();
    });

    it('handles LLM response with declining score', async () => {
      // Create previous run's eval
      const prevEvalDir = path.join(testOutputDir, 'test-workflow', 'run_old');
      fs.mkdirSync(prevEvalDir, { recursive: true });
      const prevEval: EvaluationResult = {
        score: 90,
        dimensions: { quality: { score: 90, reason: '很好' } },
        tokenCost: 100,
        duration: 500,
      };
      fs.writeFileSync(path.join(prevEvalDir, 'eval.json'), JSON.stringify(prevEval, null, 2));

      const mockRuntime = createMockRuntime([
        { output: '{"score": 75, "reason": "略有下降"}', tokenUsage: { totalTokens: 50 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        dimensions: [{ name: 'quality', weight: 1.0, prompt: '评估质量' }],
      };

      const params: EvalParams = {
        workflowId: 'test-workflow',
        runId: 'run_new',
        input: '测试输入',
        stepOutputs: { step1: '内容' },
        evalConfig,
      };

      const result = await evaluator.evaluate(params);

      expect(result.comparedToLast).toBeDefined();
      expect(result.comparedToLast!.scoreDelta).toBe(-15); // 75 - 90
      expect(result.comparedToLast!.direction).toBe('declined');
    });

    it('handles JSON parse failure gracefully', async () => {
      const mockRuntime = createMockRuntime([
        { output: '这是无效的JSON响应', tokenUsage: { totalTokens: 50 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        dimensions: [{ name: 'quality', weight: 1.0, prompt: '评估质量' }],
      };

      const params: EvalParams = {
        workflowId: 'test-workflow',
        runId: 'run_bad_json',
        input: '测试输入',
        stepOutputs: { step1: '内容' },
        evalConfig,
      };

      const result = await evaluator.evaluate(params);

      // Should use default score (50) when JSON parsing fails
      expect(result.score).toBe(50);
      expect(result.dimensions.quality.reason).toBe('评分解析失败，使用默认分数');
    });

    it('clamps scores to 0-100 range', async () => {
      const mockRuntime = createMockRuntime([
        { output: '{"score": 150, "reason": "超出范围"}', tokenUsage: { totalTokens: 50 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        dimensions: [{ name: 'quality', weight: 1.0, prompt: '评估质量' }],
      };

      const params: EvalParams = {
        workflowId: 'test-workflow',
        runId: 'run_clamp',
        input: '测试输入',
        stepOutputs: { step1: '内容' },
        evalConfig,
      };

      const result = await evaluator.evaluate(params);

      expect(result.dimensions.quality.score).toBe(100); // Clamped to max
    });

    it('uses default judge_model when not specified', async () => {
      const mockRuntime = createMockRuntime([
        { output: '{"score": 80, "reason": "理由"}', tokenUsage: { totalTokens: 50 } },
      ]);

      const evaluator = new LLMJudgeEvaluator(mockRuntime, testOutputDir);

      const evalConfig: EvalConfig = {
        enabled: true,
        type: 'llm-judge',
        // No judge_model specified
        dimensions: [{ name: 'quality', weight: 1.0, prompt: '评估质量' }],
      };

      const params: EvalParams = {
        workflowId: 'test-workflow',
        runId: 'run_default_model',
        input: '测试输入',
        stepOutputs: { step1: '内容' },
        evalConfig,
      };

      await evaluator.evaluate(params);

      // Should have called execute with default model 'qwen-plus'
      expect(mockRuntime.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'qwen-plus',
        }),
      );
    });
  });
});
