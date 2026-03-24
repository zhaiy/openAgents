# OpenAgents 二期开发计划

> 基于 [FEATURE-ROADMAP.md](./FEATURE-ROADMAP.md) 细化
> 创建时间：2026-03-16
> 代码库版本：v0.1.0（约 3000 LOC，含测试）

---

## 目录

- [总体说明](#总体说明)
- [Phase 1：核心功能（第 1 周）](#phase-1核心功能第-1-周)
  - [Task 1.1：.env 自动加载](#task-11env-自动加载)
  - [Task 1.2：Gate 自动通过选项](#task-12gate-自动通过选项)
  - [Task 1.3：输入参数系统](#task-13输入参数系统)
- [Phase 2：体验优化（第 2-3 周）](#phase-2体验优化第-2-3-周)
  - [Task 2.1：进度显示增强（Token 统计与成本估算）](#task-21进度显示增强token-统计与成本估算)
  - [Task 2.2：输出文件命名自定义](#task-22输出文件命名自定义)
  - [Task 2.3：Script Runtime](#task-23script-runtime)
- [Phase 3：开发者体验 + 架构改进（第 4-6 周）](#phase-3开发者体验--架构改进第-4-6-周)
  - [Task 3.1：模板调试命令](#task-31模板调试命令)
  - [Task 3.2：DAG 可视化命令](#task-32dag-可视化命令)
  - [Task 3.3：配置验证增强](#task-33配置验证增强)
  - [Task 3.4：步骤输出缓存](#task-34步骤输出缓存)
  - [Task 3.5：错误恢复策略](#task-35错误恢复策略)
- [Phase 4：生态建设（长期）](#phase-4生态建设长期)
- [附录：任务依赖关系](#附录任务依赖关系)
- [附录：AI Agent 开发指南](#附录ai-agent-开发指南)

---

## 总体说明

### 开发原则

1. **向后兼容**：所有改动不得破坏现有 YAML 配置和 CLI 用法
2. **测试先行**：每个 Task 必须附带单元测试，`npm test` 全量通过
3. **渐进式**：每个 Task 为独立可合并的原子变更，互不阻塞
4. **类型安全**：所有新增接口必须有 TypeScript 类型定义和 Zod Schema

### 当前代码库关键文件索引

| 文件 | 职责 | 行数 |
|------|------|------|
| `src/cli/index.ts` | CLI 入口，注册所有子命令 | 32 |
| `src/cli/run.ts` | `run` 命令，接受 `--input` 参数 | 42 |
| `src/cli/shared.ts` | `buildAppContext()` 构建依赖注入 | 73 |
| `src/engine/workflow-engine.ts` | 核心引擎，编排 DAG 执行 | 343 |
| `src/engine/template.ts` | 模板渲染，`{{variable}}` 替换 | 56 |
| `src/engine/gate.ts` | Gate 审批逻辑（readline 交互） | 58 |
| `src/engine/dag.ts` | DAG 解析（拓扑排序 + 并行分组） | 73 |
| `src/engine/scheduler.ts` | 按 parallelGroups 调度执行 | 40 |
| `src/engine/state.ts` | 状态持久化（`.state.json`） | 205 |
| `src/config/schema.ts` | Zod Schema 定义 | 93 |
| `src/config/loader.ts` | YAML 配置加载 | 125 |
| `src/types/index.ts` | TypeScript 接口定义 | 131 |
| `src/runtime/factory.ts` | RuntimeFactory（仅 `llm-direct`） | 14 |
| `src/runtime/llm-direct.ts` | OpenAI 兼容 LLM 调用 | 118 |
| `src/output/writer.ts` | 步骤输出文件写入 | 20 |
| `src/ui/progress.ts` | 终端进度 UI（ora + chalk + boxen） | 140 |

---

## Phase 1：核心功能（第 1 周）

> 目标：解决最高频的痛点，提升日常开发效率

### Task 1.1：.env 自动加载

**预估工时**：0.5 天
**优先级**：🟡 中 | **复杂度**：低

#### 需求描述

项目目录下的 `.env` 文件应自动加载环境变量（`OPENAGENTS_API_KEY`、`OPENAGENTS_API_BASE_URL` 等），无需在 `openagents.yaml` 中硬编码敏感信息。

#### 实现规格

**Step 1：安装依赖**

```bash
npm install dotenv
```

**Step 2：修改 `src/cli/index.ts`**

在文件最顶部（`#!/usr/bin/env node` 之后、所有 import 之前），添加 dotenv 加载逻辑：

```typescript
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// 按优先级加载：.env.local > .env.{NODE_ENV} > .env
const envFiles = ['.env.local', `.env.${process.env.NODE_ENV || 'development'}`, '.env'];
for (const file of envFiles) {
  loadEnv({ path: path.resolve(process.cwd(), file) });
}
```

**注意**：`dotenv` 默认不覆盖已存在的环境变量，优先级为：系统环境变量 > `.env.local` > `.env.{NODE_ENV}` > `.env`。

**Step 3：（可选）添加 `--env-file` CLI 选项**

在全局 program 选项中增加：

```typescript
// src/cli/index.ts
program.option('--env-file <path>', 'Path to .env file');
```

在 dotenv 加载逻辑中检查该选项并优先加载指定文件。

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `package.json` | 新增 `dotenv` 依赖 |
| `src/cli/index.ts` | 添加 dotenv 加载逻辑（约 +10 行） |

#### 测试要求

新建 `src/__tests__/env-loading.test.ts`：

1. **测试 .env 文件加载**：创建临时 `.env` 文件，验证 `process.env` 中对应变量被设置
2. **测试优先级**：系统环境变量不被 `.env` 覆盖
3. **测试文件不存在**：`.env` 不存在时不报错

#### 验收标准

```bash
# 项目目录放置 .env
echo "OPENAGENTS_API_KEY=sk-test-123" > .env

# 运行时自动识别
openagents run novel_writing --input "test"
# → 无需在 openagents.yaml 中配置 api_key
```

---

### Task 1.2：Gate 自动通过选项

**预估工时**：1.5 天
**优先级**：🟡 中 | **复杂度**：低

#### 需求描述

支持 CLI 选项跳过 Gate 人工审批，便于测试、CI/CD 场景。

#### 实现规格

**Step 1：定义 Gate 选项类型**

```typescript
// src/types/index.ts — 新增
export interface GateOptions {
  autoApprove?: boolean;
  gateTimeoutSeconds?: number;
}
```

**Step 2：扩展 CLI 参数**

修改 `src/cli/run.ts`：

```typescript
// RunOptions 新增字段
interface RunOptions {
  input: string;
  lang?: string;
  autoApprove?: boolean;     // 新增
  gateTimeout?: string;      // 新增（CLI 传入为字符串）
}

// 命令定义中新增选项
.option('--auto-approve', 'Auto-approve all gates')
.option('--gate-timeout <seconds>', 'Auto-approve gate after N seconds of inactivity')
```

**Step 3：传递 Gate 选项到引擎**

修改 `src/cli/shared.ts` 中 `buildAppContext()`，使 `GateManager` 能接收 gate 选项。

方案 A（推荐）：让 `engine.run()` 接受一个 options 参数：

```typescript
// src/engine/workflow-engine.ts
async run(workflowId: string, input: string, options?: { gateOptions?: GateOptions }): Promise<RunState>
```

在 `executeStepCore` 中传给 `gateManager.handleGate()`。

方案 B：在构造 `GateManager` 时传入选项。

**Step 4：修改 `src/engine/gate.ts`**

```typescript
export class GateManager {
  constructor(
    private readonly locale: Locale = getDefaultLocale(),
    private readonly options: GateOptions = {},
  ) {}

  async handleGate(stepId: string, gateType: GateType, output: string): Promise<GateDecision> {
    if (gateType !== 'approve') {
      return { action: 'continue' };
    }

    // 自动通过模式
    if (this.options.autoApprove) {
      return { action: 'continue' };
    }

    // 超时自动通过模式
    if (this.options.gateTimeoutSeconds && this.options.gateTimeoutSeconds > 0) {
      return this.handleGateWithTimeout(stepId, output, this.options.gateTimeoutSeconds);
    }

    // 原有交互逻辑...
  }

  private async handleGateWithTimeout(
    stepId: string,
    output: string,
    timeoutSeconds: number,
  ): Promise<GateDecision> {
    // 使用 Promise.race：readline 输入 vs setTimeout 自动通过
  }
}
```

**Step 5：同步支持 `resume` 命令**

`src/cli/resume.ts` 也需要添加 `--auto-approve` 和 `--gate-timeout` 选项。

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/types/index.ts` | 新增 `GateOptions` 接口（+4 行） |
| `src/cli/run.ts` | 新增 CLI 选项，传递 gateOptions（+10 行） |
| `src/cli/resume.ts` | 同上（+10 行） |
| `src/cli/shared.ts` | `buildAppContext()` 接受 gateOptions 参数（+5 行） |
| `src/engine/gate.ts` | 支持 autoApprove、timeout（+30 行） |
| `src/engine/workflow-engine.ts` | `run()/resume()` 签名扩展，透传 gateOptions（+10 行） |

#### 测试要求

修改 `src/__tests__/gate.test.ts`，新增：

1. **autoApprove 测试**：`GateManager({ autoApprove: true })` 构造时，`approve` 类型直接返回 `{ action: 'continue' }`
2. **timeout 测试**：mock `setTimeout`，验证超时后自动返回 `{ action: 'continue' }`
3. **兼容性测试**：不传 options 时行为与当前完全一致

#### 验收标准

```bash
openagents run novel_writing --input "test" --auto-approve
# → 所有 approve gate 自动通过，无交互等待

openagents run novel_writing --input "test" --gate-timeout 30
# → approve gate 等待 30s，无操作则自动通过
```

---

### Task 1.3：输入参数系统

**预估工时**：3 天
**优先级**：🔴 高 | **复杂度**：中
**前置依赖**：无（但建议在 Task 1.1 之后，可使用 .env 中的 API key 调试）

#### 需求描述

支持结构化 JSON 输入，模板中可通过 `{{inputs.xxx}}` 访问具体字段，同时保持 `{{input}}` 向后兼容。

#### 实现规格

**Step 1：扩展类型定义**

```typescript
// src/types/index.ts — 修改 TemplateContext 相关
// 注意：TemplateContext 定义在 src/engine/template.ts 中，不在 types/index.ts

// src/types/index.ts — 修改 RunState
export interface RunState {
  runId: string;
  workflowId: string;
  status: RunStatus;
  input: string;
  inputData?: Record<string, unknown>;   // 新增：结构化输入
  startedAt: number;
  completedAt?: number;
  steps: Record<string, StepState>;
}
```

**Step 2：扩展 CLI 参数解析**

修改 `src/cli/run.ts`：

```typescript
interface RunOptions {
  input?: string;              // 改为可选
  inputJson?: string;          // 新增
  inputFile?: string;          // 新增
  lang?: string;
  autoApprove?: boolean;
  gateTimeout?: string;
}

// 命令定义
.option('-i, --input <text>', '...')       // 保留，改为非 required
.option('--input-json <json>', 'Structured JSON input')
.option('--input-file <path>', 'Path to JSON input file')
```

解析逻辑：

```typescript
function parseInput(options: RunOptions): { input: string; inputData?: Record<string, unknown> } {
  if (options.inputJson) {
    const data = JSON.parse(options.inputJson);
    return { input: JSON.stringify(data), inputData: data };
  }
  if (options.inputFile) {
    const content = fs.readFileSync(options.inputFile, 'utf8');
    const data = JSON.parse(content);
    return { input: JSON.stringify(data), inputData: data };
  }
  if (options.input) {
    return { input: options.input };
  }
  throw new Error('Must provide --input, --input-json, or --input-file');
}
```

**Step 3：扩展模板引擎**

修改 `src/engine/template.ts`：

```typescript
interface TemplateContext {
  input: string;
  inputs?: Record<string, unknown>;     // 新增
  steps: Record<string, { outputFile?: string }>;
  workflowId: string;
  runId: string;
  runDir: string;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_match, rawExpr: string) => {
    const expr = rawExpr.trim();

    if (expr === 'input') {
      return context.input;
    }

    // 新增：{{inputs.xxx}} 支持，含嵌套属性（如 inputs.meta.author）
    if (expr.startsWith('inputs.') && context.inputs) {
      const keyPath = expr.slice('inputs.'.length);
      const value = resolveNestedValue(context.inputs, keyPath);
      if (value === undefined) {
        throw new Error(`Cannot resolve template variable {{${expr}}}: key "${keyPath}" not found in inputs`);
      }
      return String(value);
    }

    // ...保留现有逻辑...
  });
}

function resolveNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
```

**Step 4：引擎适配**

修改 `src/engine/workflow-engine.ts`：

```typescript
// run() 方法签名扩展
async run(
  workflowId: string,
  input: string,
  options?: {
    inputData?: Record<string, unknown>;
    gateOptions?: GateOptions;
  },
): Promise<RunState>

// initRun 时保存 inputData
const state = this.deps.stateManager.initRun(runId, workflow.workflow.id, input, plan.order);
if (options?.inputData) {
  state.inputData = options.inputData;
  this.deps.stateManager.save(state);  // 持久化结构化输入
}

// executeStepCore 中渲染模板时传入 inputs
const renderedPrompt = renderTemplate(step.task, {
  input: state.input,
  inputs: state.inputData,    // 新增
  workflowId: workflow.workflow.id,
  runId: state.runId,
  runDir,
  steps: Object.fromEntries(
    Object.entries(state.steps).map(([stepId, stepState]) => [stepId, { outputFile: stepState.outputFile }]),
  ),
});
```

**Step 5：状态持久化兼容**

修改 `src/engine/state.ts`，确保 `inputData` 在序列化/反序列化时正确处理。`resume` 时从 `.state.json` 中恢复 `inputData`。

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/types/index.ts` | `RunState` 新增 `inputData` 字段（+1 行） |
| `src/cli/run.ts` | 新增 `--input-json`、`--input-file`，解析逻辑（+30 行） |
| `src/engine/template.ts` | `TemplateContext` 新增 `inputs`，实现 `resolveNestedValue()`（+25 行） |
| `src/engine/workflow-engine.ts` | `run()` 签名扩展，透传 `inputs` 到模板（+15 行） |
| `src/engine/state.ts` | `initRun()` 保存 `inputData`（+5 行） |

#### 测试要求

修改 `src/__tests__/template.test.ts`，新增：

1. **基础 inputs 测试**：`{{inputs.name}}` → 正确替换
2. **嵌套属性测试**：`{{inputs.meta.author}}` → 正确替换
3. **缺失 key 测试**：`{{inputs.nonexist}}` → 抛出明确错误
4. **数字类型测试**：`{{inputs.chapter}}` 值为 `4` → 替换为 `"4"`
5. **兼容性测试**：不传 `inputs` 时，`{{input}}` 依旧正常工作
6. **input-json CLI 测试**：验证 JSON 字符串正确解析

#### 验收标准

```bash
# 结构化输入
openagents run novel_writing --input-json '{"novel_name":"新笔仙","chapter":4,"context_chapters":3}'

# 文件输入
echo '{"novel_name":"新笔仙","chapter":4}' > input.json
openagents run novel_writing --input-file input.json

# 旧语法兼容
openagents run novel_writing --input "续写第四章"

# workflow 模板中 {{inputs.novel_name}} 渲染为"新笔仙"，{{inputs.chapter}} 渲染为 "4"
```

---

## Phase 2：体验优化（第 2-3 周）

> 目标：提升运行时体验，增加可观测性

### Task 2.1：进度显示增强（Token 统计与成本估算）

**预估工时**：3 天
**优先级**：🟢 低 | **复杂度**：中

#### 需求描述

运行结束后展示每步耗时、token 用量、成本估算汇总。

#### 实现规格

**Step 1：扩展 `ExecuteResult` 类型**

```typescript
// src/types/index.ts
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
}

export interface ExecuteResult {
  output: string;
  tokensUsed?: number;       // 保留兼容
  tokenUsage?: TokenUsage;   // 新增：详细 token 用量
  duration: number;
}
```

**Step 2：LLM Runtime 提取详细 token 信息**

修改 `src/runtime/llm-direct.ts`，从 OpenAI 响应中提取 `usage.prompt_tokens`、`usage.completion_tokens`、`usage.total_tokens`：

```typescript
// OpenAIChatCompletionResponse.usage 扩展
usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

// 返回值
return {
  output,
  tokensUsed: json?.usage?.total_tokens,
  tokenUsage: json?.usage ? {
    promptTokens: json.usage.prompt_tokens,
    completionTokens: json.usage.completion_tokens,
    totalTokens: json.usage.total_tokens ?? 0,
  } : undefined,
  duration: Date.now() - startedAt,
};
```

**Step 3：引擎收集统计数据**

修改 `src/engine/workflow-engine.ts`，在 `executeStepCore` 中将 `result.tokenUsage` 和 `result.duration` 存入 `StepState`：

```typescript
// src/types/index.ts — 扩展 StepState
export interface StepState {
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  outputFile?: string;
  error?: string;
  retryCount?: number;
  tokenUsage?: TokenUsage;   // 新增
  durationMs?: number;       // 新增
}
```

**Step 4：ProgressUI 汇总展示**

修改 `src/ui/progress.ts` 中 `complete()` 方法：

```typescript
complete(state: RunState): void {
  // 汇总统计
  let totalTokens = 0;
  let totalDurationMs = 0;
  const stepSummaries: string[] = [];

  for (const [stepId, step] of Object.entries(state.steps)) {
    const duration = step.durationMs ? `${Math.round(step.durationMs / 1000)}s` : '-';
    const tokens = step.tokenUsage?.totalTokens ?? 0;
    totalTokens += tokens;
    totalDurationMs += step.durationMs ?? 0;
    const tokenStr = tokens > 0 ? `, ${tokens.toLocaleString()} tokens` : '';
    stepSummaries.push(`  ${step.status === 'completed' ? '✅' : '❌'} ${stepId} (${duration}${tokenStr})`);
  }

  console.log('\n' + stepSummaries.join('\n'));
  console.log(chalk.cyan(
    `\n📊 总计: ${Math.round(totalDurationMs / 1000)}s | ${totalTokens.toLocaleString()} tokens`
  ));

  // 原有逻辑...
}
```

**Step 5：（可选）成本估算**

在 `src/ui/progress.ts` 中添加简单的成本估算函数（按模型名称匹配费率表）。初期可硬编码几个主流模型的价格，后续再考虑配置化。

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/types/index.ts` | 新增 `TokenUsage`，扩展 `StepState`（+10 行） |
| `src/runtime/llm-direct.ts` | 提取详细 token 信息（+10 行） |
| `src/engine/workflow-engine.ts` | 存储 tokenUsage/durationMs 到 StepState（+10 行） |
| `src/ui/progress.ts` | `complete()` 方法增加汇总展示（+30 行） |

#### 测试要求

1. 修改 `src/__tests__/llm-direct.test.ts`：验证 mock 响应中 `tokenUsage` 正确提取
2. 新增 UI 汇总逻辑的单元测试（可提取为纯函数测试）

#### 验收标准

```
=== 小说章节续写 ===
Run ID: run_20260316_205116

✅ [1/3] plot_designer (113s, 2,847 tokens)
✅ [2/3] chapter_writer (81s, 4,521 tokens)
✅ [3/3] chapter_reviewer (99s, 1,203 tokens)

📊 总计: 293s | 8,571 tokens
```

---

### Task 2.2：输出文件命名自定义

**预估工时**：2 天
**优先级**：🟢 低 | **复杂度**：中

#### 需求描述

允许在 workflow YAML 中为每个步骤指定输出文件名，支持模板变量。

#### 实现规格

**Step 1：扩展 WorkflowConfig Schema**

```typescript
// src/config/schema.ts — 扩展 output 定义
output: z.object({
  directory: z.string().min(1),
  files: z.array(z.object({                    // 新增（可选）
    step: z.string().regex(idRegex),
    filename: z.string().min(1),
  })).optional(),
}),

// src/types/index.ts — 同步修改
export interface WorkflowConfig {
  workflow: { id: string; name: string; description: string };
  steps: StepConfig[];
  output: {
    directory: string;
    files?: Array<{ step: string; filename: string }>;   // 新增
  };
}
```

**Step 2：修改 OutputWriter**

```typescript
// src/output/writer.ts
export class OutputWriter {
  // ...

  writeStepOutput(
    runDir: string,
    stepId: string,
    content: string,
    customFilename?: string,   // 新增
  ): string {
    const outputFileName = customFilename ?? `${stepId}.md`;
    const outputPath = path.join(runDir, outputFileName);
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf8');
    return outputPath;
  }
}
```

**Step 3：引擎中解析自定义文件名**

修改 `src/engine/workflow-engine.ts` 中 `executeStepCore`：

```typescript
// 构建 step→filename 映射
const fileNameMap = new Map<string, string>();
for (const file of workflow.output.files ?? []) {
  // 渲染 filename 中的模板变量
  const renderedFilename = renderTemplate(file.filename, {
    input: state.input,
    inputs: state.inputData,
    workflowId: workflow.workflow.id,
    runId: state.runId,
    runDir,
    steps: /* ... */,
  });
  fileNameMap.set(file.step, renderedFilename);
}

// 写入时使用自定义文件名
const customFilename = fileNameMap.get(step.id);
const outputFile = this.deps.outputWriter.writeStepOutput(runDir, step.id, result.output, customFilename);
```

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/types/index.ts` | `WorkflowConfig.output` 新增 `files` 字段（+1 行） |
| `src/config/schema.ts` | `WorkflowConfigSchema.output` 新增 `files` schema（+5 行） |
| `src/output/writer.ts` | `writeStepOutput` 支持自定义文件名（+5 行） |
| `src/engine/workflow-engine.ts` | 解析自定义文件名并传递（+15 行） |

#### 测试要求

1. Schema 测试：带 `files` 配置的 workflow 能通过验证
2. OutputWriter 测试：自定义文件名写入正确路径
3. 兼容性测试：不配置 `files` 时行为不变

#### 验收标准

```yaml
output:
  directory: "./output/{{workflow.id}}/{{run.id}}"
  files:
    - step: plot_designer
      filename: "02-剧情规划.md"
    - step: chapter_writer
      filename: "第{{inputs.chapter}}章.md"
```

输出文件为 `02-剧情规划.md` 和 `第4章.md`，而非默认的 `plot_designer.md`。

---

### Task 2.3：Script Runtime

**预估工时**：5 天
**优先级**：🟡 中 | **复杂度**：高

#### 需求描述

支持 `type: script` 的 agent，可执行 JavaScript 脚本进行文件读取、数据处理等预处理操作。

#### 实现规格

**Step 1：扩展 RuntimeType**

```typescript
// src/types/index.ts
export type RuntimeType = 'llm-direct' | 'openclaw' | 'opencode' | 'claude-code' | 'script';

// src/config/schema.ts
const RuntimeTypeSchema = z.enum(['llm-direct', 'openclaw', 'opencode', 'claude-code', 'script']);
```

**Step 2：扩展 AgentConfig**

```typescript
// src/types/index.ts
export interface AgentConfig {
  agent: { id: string; name: string; description: string };
  prompt: {
    system: string;
  };
  runtime: {
    type: RuntimeType;
    model: string;
    timeout_seconds: number;
  };
  script?: {                    // 新增：仅 type=script 时有效
    file?: string;              // 脚本文件路径（相对于项目根目录）
    inline?: string;            // 内联脚本
  };
}
```

```typescript
// src/config/schema.ts — AgentConfigSchema 扩展
export const AgentConfigSchema = z.object({
  agent: z.object({ /* ... */ }),
  prompt: z.object({
    system: z.string().min(1),
  }),
  runtime: z.object({
    type: RuntimeTypeSchema,
    model: z.string().default(''),                // script 类型不需要 model，改为 optional
    timeout_seconds: z.number().int().positive().default(300),
  }),
  script: z.object({
    file: z.string().optional(),
    inline: z.string().optional(),
  }).optional(),
}).superRefine((config, ctx) => {
  if (config.runtime.type === 'script') {
    if (!config.script?.file && !config.script?.inline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['script'],
        message: 'script agent must have either script.file or script.inline',
      });
    }
  }
});
```

**Step 3：实现 ScriptRuntime**

新建 `src/runtime/script.ts`：

```typescript
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentRuntime, ExecuteParams, ExecuteResult } from '../types/index.js';
import { RuntimeError } from '../errors.js';

interface ScriptRuntimeConfig {
  projectRoot: string;
  scriptFile?: string;
  scriptInline?: string;
  timeoutMs?: number;
}

export class ScriptRuntime implements AgentRuntime {
  private readonly config: ScriptRuntimeConfig;

  constructor(config: ScriptRuntimeConfig) {
    this.config = config;
  }

  async execute(params: ExecuteParams): Promise<ExecuteResult> {
    const startedAt = Date.now();
    const scriptCode = this.loadScript();
    const timeoutMs = (params.timeoutSeconds || 30) * 1000;

    try {
      const sandbox = {
        require: (id: string) => this.safeRequire(id),
        console: { log: console.log, error: console.error, warn: console.warn },
        __input: params.userPrompt,
        __systemPrompt: params.systemPrompt,
        __result: undefined as string | undefined,
        process: { env: { ...process.env }, cwd: () => this.config.projectRoot },
      };

      const context = vm.createContext(sandbox);
      const wrappedScript = `
        (async () => {
          const input = __input;
          const systemPrompt = __systemPrompt;
          ${scriptCode}
        })().then(r => { __result = typeof r === 'string' ? r : JSON.stringify(r); });
      `;

      const script = new vm.Script(wrappedScript, { timeout: timeoutMs });
      const promise = script.runInContext(context);
      await promise;

      const output = sandbox.__result ?? '';
      return { output, duration: Date.now() - startedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'script execution failed';
      throw new RuntimeError(`Script execution failed: ${message}`, 'script-runtime');
    }
  }

  private loadScript(): string {
    if (this.config.scriptInline) {
      return this.config.scriptInline;
    }
    if (this.config.scriptFile) {
      const fullPath = path.resolve(this.config.projectRoot, this.config.scriptFile);
      if (!fs.existsSync(fullPath)) {
        throw new RuntimeError(`Script file not found: ${fullPath}`, 'script-runtime');
      }
      return fs.readFileSync(fullPath, 'utf8');
    }
    throw new RuntimeError('No script file or inline script provided', 'script-runtime');
  }

  private safeRequire(id: string): unknown {
    const allowedModules = ['fs', 'path', 'url', 'util', 'crypto', 'os'];
    if (allowedModules.includes(id)) {
      return require(id);
    }
    if (id.startsWith('./') || id.startsWith('../')) {
      return require(path.resolve(this.config.projectRoot, id));
    }
    throw new Error(`Module "${id}" is not allowed in script runtime. Allowed: ${allowedModules.join(', ')}`);
  }
}
```

**Step 4：注册到 RuntimeFactory**

修改 `src/runtime/factory.ts`：

```typescript
import { ScriptRuntime } from './script.js';

export function createRuntime(
  type: RuntimeType,
  projectConfig: ProjectConfig,
  agentConfig?: AgentConfig,     // 新增参数
): AgentRuntime {
  switch (type) {
    case 'llm-direct':
      return new LLMDirectRuntime({ /* ... */ });
    case 'script':
      return new ScriptRuntime({
        projectRoot: process.cwd(),
        scriptFile: agentConfig?.script?.file,
        scriptInline: agentConfig?.script?.inline,
      });
    default:
      throw new Error(`Unsupported runtime type "${type}"`);
  }
}
```

**注意**：`createRuntime` 签名变更，需要同步修改 `WorkflowEngine` 中的 `RuntimeFactory` 类型定义和调用处。

**Step 5：引擎调用适配**

修改 `src/engine/workflow-engine.ts`：

```typescript
// RuntimeFactory 类型更新
type RuntimeFactory = (type: RuntimeType, projectConfig: ProjectConfig, agentConfig?: AgentConfig) => AgentRuntime;

// executeStepCore 中传递 agentConfig
const runtime = this.deps.runtimeFactory(agent.runtime.type, projectConfig, agent);
```

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/types/index.ts` | 扩展 `RuntimeType`、`AgentConfig`（+10 行） |
| `src/config/schema.ts` | 扩展 `RuntimeTypeSchema`、`AgentConfigSchema`（+15 行） |
| `src/runtime/script.ts` | **新建**，ScriptRuntime 实现（约 80 行） |
| `src/runtime/factory.ts` | 注册 `script` 类型，签名变更（+10 行） |
| `src/engine/workflow-engine.ts` | `RuntimeFactory` 类型和调用处适配（+5 行） |

#### 测试要求

新建 `src/__tests__/script-runtime.test.ts`：

1. **内联脚本执行**：`return "hello"` → output 为 `"hello"`
2. **文件脚本加载**：从临时文件加载并执行
3. **输入传递**：脚本中 `input` 变量包含 `userPrompt` 内容
4. **超时中断**：死循环脚本在 timeout 后抛错
5. **模块限制**：`require('child_process')` 抛错
6. **文件不存在**：指定不存在的脚本文件抛错

修改 `src/__tests__/runtime-factory.test.ts`：

7. **script 类型创建**：`createRuntime('script', ...)` 返回 `ScriptRuntime` 实例

#### 验收标准

```yaml
# agents/file_reader.yaml
agent:
  id: file_reader
  name: 文件读取器
  description: 读取文件内容
prompt:
  system: "读取指定文件"
runtime:
  type: script
  timeout_seconds: 30
script:
  inline: |
    const fs = require('fs');
    return fs.readFileSync(input, 'utf-8');
```

---

## Phase 3：开发者体验 + 架构改进（第 4-6 周）

> 目标：完善工具链，增强系统健壮性

### Task 3.1：模板调试命令

**预估工时**：1 天
**优先级**：🟢 低 | **复杂度**：低

#### 需求描述

`openagents debug template` 命令预览模板渲染结果，无需实际执行 workflow。

#### 实现规格

新建 `src/cli/debug.ts`：

```typescript
import { Command } from 'commander';
import { ConfigLoader } from '../config/loader.js';
import { renderTemplate } from '../engine/template.js';

export function createDebugCommand(): Command {
  return new Command('debug')
    .description('Debug tools')
    .addCommand(
      new Command('template')
        .description('Preview rendered templates for a workflow')
        .argument('<workflow_id>', 'Workflow ID')
        .option('--input <text>', 'Plain text input')
        .option('--input-json <json>', 'JSON input')
        .action(async (workflowId, options) => {
          const loader = new ConfigLoader(process.cwd());
          const workflow = loader.loadWorkflow(workflowId);
          const inputData = options.inputJson ? JSON.parse(options.inputJson) : undefined;
          const input = options.inputJson ?? options.input ?? '';

          for (const step of workflow.steps) {
            const rendered = renderTemplate(step.task, {
              input,
              inputs: inputData,
              workflowId: workflow.workflow.id,
              runId: 'debug_preview',
              runDir: '/tmp/debug',
              steps: {},
            });
            console.log(`\n--- Step: ${step.id} ---`);
            console.log(rendered);
          }
        }),
    );
}
```

在 `src/cli/index.ts` 中注册：`program.addCommand(createDebugCommand());`

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/cli/debug.ts` | **新建**（约 40 行） |
| `src/cli/index.ts` | 注册 debug 命令（+2 行） |

#### 验收标准

```bash
openagents debug template novel_writing --input-json '{"novel_name":"新笔仙","chapter":4}'
# 输出每个 step 渲染后的 prompt 内容
```

---

### Task 3.2：DAG 可视化命令

**预估工时**：2 天
**优先级**：🟢 低 | **复杂度**：中

#### 需求描述

`openagents dag <workflow_id>` 命令以 ASCII 图形展示 workflow 的 DAG 结构和并行机会。

#### 实现规格

新建 `src/ui/dag-visualizer.ts`：

实现 ASCII DAG 渲染，按 `parallelGroups` 分层展示。每层内的节点横向排列，层与层之间用箭头连接。

```
Layer 1:  ┌──────────────┐  ┌──────────────┐
          │ plot_designer │  │ style_guide  │   ← 可并行
          └──────┬───────┘  └──────┬───────┘
                 │                 │
                 └────────┬────────┘
                          ▼
Layer 2:  ┌──────────────────────────┐
          │     chapter_writer       │
          └────────────┬─────────────┘
                       ▼
Layer 3:  ┌──────────────────────────┐
          │    chapter_reviewer      │
          └──────────────────────────┘
```

新建 `src/cli/dag.ts`（或扩展 workflows 命令）：

```typescript
export function createDagCommand(): Command {
  return new Command('dag')
    .description('Visualize workflow DAG')
    .argument('<workflow_id>', 'Workflow ID')
    .action(async (workflowId) => {
      const loader = new ConfigLoader(process.cwd());
      const workflow = loader.loadWorkflow(workflowId);
      const plan = new DAGParser().parse(workflow.steps);
      const visual = renderDAGAscii(plan, workflow.steps);
      console.log(visual);
    });
}
```

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/ui/dag-visualizer.ts` | **新建**（约 80 行） |
| `src/cli/dag.ts` | **新建**（约 25 行） |
| `src/cli/index.ts` | 注册 dag 命令（+2 行） |

---

### Task 3.3：配置验证增强

**预估工时**：3 天
**优先级**：🟢 低 | **复杂度**：中

#### 需求描述

`openagents validate --verbose` 输出最佳实践提示和潜在问题警告。

#### 实现规格

新建 `src/config/validator.ts`：

```typescript
export interface ValidationResult {
  level: 'error' | 'warning' | 'info';
  file: string;
  message: string;
}

export class ConfigValidator {
  validate(
    projectConfig: ProjectConfig,
    agents: Map<string, AgentConfig>,
    workflows: Map<string, WorkflowConfig>,
  ): ValidationResult[] {
    const results: ValidationResult[] = [];
    // 内置规则引擎
    results.push(...this.checkTimeoutAdequacy(agents));
    results.push(...this.checkModelSuitability(agents));
    results.push(...this.checkPromptCompleteness(agents));
    results.push(...this.checkUnusedAgents(agents, workflows));
    return results;
  }
}
```

内置规则示例：
- `timeout_seconds < 120` 且 agent 任务为长文本生成 → 警告
- Agent 无 `system` prompt → 错误
- Workflow 引用了不存在的 agent → 错误（已有）
- Agent 被定义但未被任何 workflow 引用 → 警告

修改 `src/cli/validate.ts`，增加 `--verbose` 选项，verbose 模式下输出所有级别的验证结果。

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/config/validator.ts` | **新建**（约 100 行） |
| `src/cli/validate.ts` | 支持 `--verbose`（+20 行） |

---

### Task 3.4：步骤输出缓存

**预估工时**：4 天
**优先级**：🟢 低 | **复杂度**：中高

#### 需求描述

对相同输入的步骤输出进行缓存，避免重复 LLM 调用。

#### 实现规格

**缓存设计**：

- 缓存存储位置：`<output_base_dir>/.cache/`
- 缓存 key：`sha256(stepId + agentId + renderedPrompt + model)`
- 缓存文件格式：`<hash>.json`，内含 `{ output, tokenUsage, createdAt, ttl }`
- TTL 检查：读取缓存时检查是否过期

新建 `src/engine/cache.ts`：

```typescript
export interface CacheConfig {
  enabled: boolean;
  ttl?: number;       // 秒，默认 3600
  key?: string;       // 自定义 key 模板（可选）
}

export class StepCache {
  constructor(private readonly cacheDir: string) {}
  get(key: string): CachedResult | null { /* ... */ }
  set(key: string, result: CachedResult, ttl: number): void { /* ... */ }
  clear(): void { /* ... */ }
  computeKey(stepId: string, agentId: string, prompt: string, model: string): string { /* ... */ }
}
```

**Schema 扩展**：

```yaml
# workflow 级别
cache:
  enabled: true
  ttl: 3600

# step 级别覆盖
steps:
  - id: plot_designer
    agent: writer
    task: "..."
    cache:
      enabled: false   # 此步不缓存
```

**引擎集成**：在 `executeStepCore` 中，渲染 prompt 后、调用 runtime 前，检查缓存。命中则跳过 runtime 调用。

**CLI 命令**：`openagents cache clear` 清理缓存目录。

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/engine/cache.ts` | **新建**（约 80 行） |
| `src/types/index.ts` | 新增 `CacheConfig`，扩展 `StepConfig`（+10 行） |
| `src/config/schema.ts` | 扩展 step/workflow cache schema（+15 行） |
| `src/engine/workflow-engine.ts` | 缓存检查和写入逻辑（+25 行） |
| `src/cli/cache.ts` | **新建** cache clear 命令（约 20 行） |
| `src/cli/index.ts` | 注册 cache 命令（+2 行） |

---

### Task 3.5：错误恢复策略

**预估工时**：4 天
**优先级**：🟢 低 | **复杂度**：高

#### 需求描述

步骤执行失败时支持 `fallback`（备用 agent）、`skip`（跳过）、`notify`（通知）三种策略。

#### 实现规格

**Step 1：扩展 StepConfig**

```typescript
// src/types/index.ts
export type OnFailureAction = 'fail' | 'skip' | 'fallback' | 'notify';

export interface StepConfig {
  id: string;
  agent: string;
  task: string;
  depends_on?: string[];
  gate?: GateType;
  retry?: RetryConfig;
  on_failure?: OnFailureAction;    // 新增，默认 'fail'
  fallback_agent?: string;         // on_failure='fallback' 时必填
  notify?: {                       // on_failure='notify' 时
    webhook?: string;
  };
}
```

**Step 2：Schema 校验**

```typescript
// src/config/schema.ts — StepConfigSchema 扩展
const StepConfigSchemaBase = z.object({
  // ...existing fields...
  on_failure: z.enum(['fail', 'skip', 'fallback', 'notify']).default('fail'),
  fallback_agent: z.string().regex(idRegex).optional(),
  notify: z.object({
    webhook: z.string().url().optional(),
  }).optional(),
}).superRefine((step, ctx) => {
  if (step.on_failure === 'fallback' && !step.fallback_agent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fallback_agent'],
      message: 'fallback_agent is required when on_failure is "fallback"',
    });
  }
});
```

**Step 3：修改 Scheduler/Engine 错误处理**

在 `executeStepWithRetry` 中，重试耗尽后根据 `on_failure` 策略处理：

```typescript
// 重试全部失败后
switch (step.on_failure ?? 'fail') {
  case 'skip':
    this.deps.stateManager.updateStep(state, step.id, { status: 'skipped' });
    logger.log('step.skipped', { stepId: step.id, error: message });
    return;  // 不 throw，允许后续步骤继续

  case 'fallback':
    // 使用 fallback_agent 重新执行
    const fallbackAgent = agents.get(step.fallback_agent!);
    // ...执行 fallback 逻辑
    break;

  case 'notify':
    // 发送 webhook 通知
    if (step.notify?.webhook) {
      await this.sendWebhook(step.notify.webhook, { stepId: step.id, error: message });
    }
    // 仍然 throw
    throw error;

  case 'fail':
  default:
    throw error;
}
```

**Step 4：Webhook 通知模块**

新建 `src/output/notifier.ts`：

```typescript
export async function sendWebhookNotification(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

#### 改动文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/types/index.ts` | 新增 `OnFailureAction`，扩展 `StepConfig`（+10 行） |
| `src/config/schema.ts` | 扩展 `StepConfigSchema`（+20 行） |
| `src/engine/workflow-engine.ts` | 错误处理策略分支（+40 行） |
| `src/output/notifier.ts` | **新建** webhook 通知（约 20 行） |

#### 测试要求

1. `on_failure: skip` → 步骤失败后标记为 `skipped`，后续步骤正常执行
2. `on_failure: fallback` → 使用备用 agent 重新执行
3. `on_failure: fail` → 行为与当前一致（默认值）
4. Schema 校验：`fallback` 策略缺少 `fallback_agent` 时报错

---

## Phase 4：生态建设（长期）

> 此阶段暂不细化任务单元，提供方向性规划

### 4.1 项目初始化模板扩展

- 扩展 `templates/` 目录，内置 `novel-writing`、`chatbot`、`web-scraper` 等模板
- `openagents init --template <name>` 支持从内置模板或 Git 仓库拉取
- `openagents init --list-templates` 列出可用模板

### 4.2 Agent 模板库（本地方案）

- 基于 Git 仓库管理 agent 模板（如 `openagents-templates` 仓库）
- `openagents agent install <name>` 从仓库克隆 agent YAML 到本地 `agents/`
- 无需中心化服务端，降低运维成本

### 4.3 Workflow 市场（本地方案）

- 同 Agent 模板库，基于 Git 仓库管理
- `openagents workflow search <keyword>` 搜索本地已安装的 workflow

---

## 附录：任务依赖关系

```
Phase 1（可串行在一个 Agent session 中完成）
  Task 1.1 (.env)  ─────────┐
  Task 1.2 (Gate)  ─────────┤── 互相独立，但有共同改动文件 (run.ts, shared.ts)
  Task 1.3 (Inputs) ────────┘   建议按 1.1 → 1.2 → 1.3 顺序执行

Phase 2（可并行分配给不同 Agent）
  Task 2.1 (进度增强)  ←── 独立
  Task 2.2 (文件命名)  ←── 独立
  Task 2.3 (Script RT) ←── 独立，但改动 factory.ts 签名，注意合并冲突

Phase 3（部分可并行）
  Task 3.1 (模板调试)  ←── 依赖 Task 1.3（需要 inputs 支持）
  Task 3.2 (DAG 可视化) ←── 独立
  Task 3.3 (验证增强)  ←── 独立
  Task 3.4 (缓存)     ←── 独立
  Task 3.5 (错误恢复)  ←── 独立
```

---

## 附录：AI Agent 开发指南

### Prompt 模板

向 AI Agent（GPT-5.3 Codex / GLM-5）分配任务时，建议使用以下 prompt 结构：

```
## 角色
你是 openAgents 项目的开发者。

## 项目上下文
- 项目根目录下有 CLAUDE.md，包含项目架构和命令说明
- 代码库使用 TypeScript + Vitest + Zod + Commander.js
- 严格模式，ESM 模块（import/export），Node16 解析

## 任务
[从上方任务描述中复制完整内容]

## 约束
1. 所有改动必须通过 `npm run lint` 和 `npm test`
2. 不得破坏现有测试
3. 新增代码必须有对应测试
4. import 使用 .js 后缀（ESM 要求）
5. 使用 `satisfies z.ZodType<T>` 确保 Schema 与类型同步

## 验收
完成后请运行：
1. npm run lint
2. npm test
3. npm run build
确认全部通过
```

### 执行顺序建议

| 批次 | 任务 | 可并行 | 备注 |
|------|------|--------|------|
| 第 1 批 | Task 1.1 → 1.2 → 1.3 | 串行 | 共享 CLI 改动文件 |
| 第 2 批 | Task 2.1 / 2.2 / 2.3 | 并行 | 各自独立 |
| 第 3 批 | Task 3.1 / 3.2 | 并行 | 轻量级 CLI 命令 |
| 第 4 批 | Task 3.3 / 3.4 / 3.5 | 并行 | 各自独立模块 |

### 每个 Task 完成后的检查清单

- [ ] `npm run lint` 无新增错误
- [ ] `npm test` 全量通过
- [ ] `npm run build` 编译成功
- [ ] 新增功能有对应测试用例
- [ ] 现有 YAML 配置无需修改即可正常运行（向后兼容）
- [ ] `CLAUDE.md` 中的命令和架构描述仍然准确（如有变更需同步更新）

---

*文档版本：1.0*
*创建日期：2026-03-16*
*基于代码库版本：v0.1.0*
