import type { AgentRuntime, ProjectConfig, RuntimeType } from '../types/index.js';
import { LLMDirectRuntime } from './llm-direct.js';

export function createRuntime(type: RuntimeType, projectConfig: ProjectConfig): AgentRuntime {
  switch (type) {
    case 'llm-direct':
      return new LLMDirectRuntime({
        apiKey: projectConfig.runtime.api_key,
        baseUrl: projectConfig.runtime.api_base_url,
      });
    default:
      throw new Error(`Unsupported runtime type "${type}" in MVP. Only "llm-direct" is available.`);
  }
}
