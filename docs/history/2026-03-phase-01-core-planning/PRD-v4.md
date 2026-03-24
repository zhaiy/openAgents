# openAgents - 产品需求文档（PRD）v4

**产品版本**: v0.2.0 / v0.3.0
**文档编号**: PRD-v4
**状态**: 定稿
**创建日期**: 2026-03-19
**作者**: 翟扬 / 贾维斯
**项目地址**: https://github.com/openagents

---

## 一、v3 回顾与 v4 背景

### 1.1 v3（v0.1.0）交付的核心能力

| 功能 | 状态 |
|------|------|
| CLI + DAG 工作流执行 | ✅ 已完成 |
| 实时进度展示 | ✅ 已完成 |
| 节点审核门控（Human-in-the-Loop） | ✅ 已完成 |
| 断点恢复 | ✅ 已完成 |
| 事件日志（events.jsonl） | ✅ 已完成 |
| 并行节点执行 | ✅ 已完成 |
| 节点重试 + on_failure 策略 | ✅ 已完成 |
| init 命令 + 项目模板 | ✅ 已完成 |
| Script Runtime（沙盒脚本执行） | ✅ 已完成 |
| 步骤级缓存（StepCache） | ✅ 已完成 |
| 脚本型 Post-Processor | ✅ 已完成 |

### 1.2 当前架构的瓶颈

v3 的核心体验是**单次工作流的透明执行**，但随着用户场景变深，出现了新的瓶颈：

**瓶颈 1：上游输出直接灌入下游 prompt，无法控制**

当前 `{{steps.<step_id>.output}}` 直接读取上游输出文件原文替换进 prompt。上游输出 5000 字时，下游 prompt 直接膨胀；上游格式不固定（列表 vs 段落），下游难以解析。没有截断、摘要、格式化等中间处理能力。

**瓶颈 2：执行效果无法量化**

跑了 10 次工作流，哪次效果最好？哪个 agent 配置最适合这个场景？目前没有评估闭环，无法回答这个问题。

**瓶颈 3：LLM 输出是黑盒等待**

当前 LLM 调用等完整 response 再返回。用户看不到 agent 在"想什么"，长任务时体验退化为进度条 + 等待。

**瓶颈 4：引擎与 CLI 耦合，阻碍未来 Web UI**

`WorkflowEngine` 直接依赖 `ProgressUI` 和终端 I/O，如果要做 Web UI，需要大规模重构。应提前解耦为事件驱动架构。

---

## 二、v4 目标与版本规划

### 2.1 核心目标

> **v0.2.0 = 上下文智能流转 + 流式输出 + 效果可量化**

在保持"透明可控"核心价值不变的前提下，补全多 agent 协作的数据流转和质量闭环。

> **v0.3.0 = Skills/MCP 工具体系 + 可视化调试 + 运行分析**

扩展 agent 的工具能力和开发者的调试体验。

### 2.2 版本规划

| 版本 | 核心功能 | 预计周期 |
|------|----------|----------|
| **v0.1.0** (已发布) | CLI + DAG + 门控 + 断点恢复 + 缓存 + 重试 | 已完成 |
| **v0.2.0** (本轮) | 上下文处理器 + 流式输出 + 量化评估 + 引擎解耦 | 4 周 |
| **v0.3.0** (下一轮) | Skills 注册表 + MCP 工具 + 调试服务器 + 运行分析 | 3 周 |
| **v0.4.0** (远景) | Web UI（本地优先，React + Next.js） | 待定 |
| **v0.5.0** (远景) | REST API + SDK + 多用户 | 待定 |

---

## 三、目标用户

### 3.1 v0.2 目标用户：CLI 技术用户

v0.2 仍然聚焦单一用户群体：

| 特征 | 描述 |
|------|------|
| **技术背景** | 熟悉命令行、YAML、基本的 AI API 调用 |
| **使用场景** | 用多个 AI Agent 协作完成内容创作、调研报告、代码生成等任务 |
| **核心诉求** | Agent 执行过程透明可控，输出自动流转，效果可量化 |

> **说明**：需要 SDK/API 集成的"AI 应用开发者"推迟到 v0.4（Web UI + API 版本）再作为目标用户。不过早承诺无法兑现的能力。

### 3.2 典型用户故事

**故事 1：AI 新闻自动化流水线**
> 作为一个财经自媒体人，我有一个"狗胜调研 → 翠花写稿 → 盛夏审核"的三节点流水线。我希望狗胜的调研报告能**自动摘要后**传给翠花，而不是原文 5000 字直接灌进 prompt。这样翠花能聚焦写作，token 消耗也能降下来。

**故事 2：Workflow 效果迭代**
> 作为一个用 AI 写小说的创作者，我希望每次跑完工作流后能看到评分：这次大纲的逻辑连贯性是多少？比上次高还是低？这样我能基于数据迭代 agent 配置，而不是每次凭感觉。

**故事 3：实时观察 Agent 思考过程**
> 作为一个调试工作流的开发者，我希望在 agent 执行时能实时看到它的输出片段，而不是等 2 分钟后才看到完整结果。

---

## 四、竞品分析

### 4.1 竞品矩阵

| 能力 | CrewAI | LangGraph | AutoGen | Dify | **openAgents v0.1** | **openAgents v0.2** |
|------|--------|-----------|---------|------|---------------------|---------------------|
| 多 Agent 编排 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DAG 工作流 | ❌ (线性) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 实时进度可视 | ❌ | ❌ | ❌ | 部分 | ✅ | ✅ |
| 执行中断/恢复 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 节点审核门控 | ❌ | ❌ | 部分 | ❌ | ✅ | ✅ |
| Agent 输出流转 | 部分 | ✅ | 部分 | ✅ | 基础 | **✅ 智能处理** |
| 流式输出 | 部分 | ✅ | 部分 | 部分 | ❌ | ✅ |
| 量化评估闭环 | ❌ | ❌ | ❌ | 部分 | ❌ | ✅ |
| 执行回溯/审计 | ❌ | ❌ | 部分 | 部分 | ✅ | ✅ |

### 4.2 差异化定位

openAgents 的差异化不是单点功能的独占，而是**组合优势**：

> **透明执行 + 人类在环 + 断点恢复 + 智能上下文流转 + 量化评估**——没有一个竞品同时做到这五点。

具体而言：
1. **过程透明 + 人类在环**：关键节点支持审核门控，不是执行完才看结果
2. **断点恢复**：失败或中断后从上次成功的节点继续，竞品几乎都不支持
3. **智能上下文流转**：不是原文传递，而是支持截断/摘要后流转，控制 token 消耗
4. **量化评估闭环**：每次 run 的质量可评分、可对比、可追踪——评估驱动迭代

---

## 五、核心功能设计（v0.2.0）

### 5.1 上下文处理器（Context Processor）

#### 5.1.1 设计目标

解决上游 agent 输出传递给下游时的三个问题：
- prompt 膨胀（上游输出过长）
- 格式不可控（原文直接替换）
- 无法在流转时做摘要、截断等处理

#### 5.1.2 统一 Context 配置

将上下文处理统一为步骤级 `context` 配置块，一个配置，四个维度：

```yaml
steps:
  - id: research
    agent: gousheng
    task: 调研今天的 AI 新闻

  - id: write
    agent: cuihua
    depends_on: [research]
    context:
      from: research             # 读取哪个上游步骤的输出
      strategy: summarize        # raw | truncate | summarize
      max_tokens: 500            # truncate/summarize 时的目标长度
      inject_as: user            # system | user（注入位置）
    task: |
      根据以下调研摘要撰写公众号文章：

      {{context.research}}
```

#### 5.1.3 三种处理策略

| 策略 | 行为 | 适用场景 |
|------|------|----------|
| `raw` | 原文传递，兼容现有 `{{steps.X.output}}` 行为 | 上游输出短（< 500 tokens） |
| `truncate` | 按 `max_tokens` 截断 | 只需要前半部分信息 |
| `summarize` | 调用 LLM 生成摘要到 `max_tokens` 长度 | 上游输出长且信息密集 |

默认策略：不配置 `context` 时，保持现有的 `{{steps.X.output}}` 原文替换行为（向后兼容）。

#### 5.1.4 自动策略选择

可配置 `strategy: auto`，引擎根据上游输出长度自动选择：

| 上游输出长度 | 自动选择的策略 |
|-------------|---------------|
| ≤ 500 tokens | raw（原文传递） |
| 500 - 2000 tokens | truncate |
| > 2000 tokens | summarize |

阈值可在 `openagents.yaml` 中全局配置。

#### 5.1.5 模板变量

| 变量 | 说明 |
|------|------|
| `{{context.<from>}}` | 处理后的上下文内容（经过 raw/truncate/summarize） |
| `{{steps.<step_id>.output}}` | 原文内容（保持向后兼容） |

两种变量共存。`{{context.X}}` 走处理器管道，`{{steps.X.output}}` 走原始文件读取。

---

### 5.2 流式输出（Streaming）

#### 5.2.1 设计目标

让用户在 agent 执行时实时看到 LLM 的输出片段，而非黑盒等待。

#### 5.2.2 Runtime 接口扩展

在 `AgentRuntime` 接口新增流式方法：

```typescript
export interface AgentRuntime {
  execute(params: ExecuteParams): Promise<ExecuteResult>;

  // v0.2 新增：流式执行
  executeStream?(
    params: ExecuteParams,
    onChunk: (chunk: string) => void,
  ): Promise<ExecuteResult>;
}
```

`executeStream` 为可选方法（`?`），不支持流式的 runtime（如 ScriptRuntime）无需实现。引擎在流式模式下检查 runtime 是否实现了该方法，未实现则 fallback 到 `execute()`。

#### 5.2.3 CLI 体验

```bash
$ openagents run ai_news_pipeline --input "AI新闻" --stream

🚀 开始执行：AI 新闻自动化流水线
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/3] research (狗胜)
  状态：执行中... ⏳
  ▸ 正在搜索最新的 AI 领域动态...
  ▸ 发现 OpenAI 发布了新模型 GPT-5.3...
  ▸ MiniMax 发布 M2.7，支持 40+ skills...

[2/3] write (翠花)
  状态：等待上游完成 ⏸

[3/3] review (盛夏)
  状态：等待上游完成 ⏸
```

- 流式输出通过 `--stream` flag 开启，默认关闭（避免终端噪音）
- 流式输出和进度 UI 共存，不冲突

---

### 5.3 量化评估闭环

#### 5.3.1 设计目标

每次 workflow run 完成后，给出质量评分。评分可追踪、可对比、可驱动 agent 配置的迭代优化。

#### 5.3.2 Evaluator 接口

```typescript
// src/eval/interface.ts

export interface Evaluator {
  evaluate(params: EvalParams): Promise<EvaluationResult>;
}

export interface EvalParams {
  workflowId: string;
  runId: string;
  input: string;
  stepOutputs: Record<string, string>;  // stepId → output content
  evalConfig: EvalConfig;
}

export interface EvaluationResult {
  score: number;              // 0-100 综合评分
  dimensions: Record<string, {
    score: number;
    reason: string;
  }>;
  tokenCost: number;
  duration: number;
  comparedToLast?: {
    lastRunId: string;
    lastScore: number;
    scoreDelta: number;
    direction: 'improved' | 'declined' | 'unchanged';
  };
}
```

#### 5.3.3 LLM Judge 评估器（MVP）

MVP 阶段实现基于 LLM 的评估器。评估维度在 workflow YAML 中配置：

```yaml
workflow:
  id: ai_news_pipeline
  name: AI 新闻自动化流水线

eval:
  enabled: true
  type: llm-judge
  judge_model: qwen-plus
  dimensions:
    - name: relevance
      weight: 0.6
      prompt: |
        请评估以下新闻简报与主题"{{input}}"的相关性。
        标准：1）时效性 2）匹配度 3）信息价值
        请给出 0-100 的评分，并简述理由。
    - name: coherence
      weight: 0.4
      prompt: |
        请评估以下文章的结构和可读性。
        标准：1）逻辑连贯 2）段落衔接 3）语言流畅
        请给出 0-100 的评分，并简述理由。

steps:
  # ...
```

#### 5.3.4 评估结果存储

```
./output/<workflow>/<run_id>/
├── .state.json
├── events.jsonl
├── eval.json             # v0.2 新增
└── [steps...]
```

`eval.json` 示例：

```json
{
  "runId": "run_20260319_101100",
  "workflowId": "ai_news_pipeline",
  "evaluatedAt": "2026-03-19T10:12:00Z",
  "score": 82,
  "dimensions": {
    "relevance": { "score": 85, "reason": "新闻时效性好，与主题高度匹配" },
    "coherence": { "score": 80, "reason": "文章结构清晰，但段落间过渡略生硬" }
  },
  "tokenCost": 1200,
  "duration": 8500,
  "comparedToLast": {
    "lastRunId": "run_20260318_090000",
    "lastScore": 78,
    "scoreDelta": 4,
    "direction": "improved"
  }
}
```

#### 5.3.5 CLI 查看评估

```bash
$ openagents runs list --eval

RUN_ID                  WORKFLOW              SCORE   DELTA  STATUS
run_20260319_101100     ai_news_pipeline      82      +4     completed
run_20260318_090000     ai_news_pipeline      78      +6     completed
run_20260317_083000     ai_news_pipeline      72      -2     completed

$ openagents eval run_20260319_101100    # 手动触发/重新评估
```

---

### 5.4 引擎事件化解耦

#### 5.4.1 设计目标

将 `WorkflowEngine` 从 CLI 终端 UI 中解耦，使其成为纯逻辑 + 事件驱动的内核。这是 v0.4 Web UI 的架构基础。

#### 5.4.2 当前耦合点

| 耦合点 | 位置 | 问题 |
|--------|------|------|
| `deps.progressUI` | `WorkflowEngineDeps` 接口 | 引擎直接依赖终端 UI 实现 |
| `progressUI.updateStep()` | `executeStepCore` 内部 | 执行逻辑与 UI 渲染混合 |
| `progressUI.showGatePrompt()` | gate 处理逻辑 | 门控 UI 与引擎耦合 |
| `process.exit(0)` | SIGINT handler | 硬编码进程退出 |

#### 5.4.3 解耦方案

引入 `EngineEventHandler` 接口，替代直接 UI 调用：

```typescript
// src/engine/events.ts

export interface EngineEventHandler {
  onWorkflowStart(workflowName: string, plan: ExecutionPlan, state: RunState): void;
  onWorkflowComplete(state: RunState): void;
  onWorkflowFailed(state: RunState, error: Error): void;
  onWorkflowInterrupted(state: RunState): void;

  onStepStart(stepId: string): void;
  onStepComplete(stepId: string, result: StepCompleteInfo): void;
  onStepFailed(stepId: string, error: string): void;
  onStepRetry(stepId: string, attempt: number, maxAttempts: number, error: string): void;

  onStreamChunk?(stepId: string, chunk: string): void;

  onGateWaiting(stepId: string, output: string): void;
}
```

CLI 层实现 `CLIEventHandler`（内部封装 `ProgressUI`），保持现有终端体验不变。未来 Web UI 实现 `WebSocketEventHandler`，推送到浏览器。

---

## 六、核心功能设计（v0.3.0）

### 6.1 Skills 注册表

#### 6.1.1 设计目标

让 agent 的能力（skills）可以声明式注册、版本管理、跨 agent 复用。

#### 6.1.2 Skills 定义

```yaml
# skills/resume-checker.yaml
skill:
  id: resume-checker
  name: 简历审核
  description: 审核简历的完整性和专业度
  version: "1.0"

instructions: |
  请审核以下简历，从以下维度给出评分和改进建议：
  1. 信息完整度（联系方式、教育经历、工作经历）
  2. 成就量化程度（是否用数据描述成果）
  3. 关键词匹配度（针对目标岗位）
  4. 格式和排版

output_format: |
  ## 简历审核报告
  ### 综合评分：X/10
  ### 各维度评分
  ...
  ### 改进建议
  ...
```

#### 6.1.3 Agent 引用 Skills

```yaml
# agents/hr_assistant.yaml
agent:
  id: hr_assistant
  name: HR 助手
  description: 辅助 HR 完成简历筛选

skills:
  - resume-checker
  - interview-scheduler

prompt:
  system: |
    你是一位经验丰富的 HR 助手。
    你有以下技能可用：
    {{skills.resume-checker.instructions}}
```

#### 6.1.4 前置依赖：Function Calling

当前 `LLMDirectRuntime.execute()` 只做单轮 chat completion（发 prompt → 收 text response）。如果 agent 配备了工具（如 `web_search`），需要支持完整的 function calling 链路：

1. 将 tools schema 传给 LLM
2. LLM 返回 `tool_call`
3. 执行 tool，获取结果
4. 将 tool result 传回 LLM
5. LLM 给出最终 response

**Task 4.1（Function Calling 改造）是 Skills 和 MCP 的硬性前置依赖。**

### 6.2 MCP 工具集成

```yaml
# agents/researcher.yaml
agent:
  id: researcher
  name: 研究员

tools:
  - type: mcp
    server: tavily
    tool: web_search
  - type: mcp
    server: tavily
    tool: web_fetch
  - type: script
    path: ./scripts/format-report.sh
    args: ["{{input}}"]
```

MCP（Model Context Protocol）是 AI 工具调用的事实标准。v0.3 原生支持加载 MCP server 并将其工具注册给 agent 使用。

### 6.3 调试 HTTP 服务器

#### 6.3.1 设计目标

提供一个轻量级的本地 Web 调试界面，可视化 DAG 和执行状态。也作为 v0.4 Web UI 的技术验证原型。

#### 6.3.2 使用方式

```bash
$ openagents debug --port 3000

🔍 调试服务器已启动：http://localhost:3000

  DAG 可视化：http://localhost:3000/dag?workflow=novel_writing
  运行状态：  http://localhost:3000/run/run_20260319_101100

停止：Ctrl+C
```

#### 6.3.3 页面功能

| 路由 | 功能 |
|------|------|
| `/dag?workflow=xxx` | 展示 workflow 的 DAG 图，节点可点击查看配置 |
| `/run/<run_id>` | 实时展示运行状态，高亮当前节点 |
| `/run/<run_id>/step/<step_id>` | 查看节点输入、输出、耗时 |

技术方案：单 HTML 文件 + 内联 CSS/JS，不引入前端框架依赖。

### 6.4 运行元数据与分析

#### 6.4.1 元数据收集

每次 run 完成后，自动记录元数据到 `.runs/metadata.jsonl`：

```jsonl
{"runId":"run_20260319_101100","workflowId":"ai_news_pipeline","agents":["gousheng","cuihua","shengxia"],"models":["MiniMax-M2.7","MiniMax-M2.7","MiniMax-M2.7"],"score":82,"tokenCost":12500,"duration":143000,"createdAt":"2026-03-19T10:11:00Z"}
```

#### 6.4.2 分析命令

```bash
$ openagents analyze ai_news_pipeline

📊 AI 新闻自动化流水线 - 表现分析

历史运行：4 次
平均评分：76.5
平均耗时：148s
平均 Token 消耗：12,750

趋势：最近 3 次呈上升趋势（72 → 78 → 82）

建议：
  ✅ 当前 agent 配置效果良好
  💡 可尝试调整 gousheng 的 model 降低成本
```

---

## 七、技术架构（v0.2 更新）

### 7.1 新增模块

```
src/
├── engine/
│   ├── events.ts              # 引擎事件接口（v0.2 新增）
│   ├── context-processor.ts   # 上下文处理器（v0.2 新增）
│   ├── workflow-engine.ts     # 改造：事件驱动
│   ├── template.ts            # 扩展：{{context.X}} 变量
│   └── ...                    # 其余不变
├── eval/                      # 评估模块（v0.2 新增）
│   ├── interface.ts           # Evaluator 接口
│   ├── llm-judge.ts           # LLM Judge 实现
│   └── runner.ts              # 评估执行器
├── runtime/
│   └── llm-direct.ts          # 改造：增加 executeStream
├── cli/
│   ├── eval.ts                # eval 命令（v0.2 新增）
│   ├── event-handler.ts       # CLIEventHandler 适配器（v0.2 新增）
│   └── ...                    # run.ts 增加 --stream / --no-eval
└── ...
```

### 7.2 v0.3 新增模块

```
src/
├── skills/                    # Skills 注册表（v0.3 新增）
│   ├── registry.ts
│   └── mcp-loader.ts
├── debug/                     # 调试服务器（v0.3 新增）
│   ├── server.ts
│   └── static/
└── runtime/
    └── llm-direct.ts          # 改造：Function Calling 支持
```

### 7.3 配置文件更新

#### 7.3.1 全局配置（openagents.yaml）新增字段

```yaml
version: "1"

runtime:
  default_type: llm-direct
  default_model: MiniMax-M2.7

# v0.2 新增
context:
  auto_raw_threshold: 500        # auto 策略：原文传递阈值（tokens）
  auto_truncate_threshold: 2000  # auto 策略：截断阈值（tokens）
  summary_model: qwen-plus       # summarize 策略使用的模型

# v0.2 新增
eval:
  enabled: false                 # 全局开关
  default_judge_model: qwen-plus

retry:
  max_attempts: 2
  delay_seconds: 5

output:
  base_directory: ./output
  preview_lines: 10
```

#### 7.3.2 Workflow 配置新增字段

```yaml
workflow:
  id: ai_news_pipeline
  name: AI 新闻自动化流水线

# v0.2 新增
eval:
  enabled: true
  type: llm-judge
  judge_model: qwen-plus
  dimensions:
    - name: relevance
      weight: 0.6
      prompt: "..."
    - name: coherence
      weight: 0.4
      prompt: "..."

steps:
  - id: research
    agent: gousheng
    task: 调研 {{input}} 相关的 AI 新闻

  - id: write
    agent: cuihua
    depends_on: [research]
    # v0.2 新增
    context:
      from: research
      strategy: summarize
      max_tokens: 500
      inject_as: user
    task: |
      根据以下调研摘要撰写公众号文章：
      {{context.research}}
```

### 7.4 架构演进路线（为 v0.4 Web UI 铺路）

```
v0.1（当前）                v0.2（本轮改造）              v0.4（远景）
┌──────────┐              ┌──────────┐                ┌──────────┐
│ CLI 直接  │              │ CLI 通过  │                │ Web UI   │
│ 调用引擎  │   ──────>    │ 事件接口  │   ──────>      │ 通过事件  │
│ + UI     │              │ 适配 UI   │                │ + WS 推送 │
└──────────┘              └──────────┘                └──────────┘
```

v0.2 的核心架构改造：
1. `WorkflowEngine` 不再直接调用 `ProgressUI`，改为通过 `EngineEventHandler` 接口发出事件
2. CLI 层创建 `CLIEventHandler` 适配器，封装 `ProgressUI`，保持终端体验不变
3. 流式输出接口设计兼顾 CLI 回调和未来 WebSocket 推送
4. 门控交互通过事件接口抽象，不直接依赖 readline

---

## 八、CLI 命令更新

### 8.1 v0.2 新增

```bash
# 新增命令
openagents eval <run_id>                    # 手动触发评估

# 新增 flag
openagents run <workflow_id> --stream       # 开启流式输出
openagents run <workflow_id> --no-eval      # 跳过评估

# 更新命令
openagents runs list --eval                 # 显示评估分数列
```

### 8.2 v0.3 新增

```bash
openagents analyze <workflow_id>            # 分析历史表现
openagents debug [--port 3000]              # 启动调试服务器
openagents agents list --skills             # 显示 agent 注册的 skills
```

---

## 九、开发计划

### Phase 1：引擎解耦 + 上下文处理器（第 1-2 周）

#### Task 1.1：引擎事件化解耦

**目标**：将 `WorkflowEngine` 从 `ProgressUI` 中解耦，改为事件驱动架构。

**涉及文件**：
- 新建 `src/engine/events.ts`
- 修改 `src/engine/workflow-engine.ts`
- 修改 `src/types/index.ts`
- 新建 `src/cli/event-handler.ts`
- 修改 `src/cli/shared.ts`

**接口签名**：

```typescript
// src/engine/events.ts
export interface EngineEventHandler {
  onWorkflowStart(workflowName: string, plan: ExecutionPlan, state: RunState): void;
  onWorkflowComplete(state: RunState): void;
  onWorkflowFailed(state: RunState, error: Error): void;
  onWorkflowInterrupted(state: RunState): void;
  onStepStart(stepId: string): void;
  onStepComplete(stepId: string, info: {
    duration: number;
    outputPreview: string;
    tokenUsage?: TokenUsage;
  }): void;
  onStepFailed(stepId: string, error: string): void;
  onStepSkipped(stepId: string, error: string): void;
  onStepRetry(stepId: string, attempt: number, maxAttempts: number, error: string): void;
  onStreamChunk?(stepId: string, chunk: string): void;
  onGateWaiting(stepId: string, output: string, previewLines: number): void;
}
```

**改造要点**：
- `WorkflowEngineDeps` 中将 `progressUI: ProgressUI` 替换为 `eventHandler: EngineEventHandler`
- `executeWorkflow` 中所有 `this.deps.progressUI.xxx()` 调用改为 `this.deps.eventHandler.onXxx()`
- `CLIEventHandler` 内部持有 `ProgressUI` 实例，实现所有事件方法
- SIGINT handler 不再直接 `process.exit(0)`，改为通过回调通知上层

**验收标准**：
- [ ] 所有现有测试通过（`npm test`），无新增失败
- [ ] CLI 运行 `openagents run` 的终端输出与改造前完全一致
- [ ] `WorkflowEngine` 不再 import `ProgressUI`

---

#### Task 1.2：Context Processor 核心实现

**目标**：实现上下文处理器，支持 raw / truncate / summarize 三种策略。

**涉及文件**：
- 修改 `src/types/index.ts`：`StepConfig` 新增 `context` 字段
- 修改 `src/config/schema.ts`：新增 `ContextConfigSchema`
- 新建 `src/engine/context-processor.ts`
- 新建 `src/__tests__/context-processor.test.ts`

**类型定义**：

```typescript
// 新增到 src/types/index.ts
export type ContextStrategy = 'raw' | 'truncate' | 'summarize' | 'auto';

export interface StepContextConfig {
  from: string;                    // 上游步骤 ID
  strategy: ContextStrategy;       // 处理策略
  max_tokens?: number;             // truncate/summarize 目标长度
  inject_as?: 'system' | 'user';   // 注入位置，默认 'user'
}

// StepConfig 新增字段
export interface StepConfig {
  // ... 现有字段
  context?: StepContextConfig;
}
```

**Context Processor 接口**：

```typescript
// src/engine/context-processor.ts
export interface ProcessContextParams {
  rawContent: string;
  strategy: ContextStrategy;
  maxTokens?: number;
  autoThresholds?: { rawLimit: number; truncateLimit: number };
  summarizeRuntime?: AgentRuntime;
  summarizeModel?: string;
}

export async function processContext(params: ProcessContextParams): Promise<string>;
```

**验收标准**：
- [ ] `raw` 策略返回原文
- [ ] `truncate` 策略按 `max_tokens` 截断（按字符数近似）
- [ ] `summarize` 策略调用 LLM 生成摘要（测试中 mock runtime）
- [ ] `auto` 策略根据长度自动选择
- [ ] Zod schema 正确校验 `context` 配置
- [ ] `context.from` 引用不存在的步骤时校验报错

---

#### Task 1.3：模板系统 + 引擎集成

**目标**：在模板系统中支持 `{{context.<from>}}` 变量，并在引擎执行流程中集成 Context Processor。

**涉及文件**：
- 修改 `src/engine/template.ts`
- 修改 `src/engine/workflow-engine.ts`
- 修改 `src/__tests__/template.test.ts`

**改造要点**：

1. `renderTemplate` 新增对 `{{context.<step_id>}}` 变量的支持：
   - 从新增的 `context.processedContexts` 字段中读取处理后的内容
   - `TemplateContext` 新增 `processedContexts?: Record<string, string>`

2. `WorkflowEngine.executeStepCore` 在调用 runtime 之前：
   - 检查步骤是否配置了 `context`
   - 如果配置了，读取上游输出文件，调用 `processContext()`
   - 将处理后的内容存入 template context
   - 根据 `inject_as` 决定注入到 system prompt 还是 user prompt

**验收标准**：
- [ ] `{{context.research}}` 正确替换为处理后的内容
- [ ] `{{steps.research.output}}` 仍然返回原文（向后兼容）
- [ ] `inject_as: system` 时，处理后内容追加到 system prompt 尾部
- [ ] `inject_as: user` 时（默认），处理后内容在 user prompt 的模板变量中替换

---

### Phase 2：流式输出（第 2-3 周）

#### Task 2.1：Runtime 流式接口

**目标**：在 `AgentRuntime` 接口新增 `executeStream` 可选方法，`LLMDirectRuntime` 实现 SSE 流式解析。

**涉及文件**：
- 修改 `src/types/index.ts`
- 修改 `src/runtime/llm-direct.ts`
- 修改 `src/__tests__/llm-direct.test.ts`

**接口签名**：

```typescript
// src/types/index.ts - AgentRuntime 扩展
export interface AgentRuntime {
  execute(params: ExecuteParams): Promise<ExecuteResult>;
  executeStream?(
    params: ExecuteParams,
    onChunk: (chunk: string) => void,
  ): Promise<ExecuteResult>;
}
```

**LLMDirectRuntime 实现要点**：
- 请求时增加 `stream: true` 参数
- 解析 SSE 格式响应（`data: {...}\n\n`）
- 每收到一个 chunk 调用 `onChunk(delta.content)`
- 累积完整 output，最终返回 `ExecuteResult`
- 处理 `[DONE]` 标记
- 超时和错误处理与非流式保持一致

**验收标准**：
- [ ] 新增流式测试用例，mock SSE 响应，验证 onChunk 被正确调用
- [ ] 非流式 `execute()` 行为完全不变
- [ ] 流式模式下 `ExecuteResult.output` 包含完整内容
- [ ] 流式模式下 timeout 正常工作

---

#### Task 2.2：CLI 流式体验

**目标**：`run` 命令新增 `--stream` flag，流式模式下实时输出 LLM 响应片段。

**涉及文件**：
- 修改 `src/cli/run.ts`
- 修改 `src/engine/workflow-engine.ts`
- 修改 `src/cli/event-handler.ts`（CLIEventHandler 实现 onStreamChunk）

**改造要点**：
1. `run` 命令注册 `--stream` option
2. `WorkflowEngine.run()` / `resume()` 接受 `stream: boolean` 选项
3. `executeStepCore` 中，如果 `stream === true` 且 runtime 支持 `executeStream`，则调用流式方法
4. 每个 chunk 通过 `eventHandler.onStreamChunk(stepId, chunk)` 发出
5. `CLIEventHandler.onStreamChunk` 实现：在当前步骤的进度行下方实时打印 chunk

**验收标准**：
- [ ] `openagents run <wf> --stream` 能实时显示 LLM 输出片段
- [ ] 不带 `--stream` 时行为与之前完全一致
- [ ] 流式输出结束后，完整输出正确写入文件
- [ ] 流式模式下门控仍然正常工作

---

### Phase 3：量化评估闭环（第 3-4 周）

#### Task 3.1：评估框架

**目标**：实现 Evaluator 接口和 LLM Judge 评估器，支持在 workflow YAML 中配置评估维度。

**涉及文件**：
- 新建 `src/eval/interface.ts`
- 新建 `src/eval/llm-judge.ts`
- 新建 `src/eval/runner.ts`
- 修改 `src/types/index.ts`：新增 `EvalConfig` 等类型
- 修改 `src/config/schema.ts`：新增 `EvalConfigSchema`、`WorkflowConfig` 扩展 `eval` 字段
- 新建 `src/__tests__/eval.test.ts`

**EvalConfig 类型定义**：

```typescript
export interface EvalDimension {
  name: string;
  weight: number;
  prompt: string;
}

export interface EvalConfig {
  enabled: boolean;
  type: 'llm-judge';
  judge_model?: string;
  dimensions: EvalDimension[];
}
```

**LLMJudgeEvaluator 核心逻辑**：
1. 遍历 `dimensions`，对每个维度用 `judge_model` 评分
2. 向 LLM 发送评估 prompt（含步骤输出和输入），要求返回 JSON `{ "score": number, "reason": string }`
3. 加权计算综合评分
4. 查找该 workflow 的上一次 eval.json，计算 `comparedToLast`
5. 写入 `eval.json`

**验收标准**：
- [ ] mock LLM 返回评分 JSON 后，`evaluate()` 正确计算加权分
- [ ] `eval.json` 正确写入 output 目录
- [ ] `comparedToLast` 能正确找到上一次运行并计算 delta
- [ ] 评估维度 prompt 中的 `{{input}}` 变量正确替换
- [ ] Zod schema 正确校验 `eval` 配置块

---

#### Task 3.2：评估 CLI 集成

**目标**：新增 `eval` 命令，扩展 `runs list` 和 `run` 命令支持评估。

**涉及文件**：
- 新建 `src/cli/eval.ts`
- 修改 `src/cli/runs.ts`
- 修改 `src/cli/run.ts`
- 修改 `src/cli/index.ts`

**实现要点**：

1. `openagents eval <run_id>`：
   - 加载 run 的 state.json 确定 workflowId
   - 加载 workflow YAML 获取 eval 配置
   - 读取各步骤输出文件
   - 调用 `EvalRunner.evaluate()`
   - 输出评分结果到终端并写入 `eval.json`

2. `openagents run <wf>` 新增 `--no-eval` flag：
   - 默认：如果 workflow 配置了 `eval.enabled: true`，run 完成后自动触发评估
   - `--no-eval`：跳过评估

3. `openagents runs list --eval`：
   - 读取每个 run 目录下的 `eval.json`（如果存在）
   - 在列表中追加 SCORE 和 DELTA 列

**验收标准**：
- [ ] `openagents eval <run_id>` 能正确执行评估并输出结果
- [ ] `openagents run <wf>` 配置了 eval 时自动评估
- [ ] `--no-eval` 能跳过评估
- [ ] `runs list --eval` 正确显示评分列
- [ ] 无 eval 配置的 workflow 不触发评估，不报错

---

### Phase 4：能力扩展（v0.3.0 范围，后续迭代）

> 以下任务属于 v0.3.0 范围，在 v0.2.0 发布后启动。此处提供设计规格供参考。

#### Task 4.1：LLMDirectRuntime Function Calling 支持

**目标**：改造 `LLMDirectRuntime` 支持 OpenAI function calling 协议，支持多轮 tool_call 循环。

**涉及文件**：
- 修改 `src/types/index.ts`：`ExecuteParams` 新增 `tools` 字段
- 修改 `src/runtime/llm-direct.ts`：实现 tool_call → execute tool → feed back 循环

**接口变更**：

```typescript
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;  // JSON Schema
  };
}

export interface ExecuteParams {
  // ... 现有字段
  tools?: ToolDefinition[];
  toolExecutor?: (name: string, args: Record<string, unknown>) => Promise<string>;
}
```

**验收标准**：
- [ ] 不传 `tools` 时行为与之前完全一致
- [ ] 传 `tools` 时，LLM 返回 tool_call 能正确执行并继续对话
- [ ] 多轮 tool_call 正常工作
- [ ] 最终返回完整的文本 response

---

#### Task 4.2：Skills 注册表

**涉及文件**：新建 `src/skills/registry.ts`，修改 `src/config/loader.ts`、`src/engine/template.ts`

**验收标准**：
- [ ] `skills/*.yaml` 能被正确加载和校验
- [ ] agent 中通过 `skills: [id]` 引用
- [ ] `{{skills.<id>.instructions}}` 在模板中正确替换

---

#### Task 4.3：MCP 工具加载器

**涉及文件**：新建 `src/skills/mcp-loader.ts`

**验收标准**：
- [ ] 能加载 MCP server 配置
- [ ] 将 MCP 工具转换为 `ToolDefinition` 格式
- [ ] 与 Function Calling 集成工作

---

#### Task 4.4：调试 HTTP 服务器

**涉及文件**：新建 `src/debug/server.ts`、`src/debug/static/`、修改 `src/cli/debug.ts`

**验收标准**：
- [ ] `openagents debug --port 3000` 启动 HTTP 服务器
- [ ] `/dag?workflow=xxx` 展示 DAG 可视化
- [ ] `/run/<run_id>` 展示运行状态
- [ ] `Ctrl+C` 正常关闭

---

#### Task 4.5：运行元数据 + analyze 命令

**涉及文件**：新建 `src/cli/analyze.ts`，修改 `src/engine/workflow-engine.ts`

**验收标准**：
- [ ] 每次 run 完成后自动写入 `.runs/metadata.jsonl`
- [ ] `openagents analyze <workflow_id>` 输出历史统计
- [ ] 包含平均评分、趋势、token 消耗等指标

---

## 十、验收标准

### 10.1 v0.2.0 功能验收

| # | 验收项 | 目标 |
|---|--------|------|
| 1 | 上下文处理器 | 三节点 workflow 使用 `context.strategy: summarize` 自动摘要流转，无需人工复制 |
| 2 | 向后兼容 | `{{steps.X.output}}` 原文替换行为不变，不配置 `context` 的 workflow 行为完全不变 |
| 3 | 流式输出 | `--stream` flag 开启后，终端实时显示 LLM 输出片段 |
| 4 | 量化评估 | run 完成后生成 eval.json，`runs list --eval` 显示分数和趋势 |
| 5 | 引擎解耦 | `WorkflowEngine` 不直接 import `ProgressUI`，通过事件接口通信 |
| 6 | 所有旧测试通过 | `npm test` 全部绿色 |

### 10.2 v0.2.0 体验验收

| # | 验收项 | 目标 |
|---|--------|------|
| 1 | 多 agent 流水线 | 完整跑通"狗胜调研 → 翠花写稿"流水线（带 context summarize），总耗时 < 5 分钟 |
| 2 | 评估可操作性 | 同一 workflow 跑 3 次，`runs list --eval` 能看到分数变化趋势 |
| 3 | 流式体验 | `--stream` 模式下能看到逐字输出，体验流畅 |

### 10.3 v0.3.0 功能验收

| # | 验收项 | 目标 |
|---|--------|------|
| 1 | Skills 注册表 | 能声明式注册 skill 并在 agent prompt 中引用 |
| 2 | MCP 工具 | 能加载 MCP server 并调用其工具 |
| 3 | Function Calling | LLM 返回 tool_call 能正确执行并继续对话 |
| 4 | 调试服务器 | `openagents debug` 启动后浏览器能看到 DAG 可视化 |
| 5 | 运行分析 | `openagents analyze` 输出有意义的历史统计和建议 |

---

## 十一、设计决策记录

### Q1：为什么将 Processor / Context / 长程记忆合并为统一 context 配置？

原 PRD 草稿中有三个重叠概念：`processor`（输出截断/摘要）、`context.inject_summary`（跨 agent 上下文注入）、长程记忆（WorkflowContext 对象）。三者本质上解决同一个问题——控制上游输出传递给下游的方式和粒度。合并为一个 `context` 配置块后，用户只需要理解一个概念，YAML 配置更简洁，实现也更集中。

### Q2：为什么流式输出是可选方法（`executeStream?`）？

不是所有 runtime 都支持流式（如 ScriptRuntime）。设计为可选方法，引擎在流式模式下先检查 runtime 是否实现了 `executeStream`，未实现则 fallback 到 `execute()`。这样不需要每个 runtime 都实现空壳方法。

### Q3：为什么评估用 LLM Judge 而不是规则匹配？

规则匹配（如关键词出现次数）过于脆弱，无法评估文章的逻辑连贯性、风格适配度等主观维度。LLM Judge 虽然不完全精确，但在足够的 prompt 设计下，能给出相对可靠的相对评分。MVP 阶段先用 LLM Judge，后续可以引入更多评估器类型。

### Q4：为什么要在 v0.2 就做引擎解耦？

v0.4 计划做 Web UI，如果到那时再解耦引擎，改动面会非常大（引擎、CLI、测试都要重写）。在 v0.2 趁功能增量不大时做好解耦，后续 Web UI 只需要实现 `WebSocketEventHandler`，引擎层完全不用动。代价是 v0.2 多一周工作量，但为 v0.4 节省数周。

### Q5：为什么 Skills/MCP 放在 v0.3 而不是 v0.2？

Skills/MCP 依赖 Function Calling 改造——需要 `LLMDirectRuntime` 支持多轮 tool_call 循环，这是一个不小的改动。v0.2 的 4 周已经满负荷（解耦 + Context + Streaming + Eval），再加 Function Calling 风险太高。先在 v0.2 打好引擎基础，v0.3 专注工具能力。

### Q6：竞品矩阵为什么修改了？

原草稿中将 LangGraph 的流式输出标为"不支持"，但 LangGraph 的 `.stream()` 是其核心 API；将 CrewAI 的输出流转标为"不支持"，但 CrewAI 的 Task output 自动传递给下一个 Task。竞品分析的诚实性对开源项目信誉至关重要。openAgents 的差异化应该定位在"组合优势"（透明 + 门控 + 断点 + 评估），而非声称单点功能独占。

---

## 十二、远景：v0.4 Web UI 方向

### 12.1 背景

当前 CLI 模式面向程序员和 AI 工具链用户，限制了目标用户群体。Web UI 能大幅拓宽用户范围，让非技术用户也能使用 agent 工作流。

### 12.2 架构方向

**本地优先**：通过 `openagents serve` 启动本地 Web 服务，保持"零外部依赖"的上手优势。用户无需部署服务器，在本机即可使用。

```bash
$ openagents serve --port 3000
🌐 openAgents Web UI: http://localhost:3000
```

### 12.3 技术选型

| 选型 | 方案 | 理由 |
|------|------|------|
| 前端框架 | React + Next.js（或 Vite + React） | 生态成熟，SSR 可选，社区支持好 |
| 实时通信 | WebSocket | 引擎事件实时推送到浏览器 |
| 后端 | 复用现有 Node.js 引擎 | 不引入新的后端语言/框架 |
| DAG 可视化 | React Flow 或 D3.js | 拖拽编辑 DAG 节点和连线 |
| 状态管理 | Zustand 或 Redux Toolkit | 前端状态管理 |

### 12.4 核心体验

Web UI 的三个核心体验（做好就有强差异化）：

1. **DAG 可视化编辑**：拖拽创建 agent 节点，连线定义依赖，替代手写 YAML
2. **实时执行监控**：通过 WebSocket 实时展示每个节点的状态、流式输出、评分
3. **门控审批界面**：Web 端完成审核确认/编辑/拒绝，比终端交互更友好

### 12.5 与 v0.2 的衔接

v0.2 的架构改造（引擎事件化解耦）是 Web UI 的基础：
- `EngineEventHandler` 接口 → Web UI 实现 `WebSocketEventHandler`
- 流式输出回调 → WebSocket 实时推送 chunk
- 门控事件 → Web 端审批界面

v0.3 的调试 HTTP 服务器是 Web UI 的技术验证原型——验证引擎 + HTTP 层的集成方式。

---

**文档版本历史**：

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-03-14 | 初始版本 |
| v2.0 | 2026-03-14 | 增加编排层和可扩展性设计 |
| v2.1 | 2026-03-14 | 增加任务队列和持久化系统 |
| v3.0 | 2026-03-14 | 回归 MVP 本质，聚焦核心差异化 |
| v4.0 | 2026-03-19 | 上下文处理器 + 流式输出 + 评估闭环 + 引擎解耦 + 远景规划（整合评审反馈后定稿） |
