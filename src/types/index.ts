export type RuntimeType = 'llm-direct' | 'openclaw' | 'opencode' | 'claude-code';

export interface AgentConfig {
  agent: {
    id: string;
    name: string;
    description: string;
  };
  prompt: {
    system: string;
  };
  runtime: {
    type: RuntimeType;
    model: string;
    timeout_seconds: number;
  };
}

export interface RetryConfig {
  max_attempts: number;
  delay_seconds: number;
}

export type GateType = 'auto' | 'approve';

export interface StepConfig {
  id: string;
  agent: string;
  task: string;
  depends_on?: string[];
  gate?: GateType;
  retry?: RetryConfig;
}

export interface WorkflowConfig {
  workflow: {
    id: string;
    name: string;
    description: string;
  };
  steps: StepConfig[];
  output: {
    directory: string;
  };
}

export interface ProjectConfig {
  version: string;
  runtime: {
    default_type: RuntimeType;
    default_model: string;
    api_key?: string;
    api_base_url?: string;
  };
  retry: RetryConfig;
  output: {
    base_directory: string;
    preview_lines: number;
  };
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'interrupted' | 'skipped';
export type RunStatus = 'running' | 'completed' | 'failed' | 'interrupted';

export interface StepState {
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  outputFile?: string;
  error?: string;
  retryCount?: number;
}

export interface RunState {
  runId: string;
  workflowId: string;
  status: RunStatus;
  input: string;
  startedAt: number;
  completedAt?: number;
  steps: Record<string, StepState>;
}

export type EventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.interrupted'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.retrying'
  | 'gate.waiting'
  | 'gate.approved'
  | 'gate.rejected'
  | 'gate.edited';

export interface LogEvent {
  ts: number;
  event: EventType;
  data: Record<string, unknown>;
}

export interface DAGNode {
  id: string;
  dependencies: string[];
}

export interface ExecutionPlan {
  nodes: DAGNode[];
  order: string[];
  parallelGroups: string[][];
}

export interface ExecuteParams {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  timeoutSeconds: number;
}

export interface ExecuteResult {
  output: string;
  tokensUsed?: number;
  duration: number;
}

export interface AgentRuntime {
  execute(params: ExecuteParams): Promise<ExecuteResult>;
}
