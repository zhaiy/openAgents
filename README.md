# openAgents

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
- Resume from interruption with persisted state (`.state.json`)
- Event logs for auditing (`events.jsonl`)
- Parallel DAG scheduling and configurable retry strategy
- Structured inputs (`--input-json`, `--input-file`) with `{{inputs.xxx}}`
- Script runtime (`runtime.type: script`) for local preprocessing
- Step cache (`workflow.cache` / `step.cache`) and `openagents cache` commands
- Developer tools: `openagents debug template`, `openagents dag`, `openagents validate --verbose`

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
openagents runs list
openagents runs show <run_id>
openagents runs logs <run_id>
openagents agents list
openagents workflows list
openagents debug template <workflow_id> --input-json '{"key":"value"}'
openagents dag <workflow_id>
openagents cache stats
openagents cache clear
```

## Error Recovery

- `on_failure: fail` (default): fail the workflow.
- `on_failure: skip`: mark current step as skipped and continue downstream.
- `on_failure: fallback`: retry with `fallback_agent`.
- `on_failure: notify`: send `notify.webhook` then fail.

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
