import { z } from 'zod';

import type { AgentConfig, ProjectConfig, RetryConfig, RuntimeType, StepConfig, WorkflowConfig } from '../types/index.js';

const idRegex = /^[a-z][a-z0-9_-]*$/;

const RuntimeTypeSchema = z.enum(['llm-direct', 'openclaw', 'opencode', 'claude-code']) satisfies z.ZodType<RuntimeType>;

const RetryConfigSchema = z.object({
  max_attempts: z.number().int().min(0).default(2),
  delay_seconds: z.number().int().min(0).default(5),
}) satisfies z.ZodType<RetryConfig>;

const StepConfigSchemaBase = z.object({
  id: z.string().regex(idRegex, 'must start with lowercase letter and only contain a-z, 0-9, _ or -'),
  agent: z.string().regex(idRegex, 'must start with lowercase letter and only contain a-z, 0-9, _ or -'),
  task: z.string().min(1),
  depends_on: z.array(z.string()).optional(),
  gate: z.enum(['auto', 'approve']).optional(),
  retry: RetryConfigSchema.optional(),
});

export const StepConfigSchema = StepConfigSchemaBase satisfies z.ZodType<StepConfig>;

export const AgentConfigSchema = z.object({
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
    model: z.string().min(1),
    timeout_seconds: z.number().int().positive().default(300),
  }),
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
    }),
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
