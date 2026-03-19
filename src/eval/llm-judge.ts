import fs from 'node:fs';
import path from 'node:path';

import type { AgentRuntime, EvaluationResult } from '../types/index.js';
import type { EvalParams, Evaluator } from './interface.js';

export class LLMJudgeEvaluator implements Evaluator {
  constructor(private readonly runtime: AgentRuntime, private readonly outputBaseDir: string) {}

  async evaluate(params: EvalParams): Promise<EvaluationResult> {
    const { workflowId, runId, input, stepOutputs, evalConfig } = params;
    const startedAt = Date.now();

    const results: Record<string, { score: number; reason: string }> = {};
    let totalTokens = 0;

    for (const dimension of evalConfig.dimensions) {
      const outputContent = Object.values(stepOutputs).join('\n\n---\n\n');

      // Replace {{input}} in dimension prompt
      const processedPrompt = dimension.prompt.replace(/\{\{input\}\}/g, input);

      const evalPrompt = `请评估以下内容。

主题/输入: ${input}

评估维度: ${dimension.name}
${processedPrompt}

待评估内容:
${outputContent}

请以JSON格式返回评分和理由，格式如下：
{
  "score": 0-100的数字评分,
  "reason": "简短的评分理由"
}

请只返回JSON，不要有其他内容。`;

      const result = await this.runtime.execute({
        systemPrompt: '你是一个专业的评估助手。',
        userPrompt: evalPrompt,
        model: evalConfig.judge_model || 'qwen-plus',
        timeoutSeconds: 60,
      });

      if (result.tokenUsage) {
        totalTokens += result.tokenUsage.totalTokens;
      }

      try {
        const parsed = JSON.parse(result.output) as { score: number; reason: string };
        results[dimension.name] = {
          score: Math.min(100, Math.max(0, parsed.score)),
          reason: parsed.reason || '',
        };
      } catch {
        // If parsing fails, try to extract score from text
        const scoreMatch = result.output.match(/(\d+)/);
        const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 50;
        results[dimension.name] = {
          score,
          reason: '评分解析失败，使用默认分数',
        };
      }
    }

    // Calculate weighted score
    let totalWeight = 0;
    let weightedScore = 0;
    for (const dimension of evalConfig.dimensions) {
      const result = results[dimension.name];
      if (result) {
        weightedScore += result.score * dimension.weight;
        totalWeight += dimension.weight;
      }
    }
    const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Try to find last eval result
    const comparedToLast = await this.loadLastEval(workflowId, runId, finalScore);

    const evaluationResult: EvaluationResult = {
      runId,
      workflowId,
      evaluatedAt: new Date().toISOString(),
      score: finalScore,
      dimensions: results,
      tokenCost: totalTokens,
      duration: Date.now() - startedAt,
      comparedToLast,
    };

    // Write eval.json
    const evalPath = path.join(this.outputBaseDir, workflowId, runId, 'eval.json');
    fs.mkdirSync(path.dirname(evalPath), { recursive: true });
    fs.writeFileSync(evalPath, JSON.stringify(evaluationResult, null, 2), 'utf8');

    return evaluationResult;
  }

  private async loadLastEval(
    workflowId: string,
    currentRunId: string,
    currentScore: number,
  ): Promise<EvaluationResult['comparedToLast'] | undefined> {
    const workflowDir = path.join(this.outputBaseDir, workflowId);

    if (!fs.existsSync(workflowDir)) {
      return undefined;
    }

    const runs = fs.readdirSync(workflowDir).filter((dir) => dir.startsWith('run_') && dir !== currentRunId);

    if (runs.length === 0) {
      return undefined;
    }

    // Sort by modification time, newest first
    runs.sort((a, b) => {
      const statA = fs.statSync(path.join(workflowDir, a));
      const statB = fs.statSync(path.join(workflowDir, b));
      return statB.mtimeMs - statA.mtimeMs;
    });

    const lastRunId = runs[0];
    const lastEvalPath = path.join(workflowDir, lastRunId, 'eval.json');

    if (!fs.existsSync(lastEvalPath)) {
      return undefined;
    }

    try {
      const lastEval = JSON.parse(fs.readFileSync(lastEvalPath, 'utf8')) as EvaluationResult;
      return {
        lastRunId,
        lastScore: lastEval.score,
        scoreDelta: currentScore - lastEval.score,
        direction: currentScore > lastEval.score ? 'improved' : currentScore < lastEval.score ? 'declined' : 'unchanged',
      };
    } catch {
      return undefined;
    }
  }
}
