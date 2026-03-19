# OpenAgents

Transparent and controllable multi-agent orchestration engine.

中文文档请查看 `README.zh-CN.md`.

## Core Values

- **Visible**: track workflow progress step by step.
- **Controllable**: inspect and intervene before wasting tokens.
- **Traceable**: outputs and run states are persisted for replay.

## Key Features

- Real-time progress UI in terminal (`ora` + `chalk` + `boxen`)
- Human-in-the-loop gate (`yes/no/edit`) on critical steps
- Gate automation options (`--auto-approve`, `--gate-timeout`)
- Resume from interruption with persisted state (`.state.json`) and `--stream` support
- Event logs for auditing (`events.jsonl`)
- Parallel DAG scheduling and configurable retry strategy
- Structured inputs (`--input-json`, `--input-file`) with `{{inputs.xxx}}`
- Script runtime (`runtime.type: script`) for local preprocessing
- Step post-processors (`step.post_processors`) for user-defined output filtering
- Step cache (`workflow.cache` / `step.cache`) and `openagents cache` commands
- Developer tools: `openagents debug template`, `openagents dag`, `openagents validate --verbose`
- LLM function calling with multi-round tool execution
- Context processing with auto strategy: `raw`, `truncate`, `summarize`
- Workflow evaluation (`openagents eval <run_id>`) with LLM judge
- Skills registry for reusable agent skill definitions

## Quick Start

```bash
npm install
npm run build
npx tsx src/cli/index.ts run novel_writing --input "A time-travel mystery"
```

Initialize a starter project:

```bash
npx tsx src/cli/index.ts init my-project
cd my-project
export OPENAGENTS_API_KEY=sk-xxxx
npx tsx src/cli/index.ts run novel_writing --input "A time-travel mystery"
```

## CLI Commands

```bash
openagents init [directory]
openagents init --list-templates
openagents init [directory] --template <name>
openagents validate
openagents validate --verbose
openagents run <workflow_id> --input "..."
openagents run <workflow_id> --input-json '{"key":"value"}'
openagents run <workflow_id> --input-file ./input.json
openagents run <workflow_id> --auto-approve
openagents resume <run_id>
openagents resume <run_id> --stream
openagents eval <run_id>
openagents runs list
openagents runs show <run_id>
openagents runs logs <run_id>
openagents agents list
openagents workflows list
openagents debug template <workflow_id> --input-json '{"key":"value"}'
openagents dag <workflow_id>
openagents cache stats
openagents cache clear
openagents analyze <workflow_id>
```

## Error Recovery

- `on_failure: fail` (default): fail the workflow.
- `on_failure: skip`: mark current step as skipped and continue downstream.
- `on_failure: fallback`: retry with `fallback_agent`.
- `on_failure: notify`: send `notify.webhook` then fail.

## Step Post-Processors (Script)

Use `post_processors` on a step to transform the step output before it is written and passed downstream.

```yaml
steps:
  - id: load_context
    agent: planner
    task: "Generate a long context"
    post_processors:
      - type: script
        name: shrink_context
        command: node scripts/shrink-context.mjs
        timeout_ms: 5000
        max_output_chars: 20000
        on_error: fail # fail | skip | passthrough
```

Script contract:

- Input: raw step output via `stdin` (UTF-8 text)
- Output: processed content via `stdout`
- Logs: `stderr` is for logging only
- Exit code `0` means success, non-zero means failure
- Available env vars: `OA_RUN_ID`, `OA_WORKFLOW_ID`, `OA_STEP_ID`, `OA_PROCESSOR_NAME`

`on_error` behavior:

- `fail` (default): fail current step.
- `skip`: skip this processor and continue with the current output.
- `passthrough`: stop the processor chain and return original output from the agent.

Best practices:

- Keep scripts idempotent and deterministic; same input should produce same output.
- Keep scripts lightweight; avoid external network dependencies in processing path.
- Prefer `on_error: fail` for strict workflows, `passthrough` for best-effort cleanup.
- Always bound execution with `timeout_ms` and `max_output_chars`.
- Log diagnostics to `stderr`, keep only final transformed payload in `stdout`.
- Treat scripts as trusted code in production and review them like application code.

## Context Processing

When a step depends on output from a previous step, use `context` to control how that output is processed:

```yaml
steps:
  - id: research
    agent: researcher
    task: "Gather information"
  - id: write
    agent: writer
    depends_on: [research]
    context:
      from: research
      strategy: auto      # raw | truncate | summarize | auto
      max_tokens: 1000
      inject_as: system   # system | user
    task: "Write based on: {{context.research}}"
```

Strategies:
- `raw`: pass through the full output
- `truncate`: cut to `max_tokens`
- `summarize`: use LLM to summarize to `max_tokens` (uses English prompts)
- `auto`: automatically select based on content size thresholds

## Workflow Evaluation

Evaluate workflow runs with LLM judge:

```yaml
workflow:
  eval:
    enabled: true
    type: llm-judge
    judge_model: qwen-plus
    dimensions:
      - name: quality
        weight: 1.0
        prompt: "Assess the overall quality of the output"
```

```bash
openagents eval <run_id>
```

Eval results are saved to `eval.json` with `runId`, `workflowId`, `evaluatedAt`, score, and dimension breakdowns.

## Skills Registry

Define reusable skills in `skills/` directory:

```yaml
# skills/math.yaml
skill:
  id: math
  name: Math Helper
  description: Performs mathematical calculations
  version: 1.0

instructions: |
  You are a math assistant. Calculate precisely and show work.

output_format: Return JSON with "result" and "steps" fields.
```

Skills are injected into agent context as `{{skills.skillId.instructions}}`.

Multi-processor chain example:

```yaml
steps:
  - id: load_context
    agent: planner
    task: "Generate context data"
    post_processors:
      - type: script
        name: normalize
        command: node scripts/post-processors/normalize-output.mjs
        on_error: fail
      - type: script
        name: trim
        command: node scripts/post-processors/trim-context.mjs
        timeout_ms: 3000
        max_output_chars: 8000
        on_error: passthrough
```

## Project Layout

- `src/cli`: CLI commands and entrypoint.
- `src/config`: YAML loading and schema validation.
- `src/engine`: DAG parsing, scheduling, template rendering, workflow execution.
- `src/runtime`: runtime interface and implementations (`llm-direct`, `script`).
- `src/output`: local output writer.
- `src/i18n`: English/Chinese message catalogs (default: English).
- `templates`: starter project templates.

## Internationalization

- Supported languages: `en`, `zh`.
- Default language: `en`.
- Language priority:
  - `--lang`
  - `OPENAGENTS_LANG`
  - fallback `en`

Examples:

```bash
npx tsx src/cli/index.ts --lang zh run novel_writing --input "悬疑故事"
OPENAGENTS_LANG=zh npx tsx src/cli/index.ts run novel_writing --input "悬疑故事"
```

## Documentation

- Product requirements: `docs/PRD-v3.md`
- Technical design and development plan: `docs/TECHNICAL-DESIGN.md`
- Chinese README: `README.zh-CN.md`

## License

MIT
