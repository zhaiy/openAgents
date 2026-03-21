# openAgents - Web UI 技术设计（MVP）

**版本**: v1.0  
**对应 PRD**: `PRD-v5.md`  
**状态**: 草案 / 待评审  
**创建日期**: 2026-03-20  
**作者**: 翟扬 / Codex  
**设计目标**: 在尽量不变动现有后端技术栈的前提下，为 openAgents 增加本地优先的 Web UI MVP

---

## 一、设计原则

本设计遵循四条原则：

1. **尽量不改后端技术栈**  
   继续使用当前 Node.js + TypeScript + 本地文件存储 + 现有 `WorkflowEngine`

2. **优先复用现有引擎，不重写执行核心**  
   Web UI 只是新的交互层，不应再造一套工作流执行逻辑

3. **增量抽象，不大拆大建**  
   在 CLI 之下补一层“应用服务层”和“Web 适配层”，而不是推翻现有结构

4. **先支持 MVP 闭环，再考虑高级编辑能力**  
   先跑通“浏览工作流 -> 发起运行 -> 实时观察 -> Gate 审批 -> 查看结果”

---

## 二、当前架构评估

### 2.1 当前技术栈

当前 openAgents 后端核心技术栈已经具备继续承载 Web UI 的基础：

| 层 | 当前实现 |
|------|------|
| 运行环境 | Node.js |
| 语言 | TypeScript |
| 命令入口 | Commander CLI |
| 工作流引擎 | `WorkflowEngine` |
| 配置加载 | `ConfigLoader` |
| 状态持久化 | `StateManager` + 本地 JSON |
| 事件日志 | `EventLogger` + `events.jsonl` |
| 输出文件 | `OutputWriter` |
| 调试服务 | `src/debug/server.ts` 中已有轻量 HTTP server |

### 2.2 当前可复用资产

以下部分可以直接复用或小改后复用：

- `ConfigLoader`
- `WorkflowEngine`
- `StateManager`
- `EventLogger`
- `OutputWriter`
- `EvalRunner`
- `StepCache`
- 现有运行状态和输出目录结构
- 现有 `EngineEventHandler` 事件钩子

### 2.3 当前主要问题

Web UI 的阻碍不在“没有后端”，而在于：

#### 问题 1：引擎入口主要服务 CLI

当前 `buildAppContext()` 主要为 CLI 组装：

- `GateManager` 默认依赖终端输入
- `CLIEventHandler` 默认依赖终端 UI
- 引擎可被复用，但缺少明确的 Web Service 入口

#### 问题 2：Gate 目前是交互式终端模型

`GateManager` 当前基于：

- `readline`
- `stdin/stdout`
- `$EDITOR`

这不适合 Web UI 里的“异步等待 + 页面审批”模式。

#### 问题 3：事件流还没有标准化对外协议

当前 `EngineEventHandler` 可用于 CLI 流式展示，但 Web UI 需要：

- 可序列化事件
- 可推送到浏览器
- 可恢复页面状态

#### 问题 4：已有调试服务器能力有限

`src/debug/server.ts` 已经证明“本地 HTTP 服务”可行，但目前：

- API 比较原始
- 无运行控制接口
- 无 Gate action
- 无事件订阅能力
- HTML 是内嵌调试页，不适合正式 Web UI

---

## 三、目标架构

### 3.1 总体方案

推荐采用：

```text
React Web UI
    ->
Local Web API Layer
    ->
Application Services
    ->
Existing Engine / Config / State / Output / Eval
```

### 3.2 分层结构

```text
Layer 1: Web UI
  职责：页面展示、交互、国际化、主题、事件订阅

Layer 2: Web API Adapter
  职责：HTTP / SSE / WebSocket 路由、请求校验、错误映射

Layer 3: Application Service
  职责：面向 UI 的 use case 封装，如 runWorkflow、listRuns、gateAction

Layer 4: Existing Core
  职责：WorkflowEngine、ConfigLoader、StateManager、OutputWriter、EvalRunner
```

### 3.3 为什么这样分层

这样做的好处：

- CLI 和 Web UI 共享同一套核心引擎
- HTTP 层不会直接操作引擎内部对象
- 后续即使变成 REST API / SDK，也可以复用 Application Service
- 对现有代码侵入最小

---

## 四、推荐技术选型

### 4.1 后端

坚持现有技术栈，不更换语言，不引入数据库。

| 类别 | 选型 |
|------|------|
| Runtime | Node.js |
| Language | TypeScript |
| HTTP Server | Node `http` 或轻量框架 `Hono` / `Express` |
| Event Push | 首选 SSE，必要时再引入 WebSocket |
| Storage | 继续使用本地文件系统 |

#### 建议

MVP 建议优先使用 **Node + 轻量 HTTP 路由层**：

- 如果希望最小改动：扩展现有 `debug/server.ts` 思路
- 如果希望代码更清晰：新增 `src/web/server.ts`，用 `Hono` 或 `Express`

> 推荐：`Hono` 或原生 `http` 均可。  
> 如果你希望“尽量少依赖”，可以直接用 Node 原生 `http`。  
> 如果你希望路由更整洁、开发更轻松，`Hono` 是一个很轻的增量选择。

### 4.2 前端

由于用户希望 UI 更好看、更产品化，建议：

- React
- Next.js 或 Vite
- TypeScript
- CSS 建议走设计 token + Tailwind CSS

#### 选择建议

如果核心目标是：

- 先做本地工具体验
- 尽量少折腾服务端集成

建议：

> **Vite + React + React Router + Tailwind**

原因：

- 更轻
- 和本地 Node 服务的边界更清晰
- 不会强迫后端迁移到 Next.js 体系
- 符合“尽量不动后端技术栈”的要求

---

## 五、建议新增模块

MVP 建议新增以下目录：

```text
src/web/
  server.ts           Web 服务入口
  routes.ts           路由注册
  sse.ts              SSE 连接管理
  dto.ts              Web API 输入输出类型

src/app/
  services/
    workflow-service.ts
    run-service.ts
    gate-service.ts
    settings-service.ts
  events/
    event-bus.ts
    web-event-mapper.ts

web/
  src/                React 前端项目
```

### 5.1 为什么要加 `src/app/services`

这是本次设计里最关键的一层。

当前 CLI 逻辑里，很多能力散落在命令实现中，例如：

- list workflows
- run workflow
- resume run
- eval run
- list runs

Web UI 不应该直接调用 CLI 命令，也不应该直接拼装所有底层依赖。

所以建议新增面向场景的服务层：

- `WorkflowService`: 列表、详情、模板信息
- `RunService`: run、resume、detail、outputs、logs、eval
- `GateService`: 待处理 gate、审批动作
- `SettingsService`: 项目路径、语言、环境状态

---

## 六、后端最小改造方案

### 6.1 保持 `WorkflowEngine` 不大改

原则上不重写 `WorkflowEngine`，只做以下增量改造：

1. 支持注入新的事件处理器
2. 支持 Web 场景下的 Gate 处理方式
3. 支持通过 service 层创建与管理运行任务

### 6.2 引入 Web 版事件处理器

当前已有：

- `CLIEventHandler`

建议新增：

- `WebEventHandler`

职责：

- 监听 `WorkflowEngine` 生命周期事件
- 转换为标准化前端事件
- 写入 SSE 推送通道

示意：

```typescript
class WebEventHandler implements EngineEventHandler {
  constructor(private readonly emitter: RunEventEmitter) {}

  onWorkflowStart(...) { ... }
  onStepStart(...) { ... }
  onStreamChunk(stepId, chunk) { ... }
  onGateWaiting(stepId, output, previewLines) { ... }
}
```

### 6.3 引入 Web 版 Gate Provider

当前 `GateManager` 是“终端交互式”实现。  
MVP 不建议直接在它内部塞很多 `if webMode` 分支。

建议改造成两层：

```text
GateController
  -> InteractiveGateProvider (CLI)
  -> DeferredGateProvider (Web)
```

或更简单一些，保留 `GateManager` 但让它接受一个 provider：

```typescript
interface GateProvider {
  waitForDecision(stepId: string, output: string): Promise<GateDecision>;
}
```

#### CLI Provider

- 使用现有 readline / editor 模式

#### Web Provider

- 进入 gate 时，不立即读取 stdin
- 将状态记录为“waiting for UI decision”
- 通过一个 Promise 挂起
- 当 API 收到 `/gate/action` 后 resolve 对应 Promise

这一步是 Web UI 成立的关键改造，但不涉及更换后端技术栈。

### 6.4 运行任务注册表

Web UI 下，可能会同时存在：

- 一个正在运行的任务
- 一个正在等待 Gate 的任务
- 若干 SSE 订阅连接

建议新增内存态注册表：

```typescript
class RunRegistry {
  activeRuns: Map<string, ActiveRunContext>
}
```

用途：

- 管理运行中的任务上下文
- 绑定 runId 与 SSE 订阅
- 绑定 runId + stepId 与 gate pending Promise

#### 注意

MVP 中 `RunRegistry` 只作为**进程内状态**使用，不替代现有文件持久化。

---

## 七、Web API 设计

### 7.1 API 原则

- API 面向本地 Web UI，不追求开放平台级别抽象
- 路径清晰、语义化
- 返回 JSON
- 事件流使用 SSE

### 7.2 推荐接口清单

#### 工作流相关

`GET /api/workflows`

返回：

```json
[
  {
    "id": "novel_writing",
    "name": "Novel Writing",
    "description": "Write a story with multiple agents",
    "stepCount": 3,
    "hasEval": true
  }
]
```

`GET /api/workflows/:workflowId`

返回 workflow 详情摘要，供 UI 展示。

#### 运行相关

`POST /api/runs`

请求：

```json
{
  "workflowId": "novel_writing",
  "input": "A time-travel mystery",
  "inputData": null,
  "stream": true,
  "autoApprove": false,
  "noEval": false
}
```

返回：

```json
{
  "runId": "run_20260320_xxx",
  "status": "running"
}
```

`POST /api/runs/:runId/resume`

`GET /api/runs`

支持筛选：

- `status`
- `workflowId`

`GET /api/runs/:runId`

返回 run state + 补充元信息。

`GET /api/runs/:runId/events`

返回已落盘事件列表，供页面首次加载历史详情时使用。

`GET /api/runs/:runId/steps/:stepId/output`

返回 step 输出文本。

`GET /api/runs/:runId/eval`

返回评估结果，如不存在则返回空。

#### Gate 相关

`POST /api/runs/:runId/gates/:stepId/action`

请求：

```json
{
  "action": "approve"
}
```

或：

```json
{
  "action": "reject"
}
```

或：

```json
{
  "action": "edit",
  "editedOutput": "..."
}
```

#### 设置与环境

`GET /api/settings`

返回：

- project path
- locale
- theme
- env status

### 7.3 SSE 事件接口

`GET /api/runs/:runId/stream`

SSE 推荐事件类型：

- `workflow.started`
- `step.started`
- `step.stream`
- `step.completed`
- `step.failed`
- `step.skipped`
- `gate.waiting`
- `gate.resolved`
- `workflow.completed`
- `workflow.failed`

示例：

```text
event: step.stream
data: {"runId":"run_xxx","stepId":"write","chunk":"Hello"}
```

---

## 八、事件模型设计

### 8.1 内部事件与前端事件分离

当前 `EngineEventHandler` 是内部接口，不建议让前端直接依赖其方法名和参数结构。

建议新增 Web 事件 DTO：

```typescript
type WebRunEvent =
  | { type: 'workflow.started'; runId: string; workflowId: string; ts: number }
  | { type: 'step.started'; runId: string; stepId: string; ts: number }
  | { type: 'step.stream'; runId: string; stepId: string; chunk: string; ts: number }
  | { type: 'gate.waiting'; runId: string; stepId: string; preview: string; ts: number }
  | { type: 'workflow.completed'; runId: string; ts: number };
```

### 8.2 为什么选 SSE 优先

MVP 推荐优先 SSE，而不是 WebSocket，原因：

- 服务端实现更简单
- 浏览器原生支持好
- 当前主要是服务端单向推送
- 足够承载实时输出和步骤状态更新

当后续要支持更复杂的双向控制或多人协作时，再评估 WebSocket。

---

## 九、前端架构设计

### 9.1 页面结构

建议前端路由：

```text
/
/workflows
/workflows/:workflowId
/runs
/runs/:runId
/settings
```

### 9.2 状态管理建议

MVP 不建议一上来引入复杂全局状态库。

建议组合：

- Server state: `TanStack Query`
- UI state: React Context + local state
- i18n state: i18n provider
- theme state: localStorage + HTML attribute

### 9.3 页面数据加载策略

#### Runs Detail

首次进入页面：

1. 调 `GET /api/runs/:runId`
2. 调 `GET /api/runs/:runId/events`
3. 如果 run 还在 running，则建立 SSE 连接

这样可以兼顾：

- 历史页面可恢复
- 正在运行页面可实时更新

---

## 十、国际化设计

### 10.1 原则

- 所有 UI 文案必须使用 key
- 后端返回状态码、状态枚举，前端负责本地化显示
- 不把完整中文/英文提示直接写死在接口里

### 10.2 推荐结构

```text
web/src/i18n/
  en/
    common.json
    workflows.json
    runs.json
  zh-CN/
    common.json
    workflows.json
    runs.json
```

### 10.3 后端 i18n 与前端 i18n 边界

后端保留现有 CLI 国际化，不强行统一到前端。

MVP 建议：

- CLI 文案继续走当前 `src/i18n`
- Web UI 文案独立在前端维护

这样改动最小，也最清晰。

---

## 十一、主题与视觉系统

### 11.1 设计 token

建议前端从第一天就定义 token：

- color
- radius
- spacing
- shadow
- typography
- motion

示例：

```css
:root {
  --bg: #f5f3ef;
  --panel: #fbfaf8;
  --text: #161616;
  --muted: #6b6b6b;
  --line: #e7e2d9;
  --brand: #0f3d3e;
  --success: #1f7a52;
  --warning: #b7791f;
  --danger: #b33a3a;
}
```

### 11.2 为什么要独立 token

这样做的好处：

- 方便多语言和多主题适配
- 避免页面越做越像组件库 Demo
- 后续可以把 CLI 品牌视觉逐步向 Web UI 靠拢

---

## 十二、安全与边界

### 12.1 本地服务安全假设

MVP 默认假设：

- 单用户
- 本地环境
- 本机访问

所以本期不做：

- 用户登录
- RBAC
- Access Token

### 12.2 基本安全建议

即便是本地 MVP，也建议：

- 默认只监听 `127.0.0.1`
- 限制项目根目录访问范围
- 不允许任意路径文件读取
- Gate edit / output preview 做基本输入大小保护

### 12.3 环境变量展示原则

UI 只显示：

- API Key 已配置 / 未配置
- Base URL 已配置 / 未配置

不直接明文展示完整密钥。

---

## 十三、与现有代码的改造清单

### 13.1 必做改造

#### A. 增加应用服务层

新增：

- `src/app/services/workflow-service.ts`
- `src/app/services/run-service.ts`
- `src/app/services/gate-service.ts`

#### B. 增加 Web 事件处理器

新增：

- `src/app/events/web-event-handler.ts`

#### C. Gate 能力抽象

重构：

- `src/engine/gate.ts`

目标：

- 把 CLI 交互逻辑和 Gate 决策等待机制分离

#### D. 增加 Web 服务入口

新增：

- `src/web/server.ts`
- `src/web/routes.ts`

#### E. 扩展 package scripts

新增建议脚本：

```json
{
  "web:dev": "...",
  "web:build": "...",
  "web:start": "..."
}
```

### 13.2 可选改造

#### F. 重用现有 debug server 的部分逻辑

`src/debug/server.ts` 中以下思路可以复用：

- 本地 HTTP server 模式
- 文件读取 API

但不建议直接在这个文件上继续堆正式 Web UI 逻辑。  
更建议：

- 调试页保留为 debug 功能
- 正式 Web UI 使用独立 `src/web/*`

---

## 十四、开发阶段规划

### Phase 1：后端服务化

目标：不动核心引擎，只补可供 Web UI 调用的外层能力

任务：

- 新增 service 层
- 新增 Web server
- 新增 list / detail / run / resume API
- 新增 SSE 推送
- 重构 Gate 等待机制

验收：

- 可通过 HTTP 发起 run
- 可通过 SSE 接收流式事件
- 可通过 API 完成 gate action

### Phase 2：前端骨架

目标：跑通 MVP 页面路径

任务：

- 首页
- 工作流列表页
- 运行表单页
- Run Detail 页
- Runs 历史页
- Settings 页

验收：

- 用户可在 UI 中完整跑通一个模板

### Phase 3：视觉与多语言

目标：让产品从“工具页”升级到“可交付界面”

任务：

- 设计 token
- 双语文案
- 空状态与错误态
- 响应式布局
- 动效与交互细节

验收：

- 中英文切换正常
- 页面观感统一、专业

---

## 十五、关键技术决策结论

### 决策 1：是否更换后端技术栈？

**结论：不更换。**

继续使用：

- Node.js
- TypeScript
- 本地文件存储
- 现有 `WorkflowEngine`

### 决策 2：是否用数据库？

**结论：MVP 不使用数据库。**

理由：

- 当前 run state / outputs / events / eval 文件结构已足够支撑 MVP
- 增加数据库会显著扩大范围

### 决策 3：实时通信选 SSE 还是 WebSocket？

**结论：MVP 选 SSE。**

理由：

- 更轻
- 实现快
- 适合当前单向推送场景

### 决策 4：是否重写 Gate 逻辑？

**结论：不重写业务逻辑，但需要抽象等待机制。**

理由：

- Gate 本质逻辑保留
- 只是把“决策输入源”从 CLI 终端扩展为 Web UI

### 决策 5：前端框架选什么？

**结论：优先 Vite + React。**

理由：

- 对现有后端侵入最小
- 适合本地 UI MVP
- 不强迫后端迁移到 Next.js 风格

---

## 十六、总结

这份设计的核心判断是：

> openAgents 做 Web UI，不需要推翻现有后端。  
> 现有 Node + TypeScript + WorkflowEngine 已经足够，只需要补上服务层、事件层和 Web 化的 Gate 机制。

从工程角度看，真正的关键改造只有三件事：

1. 把 CLI 下面的能力抽成 Application Service  
2. 把引擎事件转成 Web 可消费的 SSE 事件流  
3. 把 Gate 从“终端输入”抽象成“可替换决策来源”

只要这三件事完成，Web UI 的 MVP 就能建立在现有架构之上，而且不会破坏当前 CLI 的稳定性和可维护性。
