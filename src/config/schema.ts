import { z } from 'zod';

import type { AgentConfig, CacheConfig, NotifyConfig, OnFailureAction, OutputFileConfig, ProjectConfig, RetryConfig, RuntimeType, StepConfig, WorkflowConfig } from '../types/index.js';

const idRegex = /^[a-z][a-z0-9_-]*$/;

const RuntimeTypeSchema = z.enum(['llm-direct', 'openclaw', 'opencode', 'claude-code', 'script']) satisfies z.ZodType<RuntimeType>;

const RetryConfigSchema = z.object({
  max_attempts: z.number().int().min(0).default(2),
  delay_seconds: z.number().int().min(0).default(5),
}) satisfies z.ZodType<RetryConfig>;

const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().int().min(0).optional(),
  key: z.string().optional(),
}) satisfies z.ZodType<CacheConfig>;

const OnFailureActionSchema = z.enum(['fail', 'skip', 'fallback', 'notify']) satisfies z.ZodType<OnFailureAction>;

const NotifyConfigSchema = z.object({
  webhook: z.string().url().optional(),
}) satisfies z.ZodType<NotifyConfig>;

const OutputFileConfigSchema = z.object({
  step: z.string().regex(idRegex, 'must start with lowercase letter and only contain a-z, 0-9, _ or -'),
  filename: z.string().min(1),
}) satisfies z.ZodType<OutputFileConfig>;

const StepConfigSchemaBase = z.object({
  id: z.string().regex(idRegex, 'must start with lowercase letter and only contain a-z, 0-9, _ or -'),
  agent: z.string().regex(idRegex, 'must start with lowercase letter and only contain a-z, 0-9, _ or -'),
  task: z.string().min(1),
  depends_on: z.array(z.string()).optional(),
  gate: z.enum(['auto', 'approve']).optional(),
  retry: RetryConfigSchema.optional(),
  cache: CacheConfigSchema.optional(),
  on_failure: OnFailureActionSchema.optional(),
  fallback_agent: z.string().regex(idRegex).optional(),
  notify: NotifyConfigSchema.optional(),
}).superRefine((step, ctx) => {
  if (step.on_failure === 'fallback' && !step.fallback_agent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fallback_agent'],
      message: 'fallback_agent is required when on_failure is "fallback"',
    });
  }
  if (step.on_failure === 'notify' && !step.notify?.webhook) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['notify', 'webhook'],
      message: 'notify.webhook is required when on_failure is "notify"',
    });
  }
});

export const StepConfigSchema = StepConfigSchemaBase satisfies z.ZodType<StepConfig>;

export const AgentConfigSchema = z
  .object({
    agent: z.object({
      id: z.string().regex(idRegex, 'must start with lowercase letter and only contain a-z, 0-9, _ or -'),
      name: z.string().min(1),
      description: z.string().min(1),
    }),
    prompt: z.object({
      system: z.string().min(1),
    }),
    runtime: z.object({
      type: RuntimeTypeSchema,
      model: z.string().optional(),
      timeout_seconds: z.number().int().positive().default(300),
    }),
    script: z
      .object({
        file: z.string().optional(),
        inline: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((config, ctx) => {
    if (config.runtime.type === 'script') {
      if (!config.script?.file && !config.script?.inline) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['script'],
          message: 'script agent must have either script.file or script.inline',
        });
      }
    }
  }) satisfies z.ZodType<AgentConfig>;

export const WorkflowConfigSchema = z
  .object({
    workflow: z.object({
      id: z.string().regex(idRegex, 'must start with lowercase letter and only contain a-z, 0-9, _ or -'),
      name: z.string().min(1),
      description: z.string().min(1),
    }),
    steps: z.array(StepConfigSchema).min(1),
    output: z.object({
      directory: z.string().min(1),
      files: z.array(OutputFileConfigSchema).optional(),
    }),
    cache: CacheConfigSchema.optional(),
  })
  .superRefine((workflow, ctx) => {
    const seen = new Set<string>();
    for (const [index, step] of workflow.steps.entries()) {
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'id'],
          message: `duplicate step id: ${step.id}`,
        });
      }
      seen.add(step.id);
    }

    const allStepIds = new Set(workflow.steps.map((step) => step.id));
    for (const [index, step] of workflow.steps.entries()) {
      for (const dependency of step.depends_on ?? []) {
        if (!allStepIds.has(dependency)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', index, 'depends_on'],
            message: `depends_on references unknown step "${dependency}"`,
          });
        }
      }
    }

    // Validate output.files references existing steps
    if (workflow.output.files) {
      for (const [index, fileConfig] of workflow.output.files.entries()) {
        if (!allStepIds.has(fileConfig.step)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['output', 'files', index, 'step'],
            message: `output.files references unknown step "${fileConfig.step}"`,
          });
        }
      }
    }
  }) satisfies z.ZodType<WorkflowConfig>;

export const ProjectConfigSchema = z.object({
  version: z.literal('1'),
  runtime: z.object({
    default_type: RuntimeTypeSchema,
    default_model: z.string().min(1),
    api_key: z.string().optional(),
    api_base_url: z.string().url().optional(),
  }),
  retry: RetryConfigSchema,
  output: z.object({
    base_directory: z.string().min(1).default('./output'),
    preview_lines: z.number().int().min(1).default(10),
  }),
}) satisfies z.ZodType<ProjectConfig>;
