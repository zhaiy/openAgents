# openAgents - 产品需求文档（PRD）v3.0

**版本**: v3.0  
**状态**: 定稿  
**创建日期**: 2026-03-14  
**作者**: 翟扬  
**项目地址**: https://github.com/openagents

---

## 一、我们要解决什么问题？

### 1.1 痛点描述

当前主流 AI Agent 工具（OpenClaw、Cursor Agent、Claude Code 等）在执行多步骤任务时存在一个共性问题：

> **执行过程是黑盒的。**

用户提交任务后：
- 不知道当前执行到了哪一步
- 不知道每一步产出了什么
- 无法在中途修正方向
- 失败后无法从断点恢复
- 多个 Agent 协作时无法追踪信息流转

**举例**：用一个 AI Agent 写一篇小说，你只能等它写完才能看到结果。如果大纲方向就错了，后面写的 3000 字全部浪费。如果你能在大纲阶段就审核并调整，整体效率和质量都会大幅提升。

### 1.2 产品定位

> **openAgents** —— 透明可控的多 Agent 协作引擎
>
> 让每一步 AI 执行都看得见、管得住、查得到。

### 1.3 核心价值（三个关键词）

| 关键词 | 含义 |
|--------|------|
| **看得见** | 实时展示工作流执行进度、每个节点的状态和产出 |
| **管得住** | 支持暂停、中断、修改参数后继续、从断点恢复 |
| **查得到** | 完整的执行日志和产出记录，支持事后回溯和审计 |

---

## 二、目标用户

### 2.1 MVP 阶段唯一目标用户：开发者

| 特征 | 描述 |
|------|------|
| **技术背景** | 熟悉命令行、YAML、基本的 AI API 调用 |
| **使用场景** | 用多个 AI Agent 协作完成内容创作、代码生成、数据处理等任务 |
| **核心诉求** | 希望 Agent 执行过程透明可控，而非黑盒 |
| **次要诉求** | 希望工作流可复用、可分享、可版本管理 |

### 2.2 典型用户故事

**故事 1：AI 内容创作者**
> 作为一个用 AI 写网文的创作者，我希望让"大纲 Agent"和"写作 Agent"分步执行，并且在大纲完成后我能审核通过才继续写正文，这样我不用浪费 token 在错误方向的内容上。

**故事 2：AI 应用开发者**
> 作为一个开发 AI 应用的程序员，我希望把复杂任务拆成多个 Agent 节点的 DAG 工作流，每个节点的执行状态和输出都能实时查看，失败时能自动重试或手动介入。

**故事 3：AI 工具探索者**
> 作为一个尝试各种 AI Agent 工具的技术爱好者，我希望有一个统一的编排层，底层可以接入 OpenClaw、OpenCode、Claude Code 等不同 Agent 运行时，我只需要关注工作流逻辑，不需要每个工具都单独学习。

---

## 三、竞品分析

### 3.1 竞品矩阵

| 能力 | CrewAI | LangGraph | AutoGen | Dify | **openAgents** |
|------|--------|-----------|---------|------|----------------|
| 多 Agent 编排 | ✅ | ✅ | ✅ | ✅ | ✅ |
| DAG 工作流 | ❌ (线性) | ✅ | ✅ | ✅ | ✅ |
| **实时进度可视** | ❌ | ❌ | ❌ | 部分 | ✅ **核心特性** |
| **执行中断/恢复** | ❌ | ❌ | ❌ | ❌ | ✅ **核心特性** |
| **节点审核门控** | ❌ | ❌ | 部分 | ❌ | ✅ **核心特性** |
| 执行回溯/审计 | ❌ | ❌ | 部分 | 部分 | ✅ |
| 多运行时支持 | ❌ | ❌ | ❌ | 部分 | ✅ |
| 语言生态 | Python | Python | Python | Web | TypeScript |
| 上手难度 | 中 | 高 | 高 | 低 | 中 |
| 开源 | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.2 我们的差异化

**一句话**：别人做的是"Agent 编排"，我们做的是"Agent 编排 + 过程治理"。

具体来说：
1. **过程透明**：不是执行完才看结果，而是每一步实时可见
2. **人类在环**：关键节点支持审核门控（human-in-the-loop），人可以介入决策
3. **断点恢复**：失败或中断后不需要从头开始，从上次成功的节点继续
4. **运行时无关**：底层 Agent 可以是 OpenClaw、OpenCode、Claude Code，甚至直接调用 LLM API

---

## 四、MVP 功能设计（2-3 周）

### 4.1 功能边界

**MVP 包含（必须有）：**
- ✅ Agent 配置（YAML）
- ✅ DAG 工作流定义和执行
- ✅ **实时进度展示**（终端实时输出每个节点状态）
- ✅ **节点审核门控**（human-in-the-loop）
- ✅ **执行中断与断点恢复**
- ✅ 执行日志和产出保存
- ✅ CLI 工具

**MVP 不包含（后续版本）：**
- ❌ Web UI（v0.2）
- ❌ 任务队列和并发控制（v0.2）
- ❌ 任务持久化到数据库（v0.2）
- ❌ REST API（v0.3）
- ❌ 向量数据库集成
- ❌ Redis 缓存
- ❌ S3/OSS 云存储
- ❌ 多用户支持

### 4.2 核心功能详细设计

#### 4.2.1 Agent 配置

通过 YAML 文件定义 Agent 的身份、能力和运行参数。

```yaml
# agents/writer.yaml
agent:
  id: writer
  name: 写作助手
  description: 擅长根据大纲撰写小说章节

prompt:
  system: |
    你是一位经验丰富的网文作家。
    写作风格：细腻、有画面感、善于刻画人物心理。
    输出要求：只输出正文内容，不要加标题和序号。

runtime:
  type: openclaw          # openclaw | opencode | claude-code | llm-direct
  model: qwen3.5-plus
  timeout_seconds: 300
```

**设计说明**：
- `prompt.system` 替代之前的 persona 配置，直接使用 system prompt，语义更清晰，开发者也更熟悉
- `runtime.type` 支持多种 Agent 运行时，MVP 阶段先实现 `llm-direct`（直接调用 LLM API），后续扩展其他运行时
- 不引入 persona.tone / persona.proactivity 等抽象概念，直接让用户在 system prompt 中描述即可

#### 4.2.2 工作流定义（DAG）

```yaml
# workflows/novel_writing.yaml
workflow:
  id: novel_writing
  name: 小说创作工作流
  description: 从大纲到成稿的完整创作流程

steps:
  - id: outline
    agent: planner
    task: |
      根据以下主题生成一份小说大纲，包含：
      1. 故事梗概（200字）
      2. 主要角色（3-5个）
      3. 章节规划（至少5章）

      主题：{{input}}
    gate: approve       # 审核门控：需要用户审核通过才继续

  - id: chapter_1
    agent: writer
    depends_on: [outline]
    task: |
      根据以下大纲撰写第1章，要求3000字左右。

      大纲：
      {{steps.outline.output}}

  - id: review
    agent: reviewer
    depends_on: [chapter_1]
    task: |
      审核以下章节，从剧情、人物、文笔三个维度给出评分（1-10）和改进建议。

      章节内容：
      {{steps.chapter_1.output}}

output:
  directory: ./output/{{workflow.id}}/{{run.id}}
```

**关键设计点**：

**a) 变量模板系统**

| 变量 | 含义 |
|------|------|
| `{{input}}` | 用户运行时传入的输入 |
| `{{steps.<step_id>.output}}` | 某个前置节点的输出 |
| `{{workflow.id}}` | 工作流 ID |
| `{{run.id}}` | 本次执行的唯一 ID |

**b) 审核门控（gate）**

节点支持配置 `gate` 字段，决定节点完成后的行为：

| gate 值 | 行为 |
|---------|------|
| 无 / `auto` | 自动继续执行下一节点 |
| `approve` | 暂停执行，在终端展示该节点输出，等待用户输入 `yes` 继续 / `no` 终止 / `edit` 修改后继续 |

这是 openAgents 的**核心差异化功能**。

**c) 依赖关系**

- `depends_on` 定义节点间的依赖，系统自动构建 DAG
- 没有依赖关系的节点可以并行执行
- 拓扑排序确定执行顺序

#### 4.2.3 实时进度展示

执行工作流时，终端实时展示进度：

```
$ openagents run novel_writing --input "悬疑小说，女主穿越寻找记忆碎片"

🚀 开始执行工作流：小说创作工作流
   运行 ID：run_20260314_143022

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/3] outline (大纲规划师)
  状态：执行中... ⏳
  已耗时：12s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/3] outline (大纲规划师)
  状态：✅ 完成 (耗时 28s)
  产出已保存：./output/novel_writing/run_20260314_143022/outline.md

  ┌─── 产出预览 ───────────────────────────┐
  │ 故事梗概：                               │
  │ 林晚棠在一次意外中失去了所有记忆...       │
  │ ...                                      │
  └──────────────────────────────────────────┘

  🔒 审核门控：此节点需要你确认后才继续
  > 输入 yes 继续 / no 终止 / edit 修改后继续：yes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[2/3] chapter_1 (写作助手)
  状态：执行中... ⏳
  已耗时：45s

...
```

**设计要点**：
- 每个节点的状态实时更新（pending → running → completed / failed）
- 完成的节点立即展示产出预览（可配置预览长度）
- 审核门控节点暂停等待用户输入
- 所有输出同步保存到本地文件

#### 4.2.4 执行中断与断点恢复

**中断**：用户随时可以按 `Ctrl+C` 中断执行。系统自动保存当前状态。

**恢复**：

```bash
# 查看历史执行记录
openagents runs list

# 输出示例：
# RUN_ID                  WORKFLOW         STATUS      PROGRESS  CREATED
# run_20260314_143022     novel_writing    interrupted 1/3       2026-03-14 14:30
# run_20260314_120000     novel_writing    completed   3/3       2026-03-14 12:00

# 从断点恢复
openagents resume run_20260314_143022

# 系统会跳过已完成的节点，从中断处继续
```

**实现原理**：
- 每个节点完成后，将状态和输出写入本地状态文件（`./output/<workflow>/<run_id>/.state.json`）
- 恢复时加载状态文件，识别已完成的节点，从第一个未完成的节点继续

状态文件结构：

```json
{
  "runId": "run_20260314_143022",
  "workflowId": "novel_writing",
  "status": "interrupted",
  "input": "悬疑小说，女主穿越寻找记忆碎片",
  "startedAt": 1710403822000,
  "steps": {
    "outline": {
      "status": "completed",
      "startedAt": 1710403822000,
      "completedAt": 1710403850000,
      "outputFile": "outline.md"
    },
    "chapter_1": {
      "status": "interrupted",
      "startedAt": 1710403855000
    },
    "review": {
      "status": "pending"
    }
  }
}
```

#### 4.2.5 执行日志

每次执行自动生成事件日志（JSONL 格式），便于事后回溯：

```
./output/novel_writing/run_20260314_143022/
├── .state.json          # 执行状态（用于断点恢复）
├── events.jsonl         # 事件日志
├── outline.md           # 节点产出
├── chapter_1.md
└── review.md
```

`events.jsonl` 示例：

```jsonl
{"ts":1710403822000,"event":"workflow.started","data":{"workflowId":"novel_writing","input":"..."}}
{"ts":1710403822000,"event":"step.started","data":{"stepId":"outline","agent":"planner"}}
{"ts":1710403850000,"event":"step.completed","data":{"stepId":"outline","duration":28000,"outputFile":"outline.md"}}
{"ts":1710403851000,"event":"gate.waiting","data":{"stepId":"outline","gateType":"approve"}}
{"ts":1710403860000,"event":"gate.approved","data":{"stepId":"outline"}}
{"ts":1710403860000,"event":"step.started","data":{"stepId":"chapter_1","agent":"writer"}}
```

---

## 五、CLI 命令设计

```bash
# 运行工作流
openagents run <workflow_id> --input "..."

# 从断点恢复
openagents resume <run_id>

# 查看历史执行记录
openagents runs list
openagents runs list --status completed
openagents runs list --workflow novel_writing

# 查看某次执行的详情
openagents runs show <run_id>

# 查看某次执行的事件日志
openagents runs logs <run_id>

# 列出所有已配置的 Agent
openagents agents list

# 列出所有工作流
openagents workflows list

# 验证配置文件
openagents validate
```

---

## 六、首次使用体验（First-Run Experience）

这是用户第一次接触 openAgents 的完整体验流程，必须在 5 分钟内完成：

```bash
# Step 1: 安装（30 秒）
npm install -g openagents

# Step 2: 初始化示例项目（10 秒）
openagents init my-first-project
cd my-first-project

# 自动生成：
# my-first-project/
# ├── agents/
# │   ├── planner.yaml      # 大纲规划 Agent
# │   ├── writer.yaml       # 写作 Agent
# │   └── reviewer.yaml     # 审核 Agent
# ├── workflows/
# │   └── novel_writing.yaml  # 小说创作工作流
# └── openagents.yaml         # 项目配置（运行时、模型等）

# Step 3: 配置 API Key（30 秒）
# 编辑 openagents.yaml，填入你的 LLM API Key
# 或通过环境变量：
export OPENAGENTS_API_KEY=sk-xxxxx

# Step 4: 运行！（3 分钟体验核心功能）
openagents run novel_writing --input "写一个关于时间旅行的短篇悬疑故事"

# 体验：实时进度 → 审核门控 → 最终产出
```

---

## 七、技术架构

### 7.1 整体架构

```
┌──────────────────────────────────────────────────┐
│                   CLI 层                          │
│  openagents run / resume / runs / agents / ...   │
└──────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────┐
│                  工作流引擎                        │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  DAG 解析   │  │  节点调度    │  │  门控    │ │
│  │  + 拓扑排序  │  │  + 依赖触发  │  │  管理    │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  状态管理   │  │  进度展示    │               │
│  │  + 断点恢复  │  │  (终端 UI)  │               │
│  └─────────────┘  └─────────────┘               │
└──────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────┐
│               Agent 运行时层                      │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           AgentRuntime 接口                 │  │
│  ├────────────┬───────────┬───────────────────┤  │
│  │ LLMDirect  │ OpenClaw  │  (将来可扩展)     │  │
│  │ (MVP 默认)  │           │  OpenCode         │  │
│  │            │           │  ClaudeCode        │  │
│  └────────────┴───────────┴───────────────────┘  │
└──────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────┐
│                 本地文件系统                       │
│                                                  │
│  ./output/<workflow>/<run_id>/                    │
│  ├── .state.json     (执行状态)                   │
│  ├── events.jsonl    (事件日志)                   │
│  └── <step>.md       (节点产出)                   │
└──────────────────────────────────────────────────┘
```

### 7.2 技术栈

| 选型 | 方案 | 理由 |
|------|------|------|
| 语言 | TypeScript + Node.js | 异步友好，生态丰富 |
| CLI 框架 | Commander.js | 轻量成熟 |
| 终端 UI | ora + chalk + boxen | 进度条、彩色输出、边框 |
| 配置解析 | js-yaml + zod | YAML 解析 + 类型校验 |
| 日志 | 自研（JSONL 文件追加） | 简单够用，无需第三方依赖 |
| 存储 | 本地文件系统 | MVP 阶段最简方案 |

### 7.3 项目目录结构

```
openAgents/
├── src/
│   ├── cli/                    # CLI 命令
│   │   ├── index.ts            # 入口
│   │   ├── run.ts              # run 命令
│   │   ├── resume.ts           # resume 命令
│   │   ├── runs.ts             # runs list/show/logs 命令
│   │   └── init.ts             # init 命令
│   ├── engine/                 # 工作流引擎（核心）
│   │   ├── workflow-engine.ts  # 工作流执行引擎
│   │   ├── dag.ts              # DAG 解析与拓扑排序
│   │   ├── scheduler.ts        # 节点调度（依赖触发）
│   │   ├── gate.ts             # 审核门控
│   │   └── state.ts            # 状态管理与断点恢复
│   ├── runtime/                # Agent 运行时
│   │   ├── interface.ts        # AgentRuntime 接口定义
│   │   ├── llm-direct.ts       # 直接调用 LLM API（MVP 默认）
│   │   └── openclaw.ts         # OpenClaw 运行时（示例扩展）
│   ├── config/                 # 配置加载与校验
│   │   ├── loader.ts           # YAML 配置加载
│   │   └── schema.ts           # Zod 校验 schema
│   ├── output/                 # 产出与日志管理
│   │   ├── writer.ts           # 文件写入
│   │   └── logger.ts           # 事件日志（JSONL）
│   ├── ui/                     # 终端 UI
│   │   └── progress.ts         # 实时进度展示
│   └── types/                  # 类型定义
│       └── index.ts
├── templates/                  # init 命令的项目模板
│   ├── agents/
│   ├── workflows/
│   └── openagents.yaml
├── docs/
├── package.json
├── tsconfig.json
└── README.md
```

### 7.4 核心接口设计

MVP 阶段只定义一个需要扩展的接口——Agent 运行时：

```typescript
// src/runtime/interface.ts

export interface AgentRuntime {
  /**
   * 执行一个 Agent 任务
   */
  execute(params: ExecuteParams): Promise<ExecuteResult>;
}

export interface ExecuteParams {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  timeoutSeconds: number;
}

export interface ExecuteResult {
  output: string;
  tokensUsed?: number;
  duration: number;
}
```

其他模块（日志、存储、缓存等）在 MVP 阶段硬编码实现，不抽象接口。等到有真实扩展需求时再重构提取接口。

---

## 八、开发计划（3 周）

### Phase 1：基础骨架（第 1 周）

| 天 | 任务 | 产出 |
|----|------|------|
| Day 1 | 项目初始化：TypeScript + ESLint + 目录结构 | 可编译的空项目 |
| Day 2 | 配置加载：YAML 解析 + Zod 校验 | 能加载 agent 和 workflow 配置 |
| Day 3 | DAG 解析 + 拓扑排序 | 能正确解析依赖关系并排序 |
| Day 4 | LLM Direct 运行时 | 能直接调用 LLM API 执行任务 |
| Day 5 | 基础 CLI（run 命令） | 能执行一个简单的线性工作流 |

**里程碑 1**：能通过 CLI 运行一个线性工作流（A→B→C），每一步调用 LLM 并输出结果。

### Phase 2：核心特性（第 2 周）

| 天 | 任务 | 产出 |
|----|------|------|
| Day 1 | 实时进度展示（终端 UI） | 执行时能看到每个节点的状态变化 |
| Day 2 | 审核门控（gate） | 支持 approve 门控，暂停等待用户确认 |
| Day 3 | 状态持久化 + 断点恢复 | 支持 Ctrl+C 中断后 resume 恢复 |
| Day 4 | 事件日志（events.jsonl） | 完整的执行过程记录 |
| Day 5 | CLI 完善（resume / runs list / runs show / runs logs） | 完整的 CLI 命令 |

**里程碑 2**：能运行带审核门控的工作流，中断后能恢复，能查看历史记录和日志。

### Phase 3：打磨发布（第 3 周）

| 天 | 任务 | 产出 |
|----|------|------|
| Day 1 | init 命令 + 项目模板 | 5 分钟上手体验 |
| Day 2 | validate 命令 + 错误提示优化 | 友好的错误信息 |
| Day 3 | 并行节点执行 | 无依赖关系的节点并行调用 |
| Day 4 | 重试机制（节点级别） | 节点失败自动重试 |
| Day 5 | README + 示例工作流 + 发布准备 | 可发布的开源项目 |

**里程碑 3**：完整可用的 MVP，附带示例，README 清晰，可以发布到 GitHub。

---

## 九、验收标准

### 9.1 功能验收

| # | 验收项 | 说明 |
|---|--------|------|
| 1 | 配置加载 | 能正确加载并校验 agent 和 workflow 的 YAML 配置 |
| 2 | DAG 执行 | 能按依赖关系正确执行多节点工作流 |
| 3 | 实时进度 | 终端中实时展示每个节点的状态和耗时 |
| 4 | 审核门控 | approve 类型节点暂停等待用户确认，支持 yes/no/edit |
| 5 | 断点恢复 | Ctrl+C 中断后，resume 命令能从断点继续 |
| 6 | 事件日志 | 每次执行生成完整的 events.jsonl |
| 7 | 产出保存 | 每个节点的输出保存为独立文件 |
| 8 | 并行执行 | 无依赖关系的节点并行调用 |
| 9 | 节点重试 | 节点失败后自动重试（可配置次数） |
| 10 | init 体验 | openagents init 生成可直接运行的示例项目 |

### 9.2 体验验收

| # | 验收项 | 目标 |
|---|--------|------|
| 1 | 首次使用 | 从安装到成功运行第一个工作流 ≤ 5 分钟 |
| 2 | 配置错误提示 | YAML 写错时给出明确的错误位置和修复建议 |
| 3 | 自用验证 | 作者自己至少用 openAgents 完成 2 个真实任务 |

---

## 十、后续版本规划

| 版本 | 核心功能 | 前置条件 |
|------|----------|----------|
| **v0.1 (MVP)** | CLI + DAG 执行 + 门控 + 断点恢复 | 本 PRD |
| **v0.2** | Web UI（可视化工作流管理 + 实时监控面板） | MVP 自用验证通过 |
| **v0.3** | 任务队列 + 并发控制 + SQLite 持久化 | 有多任务并发的真实需求 |
| **v0.4** | 更多 Runtime（OpenClaw / OpenCode / Claude Code） | 有用户提出集成需求 |
| **v0.5** | 信息编排（节点间输出自动摘要 + token 控制） | 工作流节点 > 5 个的真实场景 |
| **v1.0** | REST API + 多用户 + 完善的扩展接口体系 | 社区活跃度达标 |

---

## 十一、设计决策记录

### Q1：为什么 MVP 不做 Web UI？

CLI 能在 3 周内交付核心价值。Web UI 至少额外需要 4 周（前端框架 + 实时通信 + 部署），但不影响核心体验。先用 CLI 验证产品逻辑，再用 Web UI 提升体验。

### Q2：为什么 MVP 只实现 llm-direct 运行时？

OpenClaw / OpenCode / Claude Code 各自有不同的 API 和认证方式，适配成本高。直接调用 LLM API 是最通用的方式，能覆盖 90% 的场景。留好 `AgentRuntime` 接口，后续扩展只需新增一个实现文件。

### Q3：为什么用本地文件而不是数据库？

MVP 阶段任务量小（一个用户，几十次运行），本地文件完全够用。JSON + JSONL 格式可读性好，方便调试。不引入数据库可以减少安装依赖，降低上手门槛。

### Q4：为什么 MVP 不做接口抽象？

过早抽象会增加代码复杂度，降低开发速度。MVP 阶段只有一种实现（Console Logger、本地文件存储、LLM Direct 运行时），抽象没有收益。等到真的需要第二种实现时，再提取接口（此时对接口的设计也更准确）。

### Q5：审核门控（gate）为什么是核心功能？

这是 openAgents 与其他 Agent 编排工具的最大差异。它实现了 human-in-the-loop，让用户在关键决策点介入，避免 Agent 在错误方向上浪费大量 token。这也是用户痛点最集中的地方——"我想在大纲阶段就审核，而不是等 3000 字写完才发现方向不对"。

---

**文档版本历史**：

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-03-14 | 初始版本 |
| v2.0 | 2026-03-14 | 增加编排层和可扩展性设计 |
| v2.1 | 2026-03-14 | 增加任务队列和持久化系统 |
| v3.0 | 2026-03-14 | 回归 MVP 本质，聚焦核心差异化 |
