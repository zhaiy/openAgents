import { spawn } from 'node:child_process';

import { validateCommandPolicy } from '../security/command-policy.js';
import type { ScriptPostProcessorConfig } from '../types/index.js';

interface ScriptPostProcessorOptions {
  cwd: string;
  runId: string;
  workflowId: string;
  stepId: string;
  baseEnv?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_OUTPUT_CHARS = 20000;

function getProcessorName(config: ScriptPostProcessorConfig, index: number): string {
  return config.name?.trim() || `post_processor_${index + 1}`;
}

export async function runScriptPostProcessor(
  input: string,
  config: ScriptPostProcessorConfig,
  index: number,
  options: ScriptPostProcessorOptions,
): Promise<string> {
  const timeoutMs = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const maxOutputChars = config.max_output_chars ?? DEFAULT_MAX_OUTPUT_CHARS;
  const processorName = getProcessorName(config, index);
  const env: NodeJS.ProcessEnv = {
    ...(options.baseEnv ?? process.env),
    OA_RUN_ID: options.runId,
    OA_WORKFLOW_ID: options.workflowId,
    OA_STEP_ID: options.stepId,
    OA_PROCESSOR_NAME: processorName,
  };
  const { executable, args } = validateCommandPolicy(config.command);

  const child = spawn(executable, args, {
    cwd: options.cwd,
    env,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let outputTooLarge = false;

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);

  if (child.stdout) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (!outputTooLarge && stdout.length > maxOutputChars) {
        outputTooLarge = true;
        child.kill('SIGKILL');
      }
    });
  }

  if (child.stderr) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
  }

  if (child.stdin) {
    child.stdin.on('error', () => {
      // Ignore EPIPE and similar write-side errors, process exit is handled by close code.
    });
    child.stdin.end(input, 'utf8');
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  }).finally(() => {
    clearTimeout(timer);
  });

  if (timedOut) {
    throw new Error(`post-processor "${processorName}" timed out after ${timeoutMs}ms`);
  }
  if (outputTooLarge) {
    throw new Error(`post-processor "${processorName}" output exceeded ${maxOutputChars} characters`);
  }
  if (exitCode !== 0) {
    const stderrMessage = stderr.trim();
    throw new Error(
      stderrMessage
        ? `post-processor "${processorName}" exited with code ${exitCode}: ${stderrMessage}`
        : `post-processor "${processorName}" exited with code ${exitCode}`,
    );
  }

  return stdout;
}
