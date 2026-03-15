export class OpenAgentsError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = 'OpenAgentsError';
  }
}

export class ConfigError extends OpenAgentsError {
  constructor(message: string, public filePath?: string, public line?: number) {
    super(message, 1);
    this.name = 'ConfigError';
  }
}

export class DAGError extends OpenAgentsError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'DAGError';
  }
}

export interface RuntimeErrorDetails {
  httpStatus?: number;
  responseBody?: string;
  isTimeout?: boolean;
  timeoutSeconds?: number;
  cause?: string;
}

export class RuntimeError extends OpenAgentsError {
  constructor(message: string, public stepId: string, public details?: RuntimeErrorDetails) {
    super(message, 2);
    this.name = 'RuntimeError';
  }
}

export class GateRejectError extends OpenAgentsError {
  constructor(public stepId: string) {
    super(`用户在节点 "${stepId}" 的审核门控处终止了工作流`, 0);
    this.name = 'GateRejectError';
  }
}
