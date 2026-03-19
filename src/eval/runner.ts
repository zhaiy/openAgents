import fs from 'node:fs';
import path from 'node:path';

import type { AgentRuntime, EvaluationResult, ProjectConfig } from '../types/index.js';
import type { EvalParams, Evaluator } from './interface.js';
import { LLMJudgeEvaluator } from './llm-judge.js';

export class EvalRunner {
  constructor(
    private readonly runtimeFactory: (type: 'llm-direct', projectConfig: ProjectConfig) => AgentRuntime,
    private readonly outputBaseDir: string,
    private readonly projectConfig: ProjectConfig,
  ) {}

  async evaluate(params: EvalParams): Promise<EvaluationResult> {
    const evaluator = this.createEvaluator(params.evalConfig);
    return evaluator.evaluate(params);
  }

  private createEvaluator(evalConfig: { type: string; judge_model?: string }): Evaluator {
    if (evalConfig.type === 'llm-judge') {
      const runtime = this.runtimeFactory('llm-direct', this.projectConfig);
      return new LLMJudgeEvaluator(runtime, this.outputBaseDir);
    }

    throw new Error(`Unknown evaluator type: ${evalConfig.type}`);
  }

  loadLastEval(workflowId: string, runId: string): EvaluationResult | undefined {
    const evalPath = path.join(this.outputBaseDir, workflowId, runId, 'eval.json');
    if (!fs.existsSync(evalPath)) {
      return undefined;
    }
    try {
      return JSON.parse(fs.readFileSync(evalPath, 'utf8')) as EvaluationResult;
    } catch {
      return undefined;
    }
  }

  listEvals(workflowId: string): Array<{ runId: string; score: number }> {
    const workflowDir = path.join(this.outputBaseDir, workflowId);
    if (!fs.existsSync(workflowDir)) {
      return [];
    }

    const runs = fs.readdirSync(workflowDir).filter((dir) => dir.startsWith('run_'));
    const evals: Array<{ runId: string; score: number }> = [];

    for (const runId of runs) {
      const evalPath = path.join(workflowDir, runId, 'eval.json');
      if (fs.existsSync(evalPath)) {
        try {
          const eval_ = JSON.parse(fs.readFileSync(evalPath, 'utf8')) as EvaluationResult;
          evals.push({ runId, score: eval_.score });
        } catch {
          // Ignore invalid eval files
        }
      }
    }

    return evals.sort((a, b) => a.runId.localeCompare(b.runId));
  }
}
