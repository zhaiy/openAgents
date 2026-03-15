# openAgents - 技术设计与开发计划

**版本**: v1.0  
**状态**: 定稿  
**基于**: PRD-v3.md  
**创建日期**: 2026-03-14  
**作者**: 翟扬（架构设计）  
**用途**: 交由 AI 编码模型（GPT 5.3 Codex / Kimi K2.5 等）逐阶段实现

---

## 〇、阅读指引

本文档分为 **设计篇** 和 **开发篇** 两大部分：

- **设计篇**（第一章 ~ 第五章）：定义完整的技术架构、数据结构、模块职责和交互协议。开发前必须通读。
- **开发篇**（第六章 ~ 第八章）：分 Phase 给出具体的开发任务、文件清单和验收检查点。每个 Phase 独立可交付。

每个 Phase 结束后都有 **Checkpoint（检查点）** 列表，用于验收。

---

# 第一部分：设计篇

---

## 一、系统总览

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: CLI                                           │
│  职责：解析用户命令和参数，调用下层服务，格式化输出         │
│  文件：src/cli/*                                         │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Engine（工作流引擎）                            │
│  职责：DAG 解析、节点调度、门控管理、状态管理               │
│  文件：src/engine/*                                      │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Runtime（Agent 运行时）                         │
│  职责：封装不同 Agent 后端的调用协议                       │
│  文件：src/runtime/*                                     │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Infrastructure（基础设施）                      │
│  职责：配置加载、文件 I/O、事件日志、终端 UI               │
│  文件：src/config/*, src/output/*, src/ui/*              │
└─────────────────────────────────────────────────────────┘
```

**层间调用规则**：
- 上层可以调用下层，禁止反向调用
- 同层之间通过参数传递数据，不直接互相 import（Engine 内部各模块除外）
- Layer 3 (Runtime) 是唯一与外部 LLM API 通信的层

### 1.2 核心数据流

```
用户输入 (CLI)
    │
    ▼
配置加载 (loader.ts)
    │  读取 agents/*.yaml + workflows/*.yaml + openagents.yaml
    │  Zod 校验 → 输出类型安全的配置对象
    ▼
DAG 构建 (dag.ts)
    │  解析 steps[].depends_on → 构建邻接表 → 拓扑排序
    │  输出：有序的执行计划 ExecutionPlan
    ▼
状态初始化 / 恢复 (state.ts)
    │  新运行：创建 .state.json，所有 step 状态为 pending
    │  恢复：加载 .state.json，跳过 completed 的 step
    ▼
调度循环 (scheduler.ts)
    │  loop:
    │    1. 从 ExecutionPlan 中找出所有 ready 节点
    │       （依赖全部 completed 且自身状态为 pending）
    │    2. 并行执行 ready 节点：
    │       a. 渲染模板（替换 {{}} 变量）
    │       b. 调用 Runtime.execute()
    │       c. 保存产出文件
    │       d. 更新 .state.json
    │       e. 写入 events.jsonl
    │       f. 如有 gate，暂停等待用户输入
    │    3. 检查是否全部完成
    ▼
终端 UI 实时渲染 (progress.ts)
    │  监听调度循环事件，实时更新终端显示
    ▼
完成 / 中断
    │  完成：输出汇总信息
    │  中断（Ctrl+C）：将当前 step 标记为 interrupted，保存状态
```

---

## 二、类型系统设计

所有类型集中定义在 `src/types/index.ts`，是整个项目的契约层。

```typescript
// =============================================================
// src/types/index.ts - 全局类型定义
// =============================================================

// ---- Agent 配置 ----

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

export type RuntimeType = 'llm-direct' | 'openclaw' | 'opencode' | 'claude-code';

// ---- 工作流配置 ----

export interface WorkflowConfig {
  workflow: {
    id: string;
    name: string;
    description: string;
  };
  steps: StepConfig[];
  output: {
    directory: string;   // 支持 {{}} 模板变量
  };
}

export interface StepConfig {
  id: string;
  agent: string;         // 引用 AgentConfig.agent.id
  task: string;           // 任务描述，支持 {{}} 模板变量
  depends_on?: string[];  // 依赖的 step id 列表
  gate?: GateType;        // 审核门控
  retry?: RetryConfig;    // 重试配置（可选，覆盖全局）
}

export type GateType = 'auto' | 'approve';

export interface RetryConfig {
  max_attempts: number;   // 最大重试次数（不含首次，默认 2）
  delay_seconds: number;  // 重试间隔秒数（默认 5）
}

// ---- 项目配置 ----

export interface ProjectConfig {
  version: string;        // 配置文件版本，固定 "1"
  runtime: {
    default_type: RuntimeType;
    default_model: string;
    api_key?: string;     // 可选，优先级低于环境变量
    api_base_url?: string;
  };
  retry: RetryConfig;     // 全局默认重试配置
  output: {
    base_directory: string;  // 默认 "./output"
    preview_lines: number;   // 产出预览行数（默认 10）
  };
}

// ---- 运行时状态 ----

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'interrupted' | 'skipped';
export type RunStatus = 'running' | 'completed' | 'failed' | 'interrupted';

export interface StepState {
  status: StepStatus;
  startedAt?: number;     // Unix 时间戳 ms
  completedAt?: number;
  outputFile?: string;    // 产出文件相对路径
  error?: string;         // 失败时的错误信息
  retryCount?: number;    // 已重试次数
}

export interface RunState {
  runId: string;
  workflowId: string;
  status: RunStatus;
  input: string;
  startedAt: number;
  completedAt?: number;
  steps: Record<string, StepState>;  // key: step id
}

// ---- 事件日志 ----

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
  ts: number;             // Unix 时间戳 ms
  event: EventType;
  data: Record<string, any>;
}

// ---- DAG ----

export interface DAGNode {
  id: string;
  dependencies: string[];  // depends_on 列表
}

export interface ExecutionPlan {
  nodes: DAGNode[];
  order: string[];         // 拓扑排序结果
  parallelGroups: string[][];  // 可并行执行的节点分组
}

// ---- Runtime 接口 ----

export interface ExecuteParams {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  timeoutSeconds: number;
}

export interface ExecuteResult {
  output: string;
  tokensUsed?: number;
  duration: number;        // 毫秒
}

export interface AgentRuntime {
  execute(params: ExecuteParams): Promise<ExecuteResult>;
}
```

---

## 三、模块详细设计

### 3.1 配置模块 `src/config/`

#### 3.1.1 `schema.ts` — Zod 校验 Schema

职责：为每种配置文件定义 Zod schema，提供类型安全的解析和友好的错误提示。

```typescript
// 导出以下 schema（均使用 zod 定义）：
export const AgentConfigSchema: z.ZodType<AgentConfig>;
export const WorkflowConfigSchema: z.ZodType<WorkflowConfig>;
export const ProjectConfigSchema: z.ZodType<ProjectConfig>;
```

**关键校验规则**：

| 字段 | 规则 |
|------|------|
| `agent.id` | 必填，`/^[a-z][a-z0-9_-]*$/`（小写字母开头，只含字母数字下划线连字符） |
| `step.id` | 同上 |
| `step.depends_on` | 可选，数组中的每个值必须是同一 workflow 中已定义的 step id |
| `step.agent` | 必须引用一个已存在的 agent 配置文件 |
| `runtime.type` | 枚举：`llm-direct \| openclaw \| opencode \| claude-code` |
| `runtime.timeout_seconds` | 正整数，默认 300 |
| `retry.max_attempts` | 非负整数，默认 2 |
| `output.directory` | 字符串，支持 `{{}}` 模板 |

#### 3.1.2 `loader.ts` — 配置加载器

职责：从文件系统加载 YAML 配置，解析并校验。

```typescript
export class ConfigLoader {
  constructor(private projectRoot: string);

  // 加载项目配置（openagents.yaml）
  loadProjectConfig(): ProjectConfig;

  // 加载所有 Agent 配置（agents/*.yaml）
  loadAgents(): Map<string, AgentConfig>;

  // 加载所有工作流配置（workflows/*.yaml）
  loadWorkflows(): Map<string, WorkflowConfig>;

  // 加载指定工作流
  loadWorkflow(workflowId: string): WorkflowConfig;

  // 验证所有配置的交叉引用完整性
  // （step.agent 引用的 agent 是否存在，depends_on 引用的 step 是否存在）
  validateReferences(agents: Map<string, AgentConfig>, workflow: WorkflowConfig): void;
}
```

**错误处理规范**：
- YAML 语法错误 → 显示文件路径、行号、错误原因
- Zod 校验失败 → 显示字段路径和期望值，如 `agents/writer.yaml: runtime.type 必须是 llm-direct | openclaw | opencode | claude-code，当前值为 "gpt"`
- 引用不存在 → 显示引用方和被引用方，如 `workflows/novel.yaml: step "chapter_1" 引用了不存在的 agent "writer2"，可用的 agent 有：planner, writer, reviewer`

---

### 3.2 引擎模块 `src/engine/`

#### 3.2.1 `dag.ts` — DAG 解析与拓扑排序

职责：将工作流的 steps 配置解析为有向无环图，进行拓扑排序，生成执行计划。

```typescript
export class DAGParser {
  /**
   * 构建 DAG 并生成执行计划
   * @throws DAGValidationError 当检测到循环依赖或无效引用时
   */
  parse(steps: StepConfig[]): ExecutionPlan;
}
```

**算法要求**：
- 使用 Kahn 算法（BFS 拓扑排序）
- 检测循环依赖：如果排序完成后仍有未处理节点，说明存在环，抛出错误并列出环中的节点
- 生成 `parallelGroups`：同一层级（入度同时变为 0）的节点归为一组，可并行执行

**示例**：

输入 steps:
```
outline (无依赖)
characters (依赖 outline)
world (依赖 outline)
chapter (依赖 outline, characters, world)
review (依赖 chapter)
```

输出 ExecutionPlan:
```json
{
  "order": ["outline", "characters", "world", "chapter", "review"],
  "parallelGroups": [
    ["outline"],
    ["characters", "world"],
    ["chapter"],
    ["review"]
  ]
}
```

#### 3.2.2 `scheduler.ts` — 节点调度器

职责：根据执行计划和当前状态，决定哪些节点可以执行，并驱动执行循环。

```typescript
export class Scheduler {
  constructor(
    private plan: ExecutionPlan,
    private state: RunState,
    private stepExecutor: (stepId: string) => Promise<void>
  );

  /**
   * 启动调度循环
   * 按 parallelGroups 顺序执行，同一 group 内并行（Promise.allSettled）
   * 如果从断点恢复，跳过 completed 的节点
   */
  async run(): Promise<void>;

  /**
   * 获取当前可执行的节点列表
   * 条件：自身状态为 pending，且所有 depends_on 的节点状态为 completed
   */
  getReadyNodes(): string[];
}
```

**关键行为**：
- 同一 parallelGroup 内的节点通过 `Promise.allSettled` 并行执行
- 任一节点失败（且重试耗尽）→ 整个工作流标记为 failed，不继续执行后续 group
- 断点恢复时：跳过 `completed` 的节点，将 `interrupted` / `running` 的节点重置为 `pending` 重新执行

#### 3.2.3 `gate.ts` — 审核门控

职责：在节点完成后，根据 gate 配置决定是否暂停等待用户审核。

```typescript
export class GateManager {
  /**
   * 处理节点完成后的门控逻辑
   * @param output 节点产出内容
   * @returns 用户决策：continue（继续）、abort（终止）、edit（用户编辑后的新内容）
   */
  async handleGate(
    stepId: string,
    gateType: GateType,
    output: string
  ): Promise<GateDecision>;
}

export type GateDecision =
  | { action: 'continue' }
  | { action: 'abort' }
  | { action: 'edit'; editedOutput: string };
```

**交互流程（gate = approve）**：
1. 在终端展示节点产出预览
2. 提示用户输入：
   - `yes` 或回车 → 返回 `{ action: 'continue' }`
   - `no` → 返回 `{ action: 'abort' }`
   - `edit` → 用 `$EDITOR` 或 `vi` 打开产出文件让用户编辑，编辑完成后读取文件内容，返回 `{ action: 'edit', editedOutput: '...' }`
3. 输入其他值 → 提示无效输入，重新等待

**edit 模式实现**：
- 优先使用环境变量 `$EDITOR`，fallback 到 `vi`
- 通过 `child_process.spawnSync` 打开编辑器，阻塞直到用户关闭编辑器
- 编辑完成后重新读取文件内容作为该节点的最终输出

#### 3.2.4 `state.ts` — 状态管理

职责：管理运行状态文件（`.state.json`）的读写，支持断点恢复。

```typescript
export class StateManager {
  constructor(private outputDir: string);

  /**
   * 生成运行 ID
   * 格式：run_YYYYMMDD_HHmmss（本地时间）
   */
  generateRunId(): string;

  /**
   * 初始化一次新的运行
   * 创建 output 目录和 .state.json
   */
  initRun(runId: string, workflowId: string, input: string, stepIds: string[]): RunState;

  /**
   * 从 .state.json 加载已有运行状态（用于断点恢复）
   */
  loadRun(runId: string, workflowId: string): RunState;

  /**
   * 更新某个 step 的状态
   * 每次更新都写入文件（原子写入：先写 .tmp 再 rename）
   */
  updateStep(state: RunState, stepId: string, update: Partial<StepState>): void;

  /**
   * 更新整体运行状态
   */
  updateRun(state: RunState, update: Partial<RunState>): void;

  /**
   * 列出所有历史运行记录
   * 扫描 output 目录下的所有 .state.json
   */
  listRuns(filter?: { workflowId?: string; status?: RunStatus }): RunState[];

  /**
   * 获取某次运行的输出目录路径
   */
  getRunDir(workflowId: string, runId: string): string;
}
```

**状态文件路径**：`{output.base_directory}/{workflowId}/{runId}/.state.json`

**原子写入实现**：
```
1. 写入 .state.json.tmp
2. fs.renameSync(.state.json.tmp, .state.json)
```
这样即使进程在写入过程中崩溃，也不会损坏状态文件。

#### 3.2.5 `workflow-engine.ts` — 工作流执行引擎（主控）

职责：组合上述模块，驱动一次完整的工作流执行。这是 Engine 层的入口。

```typescript
export class WorkflowEngine {
  constructor(
    private configLoader: ConfigLoader,
    private stateManager: StateManager,
    private runtimeFactory: (type: RuntimeType) => AgentRuntime,
    private gateManager: GateManager,
    private eventLogger: EventLogger,
    private progressUI: ProgressUI
  );

  /**
   * 执行工作流（新运行）
   */
  async run(workflowId: string, input: string): Promise<RunState>;

  /**
   * 恢复执行工作流（断点恢复）
   */
  async resume(runId: string): Promise<RunState>;
}
```

**执行流程**（伪代码）：

```
function run(workflowId, input):
  1. workflow = configLoader.loadWorkflow(workflowId)
  2. agents = configLoader.loadAgents()
  3. configLoader.validateReferences(agents, workflow)
  4. plan = dagParser.parse(workflow.steps)
  5. runId = stateManager.generateRunId()
  6. state = stateManager.initRun(runId, workflowId, input, plan.order)
  7. eventLogger.log('workflow.started', { workflowId, input })
  8. progressUI.start(plan, state)

  9. 注册 SIGINT 处理器：
     on Ctrl+C:
       将当前 running 的 step 标记为 interrupted
       state.status = 'interrupted'
       stateManager.updateRun(state, ...)
       eventLogger.log('workflow.interrupted', ...)
       progressUI.stop()
       process.exit(0)

  10. scheduler = new Scheduler(plan, state, (stepId) => executeStep(...))
  11. await scheduler.run()

  12. state.status = 'completed'
      stateManager.updateRun(state, { status: 'completed', completedAt: Date.now() })
      eventLogger.log('workflow.completed', { runId, duration: ... })
      progressUI.complete(state)

  13. return state

function executeStep(stepId):
  1. stepConfig = workflow.steps.find(s => s.id === stepId)
  2. agentConfig = agents.get(stepConfig.agent)

  3. stateManager.updateStep(state, stepId, { status: 'running', startedAt: Date.now() })
     eventLogger.log('step.started', { stepId, agent: stepConfig.agent })
     progressUI.updateStep(stepId, 'running')

  4. userPrompt = renderTemplate(stepConfig.task, { input, steps: state.steps的已有outputs })

  5. runtime = runtimeFactory(agentConfig.runtime.type)
  6. result = await runtime.execute({
       systemPrompt: agentConfig.prompt.system,
       userPrompt,
       model: agentConfig.runtime.model,
       timeoutSeconds: agentConfig.runtime.timeout_seconds
     })

  7. outputFile = `${stepId}.md`
     写入文件: {runDir}/{outputFile} = result.output

  8. stateManager.updateStep(state, stepId, {
       status: 'completed',
       completedAt: Date.now(),
       outputFile
     })
     eventLogger.log('step.completed', { stepId, duration: result.duration, outputFile })
     progressUI.updateStep(stepId, 'completed', result)

  9. if stepConfig.gate === 'approve':
       eventLogger.log('gate.waiting', { stepId, gateType: 'approve' })
       decision = await gateManager.handleGate(stepId, 'approve', result.output)
       if decision.action === 'abort':
         eventLogger.log('gate.rejected', { stepId })
         throw new GateRejectError(stepId)
       if decision.action === 'edit':
         覆写产出文件为 decision.editedOutput
         eventLogger.log('gate.edited', { stepId })

function executeStep（带重试包装）:
  retryConfig = stepConfig.retry ?? projectConfig.retry
  for attempt in 0..retryConfig.max_attempts:
    try:
      await executeStepCore(stepId)
      return
    catch error:
      if attempt < retryConfig.max_attempts:
        eventLogger.log('step.retrying', { stepId, attempt, error: error.message })
        progressUI.updateStep(stepId, 'retrying')
        await sleep(retryConfig.delay_seconds * 1000)
        stateManager.updateStep(state, stepId, { retryCount: attempt + 1 })
      else:
        stateManager.updateStep(state, stepId, { status: 'failed', error: error.message })
        eventLogger.log('step.failed', { stepId, error: error.message })
        progressUI.updateStep(stepId, 'failed', error)
        throw error
```

---

### 3.3 运行时模块 `src/runtime/`

#### 3.3.1 `interface.ts` — 接口定义

见第二章类型系统中的 `AgentRuntime`、`ExecuteParams`、`ExecuteResult`。

#### 3.3.2 `llm-direct.ts` — LLM 直连运行时（MVP 默认）

```typescript
export class LLMDirectRuntime implements AgentRuntime {
  constructor(private config: {
    apiKey: string;
    baseUrl: string;
  });

  async execute(params: ExecuteParams): Promise<ExecuteResult>;
}
```

**实现要求**：
- 使用 OpenAI 兼容 API（`/v1/chat/completions`），因为国内大多数模型（通义千问、Kimi、DeepSeek）都兼容此协议
- HTTP 客户端使用 Node.js 内置的 `fetch`（Node 18+），不引入 axios 等第三方库
- 超时控制通过 `AbortController` + `setTimeout` 实现
- API Key 读取优先级：环境变量 `OPENAGENTS_API_KEY` > 项目配置文件 `openagents.yaml` 中的 `runtime.api_key`
- API Base URL 读取优先级：环境变量 `OPENAGENTS_API_BASE_URL` > 项目配置 > 默认值 `https://dashscope.aliyuncs.com/compatible-mode`

**请求格式**：
```json
{
  "model": "{params.model}",
  "messages": [
    { "role": "system", "content": "{params.systemPrompt}" },
    { "role": "user", "content": "{params.userPrompt}" }
  ]
}
```

**返回解析**：
- 从 `response.choices[0].message.content` 取输出文本
- 从 `response.usage` 取 token 用量（如果有）

#### 3.3.3 `factory.ts` — 运行时工厂

```typescript
export function createRuntime(type: RuntimeType, projectConfig: ProjectConfig): AgentRuntime {
  switch (type) {
    case 'llm-direct':
      return new LLMDirectRuntime({ ... });
    default:
      throw new Error(`暂不支持的运行时类型: ${type}，当前仅支持 llm-direct`);
  }
}
```

---

### 3.4 基础设施模块

#### 3.4.1 `src/output/logger.ts` — 事件日志

```typescript
export class EventLogger {
  constructor(private logFilePath: string);

  /**
   * 追加一条事件日志
   * 格式：JSON 单行 + 换行符
   */
  log(event: EventType, data: Record<string, any>): void;

  /**
   * 读取所有事件日志
   */
  readAll(): LogEvent[];
}
```

**实现要求**：
- 使用 `fs.appendFileSync` 追加写入（同步，确保在进程崩溃前写入）
- 每行一个 JSON 对象，以 `\n` 结尾
- 时间戳使用 `Date.now()` 毫秒级

#### 3.4.2 `src/output/writer.ts` — 文件写入

```typescript
export class OutputWriter {
  constructor(private baseDir: string);

  /**
   * 确保输出目录存在
   */
  ensureDir(runDir: string): void;

  /**
   * 写入节点产出文件
   */
  writeStepOutput(runDir: string, stepId: string, content: string): string;

  /**
   * 读取节点产出文件
   */
  readStepOutput(runDir: string, stepId: string): string;
}
```

#### 3.4.3 `src/ui/progress.ts` — 终端进度展示

```typescript
export class ProgressUI {
  /**
   * 开始展示进度
   */
  start(plan: ExecutionPlan, state: RunState, workflowName: string): void;

  /**
   * 更新某个节点的状态
   */
  updateStep(stepId: string, status: StepStatus, detail?: {
    duration?: number;
    outputPreview?: string;
    error?: string;
  }): void;

  /**
   * 显示审核门控提示
   */
  showGatePrompt(stepId: string, output: string, previewLines: number): void;

  /**
   * 完成
   */
  complete(state: RunState): void;

  /**
   * 停止（中断时调用）
   */
  stop(): void;
}
```

**实现要求**：
- 使用 `chalk` 做彩色输出：running=黄色, completed=绿色, failed=红色
- 使用 `ora` 做加载动画（executing spinner）
- 产出预览使用 `boxen` 绘制边框
- 不要使用 `ink` 等 React 式终端框架（过重），直接用 `console.log` + ANSI 控制符
- 进度行格式：`[{当前/总数}] {stepId} ({agentName})`

#### 3.4.4 `src/engine/template.ts` — 模板引擎

```typescript
/**
 * 渲染模板字符串，替换 {{}} 变量
 *
 * 支持的变量：
 * - {{input}} → 用户输入
 * - {{steps.<stepId>.output}} → 读取对应节点的产出文件内容
 * - {{workflow.id}} → 工作流 ID
 * - {{run.id}} → 运行 ID
 */
export function renderTemplate(
  template: string,
  context: {
    input: string;
    steps: Record<string, { outputFile?: string }>;
    workflowId: string;
    runId: string;
    runDir: string;
  }
): string;
```

**实现要求**：
- 使用简单的正则替换：`/\{\{(.+?)\}\}/g`
- `{{steps.xxx.output}}` 需要从磁盘读取对应的产出文件内容
- 未找到变量时抛出明确错误：`模板变量 {{steps.xxx.output}} 无法解析：step "xxx" 尚未执行或无产出`

---

### 3.5 CLI 模块 `src/cli/`

#### 3.5.1 `index.ts` — CLI 入口

使用 Commander.js 注册所有命令。

```typescript
#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('openagents')
  .description('透明可控的多 Agent 协作引擎')
  .version('0.1.0');

// 注册子命令
program.addCommand(runCommand);
program.addCommand(resumeCommand);
program.addCommand(runsCommand);
program.addCommand(agentsCommand);
program.addCommand(workflowsCommand);
program.addCommand(validateCommand);
program.addCommand(initCommand);

program.parse();
```

#### 3.5.2 各命令模块

| 文件 | 命令 | 功能 |
|------|------|------|
| `run.ts` | `openagents run <workflow_id> --input "..."` | 创建新运行并执行 |
| `resume.ts` | `openagents resume <run_id>` | 从断点恢复 |
| `runs.ts` | `openagents runs list [--status] [--workflow]` | 列出历史运行 |
| `runs.ts` | `openagents runs show <run_id>` | 展示运行详情 |
| `runs.ts` | `openagents runs logs <run_id>` | 展示事件日志 |
| `agents.ts` | `openagents agents list` | 列出所有 Agent |
| `workflows.ts` | `openagents workflows list` | 列出所有工作流 |
| `validate.ts` | `openagents validate` | 校验所有配置文件 |
| `init.ts` | `openagents init [directory]` | 初始化示例项目 |

---

## 四、项目模板设计

`openagents init` 命令生成的示例项目内容。文件存放在源码的 `templates/` 目录下。

#### `templates/openagents.yaml`

```yaml
version: "1"

runtime:
  default_type: llm-direct
  default_model: qwen-plus
  # api_key: sk-xxxxx  # 或设置环境变量 OPENAGENTS_API_KEY
  api_base_url: https://dashscope.aliyuncs.com/compatible-mode

retry:
  max_attempts: 2
  delay_seconds: 5

output:
  base_directory: ./output
  preview_lines: 10
```

#### `templates/agents/planner.yaml`

```yaml
agent:
  id: planner
  name: 大纲规划师
  description: 擅长构思故事大纲和章节结构

prompt:
  system: |
    你是一位资深的小说策划编辑，擅长构思引人入胜的故事大纲。
    你的任务是根据用户给出的主题，输出结构清晰的小说大纲。
    输出格式要求：使用 Markdown，包含故事梗概、角色列表和章节规划。

runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 120
```

#### `templates/agents/writer.yaml`

```yaml
agent:
  id: writer
  name: 写作助手
  description: 擅长根据大纲撰写生动的小说章节

prompt:
  system: |
    你是一位经验丰富的网文作家。
    写作风格：细腻、有画面感、善于刻画人物心理。
    输出要求：只输出正文内容，使用 Markdown 格式。

runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 300
```

#### `templates/agents/reviewer.yaml`

```yaml
agent:
  id: reviewer
  name: 审稿编辑
  description: 从多维度审核小说章节质量

prompt:
  system: |
    你是一位严格的文学编辑，擅长从剧情逻辑、人物塑造和文笔质量三个维度审核小说。
    输出格式：Markdown，包含各维度评分（1-10）和具体改进建议。

runtime:
  type: llm-direct
  model: qwen-plus
  timeout_seconds: 120
```

#### `templates/workflows/novel_writing.yaml`

```yaml
workflow:
  id: novel_writing
  name: 小说创作工作流
  description: 从大纲到成稿的完整创作流程（示例）

steps:
  - id: outline
    agent: planner
    task: |
      根据以下主题生成一份小说大纲，包含：
      1. 故事梗概（200字以内）
      2. 主要角色（3-5个，每个角色写名字、身份和性格特点）
      3. 章节规划（5章，每章一句话概述）

      主题：{{input}}
    gate: approve

  - id: chapter_1
    agent: writer
    depends_on: [outline]
    task: |
      根据以下大纲撰写第1章，要求 2000-3000 字。
      注意：紧扣大纲设定，注意人物性格的一致性。

      大纲：
      {{steps.outline.output}}

  - id: review
    agent: reviewer
    depends_on: [chapter_1]
    task: |
      请审核以下小说章节，从以下三个维度给出评分和建议：
      1. 剧情逻辑（1-10分）
      2. 人物塑造（1-10分）
      3. 文笔质量（1-10分）

      每个维度请给出具体的改进建议。

      章节内容：
      {{steps.chapter_1.output}}

output:
  directory: ./output/{{workflow.id}}/{{run.id}}
```

---

## 五、错误处理规范

### 5.1 错误分类

| 错误类型 | 场景 | 处理方式 |
|----------|------|----------|
| `ConfigError` | YAML 语法错误、Zod 校验失败、引用不存在 | 输出友好错误信息，退出码 1 |
| `DAGError` | 循环依赖、空工作流 | 输出友好错误信息，退出码 1 |
| `RuntimeError` | LLM API 调用失败、超时 | 触发重试机制，重试耗尽后标记 step 为 failed |
| `GateRejectError` | 用户在门控处选择终止 | 标记 workflow 为 interrupted，保存状态，退出码 0 |
| `ResumeError` | 找不到 run_id 对应的状态文件 | 输出友好错误信息，退出码 1 |

### 5.2 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 正常完成 / 用户主动中断 |
| 1 | 配置错误 / 参数错误 |
| 2 | 工作流执行失败（节点失败且重试耗尽） |

### 5.3 自定义异常类

```typescript
// src/errors.ts

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

export class RuntimeError extends OpenAgentsError {
  constructor(message: string, public stepId: string) {
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
```

---

# 第二部分：开发篇

---

## 六、Phase 1 — 基础骨架（第 1 周）

### 6.1 目标

从零搭建项目，实现最基本的"加载配置 → 解析 DAG → 调用 LLM → 输出结果"链路。

### 6.2 任务清单

#### Task 1.1：项目初始化

创建以下文件：

| 文件 | 说明 |
|------|------|
| `package.json` | name=openagents, type=module, bin 指向 dist/cli/index.js |
| `tsconfig.json` | target: ES2022, module: Node16, strict: true, outDir: dist |
| `.eslintrc.json` | 启用 @typescript-eslint, 规则从严 |
| `.prettierrc` | singleQuote: true, trailingComma: 'all', printWidth: 100 |
| `.gitignore` | node_modules, dist, output |
| `src/types/index.ts` | 第二章完整的类型定义 |
| `src/errors.ts` | 第五章的自定义异常类 |

**依赖安装**：
```bash
# 运行时依赖
npm install commander js-yaml zod chalk ora boxen

# 开发依赖
npm install -D typescript @types/node @types/js-yaml eslint prettier tsx vitest
```

> **注意**：使用 `tsx` 在开发阶段直接运行 TS 文件，避免每次编译。package.json 的 scripts 中设置 `"dev": "tsx src/cli/index.ts"`。

#### Task 1.2：配置模块

实现以下文件：

| 文件 | 测试要求 |
|------|----------|
| `src/config/schema.ts` | 单元测试：合法配置通过，非法配置抛出包含字段路径的错误 |
| `src/config/loader.ts` | 单元测试：能加载示例 YAML，交叉引用校验正确 |

#### Task 1.3：DAG 模块

| 文件 | 测试要求 |
|------|----------|
| `src/engine/dag.ts` | 单元测试：线性 DAG / 菱形 DAG / 循环依赖检测 / 单节点 |

#### Task 1.4：模板引擎

| 文件 | 测试要求 |
|------|----------|
| `src/engine/template.ts` | 单元测试：变量替换 / 嵌套变量 / 未定义变量报错 |

#### Task 1.5：LLM Direct 运行时

| 文件 | 测试要求 |
|------|----------|
| `src/runtime/interface.ts` | 类型定义 |
| `src/runtime/llm-direct.ts` | 集成测试：能真正调用 LLM API 并返回结果（需 API Key） |
| `src/runtime/factory.ts` | 单元测试：正确创建运行时实例 |

#### Task 1.6：基础 CLI — run 命令

| 文件 | 说明 |
|------|------|
| `src/cli/index.ts` | CLI 入口 |
| `src/cli/run.ts` | run 命令，此阶段用简单的 console.log 输出 |
| `src/output/writer.ts` | 文件写入 |
| `src/engine/state.ts` | 状态管理（此阶段只需 initRun + updateStep） |
| `src/engine/scheduler.ts` | 调度器（此阶段串行执行即可） |
| `src/engine/workflow-engine.ts` | 主控引擎（简化版，不含 gate/resume） |

同时创建模板文件：
| 文件 |
|------|
| `templates/openagents.yaml` |
| `templates/agents/planner.yaml` |
| `templates/agents/writer.yaml` |
| `templates/agents/reviewer.yaml` |
| `templates/workflows/novel_writing.yaml` |

### 6.3 Phase 1 检查点

```
┌─────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT Phase 1 — 基础骨架                                       │
├─────┬───────────────────────────────────────────────────────────────┤
│  #  │  检查项                                                       │
├─────┼───────────────────────────────────────────────────────────────┤
│ 1.1 │ npm run build 编译成功，无 TypeScript 错误                     │
│ 1.2 │ npm run lint 通过，无 ESLint 错误                              │
│ 1.3 │ npm run test 通过：                                           │
│     │   - schema.test.ts: 合法/非法配置校验 (≥6 个用例)              │
│     │   - loader.test.ts: 加载 + 引用校验 (≥4 个用例)               │
│     │   - dag.test.ts: 拓扑排序 + 循环检测 (≥5 个用例)              │
│     │   - template.test.ts: 变量替换 (≥4 个用例)                    │
│ 1.4 │ 手动测试：创建 test-project/ 目录，放入模板文件，执行           │
│     │   npx tsx src/cli/index.ts run novel_writing --input "测试"    │
│     │   能看到依次调用 LLM 并输出结果（此时无美化 UI）               │
│ 1.5 │ 执行后 output/novel_writing/{runId}/ 目录下有：               │
│     │   .state.json + outline.md + chapter_1.md + review.md         │
│ 1.6 │ .state.json 中所有 step 的 status 均为 "completed"            │
└─────┴───────────────────────────────────────────────────────────────┘
```

---

## 七、Phase 2 — 核心特性（第 2 周）

### 7.1 目标

实现三大核心差异化功能：实时进度展示、审核门控、断点恢复。

### 7.2 任务清单

#### Task 2.1：终端 UI — 实时进度展示

| 文件 | 说明 |
|------|------|
| `src/ui/progress.ts` | 实现 ProgressUI 类 |

**具体要求**：
- workflow 开始时打印 header（工作流名称 + runId）
- 每个 step 开始时显示 spinner + 已耗时（每秒更新）
- step 完成时显示绿色 ✅ + 耗时 + 产出预览（boxen 边框内显示前 N 行）
- step 失败时显示红色 ❌ + 错误信息
- step 重试时显示黄色 🔄 + 重试次数

#### Task 2.2：审核门控

| 文件 | 说明 |
|------|------|
| `src/engine/gate.ts` | 实现 GateManager 类 |

**集成到 workflow-engine.ts**：在 step 完成后检查 gate 配置，调用 GateManager。

#### Task 2.3：事件日志

| 文件 | 说明 |
|------|------|
| `src/output/logger.ts` | 实现 EventLogger 类 |

**集成到 workflow-engine.ts**：在所有关键节点写入日志。

#### Task 2.4：断点恢复

**增强 state.ts**：
- 实现 `loadRun()` 方法
- 实现 `listRuns()` 方法

**增强 workflow-engine.ts**：
- 实现 `resume()` 方法
- 注册 SIGINT 处理器

**增强 scheduler.ts**：
- 恢复时跳过 completed 节点
- 将 interrupted/running 节点重置为 pending

#### Task 2.5：CLI 完善

| 文件 | 命令 |
|------|------|
| `src/cli/resume.ts` | `openagents resume <run_id>` |
| `src/cli/runs.ts` | `openagents runs list/show/logs` |

**runs list 输出格式**（使用固定宽度列对齐）：
```
RUN ID                   WORKFLOW         STATUS       PROGRESS  CREATED
run_20260314_143022      novel_writing    interrupted  1/3       2026-03-14 14:30
run_20260314_120000      novel_writing    completed    3/3       2026-03-14 12:00
```

**runs show 输出格式**：
```
运行 ID：run_20260314_143022
工作流：novel_writing (小说创作工作流)
状态：interrupted
输入：悬疑小说，女主穿越寻找记忆碎片
开始时间：2026-03-14 14:30:22
耗时：2m 35s

步骤：
  ✅ outline    (大纲规划师)  28s   → outline.md
  ⏸️ chapter_1  (写作助手)    中断
  ⬜ review     (审稿编辑)    等待中
```

**runs logs 输出格式**：
```
14:30:22.000  workflow.started   workflowId=novel_writing
14:30:22.100  step.started       stepId=outline agent=planner
14:30:50.000  step.completed     stepId=outline duration=28s
14:30:51.000  gate.waiting       stepId=outline type=approve
14:31:00.000  gate.approved      stepId=outline
14:31:00.100  step.started       stepId=chapter_1 agent=writer
14:32:57.000  workflow.interrupted
```

### 7.3 Phase 2 检查点

```
┌─────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT Phase 2 — 核心特性                                       │
├─────┬───────────────────────────────────────────────────────────────┤
│  #  │  检查项                                                       │
├─────┼───────────────────────────────────────────────────────────────┤
│ 2.1 │ 运行 openagents run novel_writing --input "..." 时：          │
│     │   - 终端实时显示每个 step 的执行状态和 spinner                  │
│     │   - 完成的 step 显示绿色 ✅ 和产出预览                         │
│     │   - 失败的 step 显示红色 ❌ 和错误信息                         │
├─────┼───────────────────────────────────────────────────────────────┤
│ 2.2 │ 审核门控：outline step 配置 gate: approve 时：                 │
│     │   - outline 完成后终端暂停，显示产出预览和提示                   │
│     │   - 输入 yes → 继续执行 chapter_1                              │
│     │   - 输入 no → 工作流终止，状态标记为 interrupted                │
│     │   - 输入 edit → 打开编辑器，编辑后内容替换产出并继续             │
├─────┼───────────────────────────────────────────────────────────────┤
│ 2.3 │ 断点恢复：                                                     │
│     │   a. 运行工作流，在 chapter_1 执行时按 Ctrl+C                   │
│     │   b. openagents runs list 显示该运行状态为 interrupted           │
│     │   c. openagents resume <run_id> 跳过已完成的 outline，           │
│     │      从 chapter_1 重新开始执行                                   │
│     │   d. 全部完成后状态变为 completed                                │
├─────┼───────────────────────────────────────────────────────────────┤
│ 2.4 │ 事件日志：                                                     │
│     │   - 执行目录下生成 events.jsonl                                 │
│     │   - openagents runs logs <run_id> 能格式化展示日志               │
│     │   - 日志包含所有事件类型（started/completed/gate/interrupted）   │
├─────┼───────────────────────────────────────────────────────────────┤
│ 2.5 │ CLI 命令全部可用：                                              │
│     │   - openagents runs list [--status xxx] [--workflow xxx]       │
│     │   - openagents runs show <run_id>                              │
│     │   - openagents runs logs <run_id>                              │
│     │   - openagents resume <run_id>                                 │
└─────┴───────────────────────────────────────────────────────────────┘
```

---

## 八、Phase 3 — 打磨发布（第 3 周）

### 8.1 目标

完善开发者体验，增加健壮性，准备开源发布。

### 8.2 任务清单

#### Task 3.1：init 命令

| 文件 | 说明 |
|------|------|
| `src/cli/init.ts` | 实现 init 命令 |

**逻辑**：
1. 接受可选的目录名参数（默认当前目录）
2. 将 `templates/` 目录下的所有文件复制到目标目录
3. 如果目标目录已存在且非空，提示确认
4. 复制完成后打印使用指引（参考 PRD 中的 First-Run Experience）

#### Task 3.2：validate 命令

| 文件 | 说明 |
|------|------|
| `src/cli/validate.ts` | 实现 validate 命令 |

**逻辑**：
1. 加载 openagents.yaml、agents/*.yaml、workflows/*.yaml
2. 逐个校验，收集所有错误（不要遇到第一个错误就停止）
3. 输出校验结果：通过的显示 ✅，失败的显示 ❌ + 错误详情
4. 最终汇总：X 个文件通过，Y 个文件有错误

**输出示例**：
```
验证配置文件...

  ✅ openagents.yaml
  ✅ agents/planner.yaml
  ❌ agents/writer.yaml
     → runtime.type: 必须是 llm-direct | openclaw | opencode | claude-code，当前值为 "gpt"
  ✅ agents/reviewer.yaml
  ✅ workflows/novel_writing.yaml

结果：4 个文件通过，1 个文件有错误
```

#### Task 3.3：并行节点执行

**修改 scheduler.ts**：
- 同一 `parallelGroup` 内的节点使用 `Promise.allSettled` 并行执行
- 已在 Phase 1 预留了 parallelGroups 数据结构，此处真正启用

**测试用例**：创建一个工作流，包含两个无依赖的并行节点，验证它们确实并行执行（总耗时 ≈ max(A, B) 而非 A + B）。

#### Task 3.4：节点重试机制

**增强 workflow-engine.ts 中的 step 执行**：
- 读取 step 级别的 retry 配置，fallback 到项目全局 retry 配置
- 重试时记录事件日志 `step.retrying`
- 在终端 UI 显示重试状态

#### Task 3.5：agents list / workflows list 命令

| 文件 | 说明 |
|------|------|
| `src/cli/agents.ts` | `openagents agents list` |
| `src/cli/workflows.ts` | `openagents workflows list` |

**agents list 输出**：
```
ID          NAME        RUNTIME      MODEL
planner     大纲规划师   llm-direct   qwen-plus
writer      写作助手     llm-direct   qwen-plus
reviewer    审稿编辑     llm-direct   qwen-plus
```

**workflows list 输出**：
```
ID              NAME            STEPS  DESCRIPTION
novel_writing   小说创作工作流   3      从大纲到成稿的完整创作流程
```

#### Task 3.6：README

创建项目根目录的 `README.md`，内容包含：
1. 项目简介（一句话 + 三个核心价值）
2. 快速开始（安装 → init → 配置 API Key → run）
3. 核心功能介绍（实时进度 / 审核门控 / 断点恢复）
4. CLI 命令速查表
5. 配置文件说明
6. 自定义 Agent 和工作流的指引
7. 贡献指南
8. License（MIT）

#### Task 3.7：npm 发布配置

- `package.json` 中配置 `bin`、`files`、`engines`
- 确保 `npm pack` 打出的包只含必要文件
- 确保全局安装后 `openagents` 命令可用

### 8.3 Phase 3 检查点

```
┌─────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT Phase 3 — 打磨发布                                       │
├─────┬───────────────────────────────────────────────────────────────┤
│  #  │  检查项                                                       │
├─────┼───────────────────────────────────────────────────────────────┤
│ 3.1 │ openagents init my-project 在空目录下生成完整的示例项目         │
│     │   - 包含 openagents.yaml, agents/ 3个, workflows/ 1个         │
│     │   - 配置 API Key 后能直接 openagents run novel_writing 运行    │
├─────┼───────────────────────────────────────────────────────────────┤
│ 3.2 │ openagents validate 能检测并报告所有配置错误                    │
│     │   - 故意写错一个 agent 的 runtime.type，验证能给出明确错误      │
│     │   - 故意在 workflow 中引用不存在的 agent，验证能检测到           │
├─────┼───────────────────────────────────────────────────────────────┤
│ 3.3 │ 并行执行验证：                                                 │
│     │   创建一个包含 2 个无依赖并行节点的工作流（如 characters + world）│
│     │   两个节点同时执行，总耗时显著小于串行执行                       │
├─────┼───────────────────────────────────────────────────────────────┤
│ 3.4 │ 重试机制验证：                                                 │
│     │   配置一个必定失败的 step（如错误的 model 名），验证：           │
│     │   - 自动重试指定次数                                           │
│     │   - 日志中有 step.retrying 事件                                │
│     │   - 终端显示重试状态                                           │
│     │   - 重试耗尽后 step 标记为 failed，workflow 标记为 failed       │
├─────┼───────────────────────────────────────────────────────────────┤
│ 3.5 │ openagents agents list 和 openagents workflows list 正确展示   │
├─────┼───────────────────────────────────────────────────────────────┤
│ 3.6 │ README.md 内容完整，按 README 步骤操作能成功运行               │
├─────┼───────────────────────────────────────────────────────────────┤
│ 3.7 │ npm run build && npm pack 成功                                │
│     │   解压 .tgz 验证包含正确的文件                                 │
│     │   npm install -g ./openagents-0.1.0.tgz 后 openagents --help  │
│     │   能正确输出帮助信息                                           │
└─────┴───────────────────────────────────────────────────────────────┘
```

---

## 九、最终验收清单

以下是所有 Phase 完成后的综合验收清单。每一项需标记 ✅ 或 ❌。

### 9.1 功能验收

```
┌──────┬──────────────────────┬────────────────────────────────────────────────┬──────┐
│  #   │  功能                │  验收方法                                       │ 状态 │
├──────┼──────────────────────┼────────────────────────────────────────────────┼──────┤
│ F-01 │ 项目初始化            │ openagents init → 生成完整示例项目              │  ⬜  │
│ F-02 │ 配置校验              │ openagents validate → 正确报告错误             │  ⬜  │
│ F-03 │ Agent 列表            │ openagents agents list → 正确展示              │  ⬜  │
│ F-04 │ 工作流列表            │ openagents workflows list → 正确展示           │  ⬜  │
│ F-05 │ 线性工作流执行         │ 3步线性工作流(A→B→C)成功执行                   │  ⬜  │
│ F-06 │ DAG 工作流执行         │ 菱形依赖(A→B,C→D)正确按依赖执行               │  ⬜  │
│ F-07 │ 并行执行              │ 无依赖节点并行执行，耗时≈max而非sum             │  ⬜  │
│ F-08 │ 实时进度展示           │ 终端显示spinner、状态变化、产出预览             │  ⬜  │
│ F-09 │ 审核门控-approve      │ gate:approve 暂停等待，yes/no/edit 均正常      │  ⬜  │
│ F-10 │ 审核门控-edit         │ edit 打开编辑器，保存后内容替换产出              │  ⬜  │
│ F-11 │ 断点恢复-中断          │ Ctrl+C 中断，状态正确保存                      │  ⬜  │
│ F-12 │ 断点恢复-恢复          │ resume 跳过已完成step，从断点继续               │  ⬜  │
│ F-13 │ 事件日志              │ events.jsonl 包含完整执行过程                   │  ⬜  │
│ F-14 │ 节点重试              │ 失败自动重试，重试次数和间隔符合配置             │  ⬜  │
│ F-15 │ 运行记录查看           │ runs list/show/logs 命令正确展示               │  ⬜  │
│ F-16 │ 模板变量              │ {{input}}/{{steps.x.output}}等正确替换          │  ⬜  │
│ F-17 │ 产出文件              │ 每个step的输出保存为独立.md文件                  │  ⬜  │
│ F-18 │ 错误提示              │ 配置错误给出文件路径和具体字段                   │  ⬜  │
└──────┴──────────────────────┴────────────────────────────────────────────────┴──────┘
```

### 9.2 代码质量验收

```
┌──────┬────────────────────────────────────┬──────┐
│  #   │  检查项                             │ 状态 │
├──────┼────────────────────────────────────┼──────┤
│ Q-01 │ npm run build 零错误零警告           │  ⬜  │
│ Q-02 │ npm run lint 零错误                  │  ⬜  │
│ Q-03 │ npm run test 全部通过                │  ⬜  │
│ Q-04 │ 测试覆盖核心模块：dag / schema /     │  ⬜  │
│      │   template / state / scheduler      │      │
│ Q-05 │ 无 any 类型（strict mode）           │  ⬜  │
│ Q-06 │ 所有文件均有导出类型                  │  ⬜  │
│ Q-07 │ 无硬编码的 API Key 或密钥             │  ⬜  │
│ Q-08 │ 代码中无冗余注释                     │  ⬜  │
└──────┴────────────────────────────────────┴──────┘
```

### 9.3 体验验收

```
┌──────┬────────────────────────────────────────────────────┬──────┐
│  #   │  检查项                                             │ 状态 │
├──────┼────────────────────────────────────────────────────┼──────┤
│ E-01 │ 全新环境 npm i -g → init → 配置Key → run ≤ 5分钟    │  ⬜  │
│ E-02 │ openagents --help 输出清晰的命令列表和描述           │  ⬜  │
│ E-03 │ 每个子命令 --help 输出参数说明                       │  ⬜  │
│ E-04 │ 无API Key时运行给出明确提示而非堆栈跟踪              │  ⬜  │
│ E-05 │ 完整执行小说创作工作流（3节点），产出质量可接受       │  ⬜  │
│ E-06 │ README 按步骤操作无歧义                             │  ⬜  │
└──────┴────────────────────────────────────────────────────┴──────┘
```

### 9.4 发布验收

```
┌──────┬────────────────────────────────────────────────┬──────┐
│  #   │  检查项                                         │ 状态 │
├──────┼────────────────────────────────────────────────┼──────┤
│ R-01 │ npm pack 成功生成 .tgz                          │  ⬜  │
│ R-02 │ 全局安装 .tgz 后 openagents 命令可用             │  ⬜  │
│ R-03 │ .tgz 中不含 node_modules / .env / output       │  ⬜  │
│ R-04 │ package.json 中 engines 指定 node >=18          │  ⬜  │
│ R-05 │ LICENSE 文件存在（MIT）                          │  ⬜  │
│ R-06 │ .gitignore 覆盖 node_modules/dist/output        │  ⬜  │
└──────┴────────────────────────────────────────────────┴──────┘
```

---

## 十、给 AI 编码模型的注意事项

1. **严格遵循类型定义**：`src/types/index.ts` 中的类型是契约，所有模块必须使用这些类型，不要自行定义替代类型。

2. **错误处理不要吞异常**：所有 catch 块必须要么重新抛出、要么记录日志并以合适的退出码退出。禁止空 catch。

3. **文件路径使用 `path.join`**：跨平台兼容，不要用字符串拼接路径。

4. **优先使用 Node.js 内置 API**：`fs`、`path`、`fetch`（Node 18+）、`child_process`。不要引入不必要的第三方依赖。

5. **每个 Task 完成后运行测试**：不要等到最后才写测试。每个模块完成后立即补充对应的单元测试。

6. **测试文件放在 `src/__tests__/` 目录**：使用 vitest 框架，文件命名 `xxx.test.ts`。

7. **不要过度设计**：MVP 阶段每个模块只有一种实现，不需要工厂模式、依赖注入框架等。直接 import 使用即可。唯一的例外是 `AgentRuntime` 接口。

8. **开发顺序严格按 Phase 执行**：Phase 1 全部完成并通过检查点后，再开始 Phase 2。不要跳跃式开发。

9. **git 提交粒度**：每完成一个 Task 提交一次，commit message 格式为 `feat(module): 描述`，如 `feat(config): implement YAML config loader with Zod validation`。

---

*文档结束。祝开发顺利。*
