# openAgents（中文文档）

透明可控的多 Agent 协作编排引擎。

主文档（英文）请查看 `README.md`。

## 核心价值

- **看得见**：工作流执行过程逐步可视化。
- **管得住**：关键节点可审核、可中断、可恢复。
- **查得到**：输出和运行状态持久化，便于回溯。

## 核心能力

- 终端实时进度 UI（`ora` + `chalk` + `boxen`）
- 关键节点人工审核门控（`yes/no/edit`）
- 中断后基于状态文件恢复（`.state.json`）
- 事件日志追踪与审计（`events.jsonl`）
- DAG 并行调度与可配置重试机制

## 快速开始

```bash
npm install
npm run build
npx tsx src/cli/index.ts run novel_writing --input "一个时间旅行悬疑故事"
```

初始化示例项目：

```bash
npx tsx src/cli/index.ts init my-project
cd my-project
export OPENAGENTS_API_KEY=sk-xxxx
npx tsx src/cli/index.ts run novel_writing --input "一个时间旅行悬疑故事"
```

## CLI 命令

```bash
openagents init [directory]
openagents validate
openagents run <workflow_id> --input "..."
openagents resume <run_id>
openagents runs list
openagents runs show <run_id>
openagents runs logs <run_id>
openagents agents list
openagents workflows list
```

## 项目结构

- `src/cli`：CLI 入口与子命令实现
- `src/config`：YAML 加载与 schema 校验
- `src/engine`：DAG 解析、调度、模板渲染、工作流执行
- `src/runtime`：运行时接口与 `llm-direct` 实现
- `src/output`：输出文件与事件日志
- `src/i18n`：中英文文案
- `templates`：`init` 命令生成的项目模板

## 多语言支持

- 支持语言：`en`、`zh`
- 默认语言：`en`
- 语言优先级：
  - `--lang`
  - `OPENAGENTS_LANG`
  - fallback `en`

示例：

```bash
npx tsx src/cli/index.ts --lang zh run novel_writing --input "悬疑故事"
OPENAGENTS_LANG=zh npx tsx src/cli/index.ts run novel_writing --input "悬疑故事"
```

## 文档

- 产品需求文档：`docs/PRD-v3.md`
- 技术设计与开发计划：`docs/TECHNICAL-DESIGN.md`
- 英文主文档：`README.md`

## 许可证

MIT
