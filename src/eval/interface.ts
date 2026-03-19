import type { EvalConfig, EvaluationResult } from '../types/index.js';

export interface EvalParams {
  workflowId: string;
  runId: string;
  input: string;
  stepOutputs: Record<string, string>;
  evalConfig: EvalConfig;
}

export interface Evaluator {
  evaluate(params: EvalParams): Promise<EvaluationResult>;
}

export { EvalConfig, EvaluationResult };
