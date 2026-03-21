# OpenAgents Web UI MVP - 开发任务清单

**对应文档**:
- `docs/PRD-v5.md`
- `docs/TECHNICAL-DESIGN-WEBUI.md`

**目标**: 将 Web UI MVP 拆解为可并行、可分配、可验收的开发任务  
**原则**: 优先复用现有后端技术栈，控制高成本模型的使用范围

---

## 0. 当前执行状态（2026-03-20）

> 本节用于标记本轮已完成的高风险任务，方便后续模型继续开发。

- ✅ `T2` 抽象 Application Service 层（已完成）
- ✅ `T4` Gate 机制 Web 化改造（已完成）
- ✅ `T5` SSE 事件流实现（已完成）
- ⚠️ `T16` Run Detail 实时事件接入（仅后端前置完成，前端页面接入待继续）

---

## 一、任务拆分原则

为了控制成本，建议按以下思路分配模型：

### 1.1 高成本模型适合做什么

适合 `GPT-5.4` / `Claude Opus 4.6` 的任务：

- 涉及架构边界和抽象设计
- 涉及引擎核心改造
- 涉及并发、事件流、Gate 等高风险逻辑
- 涉及跨模块重构和复杂联调

### 1.2 中低成本模型适合做什么

适合中小模型的任务：

- DTO、类型、路由、基础 CRUD API
- 静态页面结构
- UI 组件拆分
- i18n 文案接线
- 样式和布局实现
- 文档、测试样例、空状态页面

### 1.3 任务分层

本次拆分为 5 层：

1. 基础架构层
2. 后端服务层
3. 前端应用层
4. 视觉与国际化层
5. 测试与收尾层

---

## 二、建议模型分配策略

| 等级 | 任务特点 | 建议模型 |
|------|----------|----------|
| **S** | 架构 / 核心重构 / 高风险联调 | GPT-5.4 / Opus 4.6 |
| **A** | 中等复杂度业务实现 | GPT-5.4-mini / Claude Sonnet 类 |
| **B** | 标准页面 / 常规 API / 类型接线 | GPT-5.4-mini / 5.3-codex / Kimi K2.5 |
| **C** | 样式、文案、多语言、低风险测试 | 便宜模型优先 |

> 实操建议：  
> 先让高成本模型把 “接口、边界、风险模块” 定清楚；  
> 再把大量实现工作交给便宜模型并行推进。

---

## 三、总任务地图

| 任务编号 | 名称 | 依赖 | 难度 | 推荐模型 |
|------|------|------|------|------|
| T1 | 建立 Web UI 工程骨架 | 无 | A | 中等模型 |
| T2 | 抽象 Application Service 层 | 无 | S | 高成本模型 |
| T3 | 设计并实现 Web Server 基础框架 | T1,T2 | A | 中等模型 |
| T4 | Gate 机制 Web 化改造 | T2 | S | 高成本模型 |
| T5 | SSE 事件流实现 | T2,T3 | S | 高成本模型 |
| T6 | Workflows API | T2,T3 | B | 中等模型 |
| T7 | Runs API | T2,T3 | A | 中等模型 |
| T8 | Gate Action API | T3,T4 | A | 中等模型 |
| T9 | Settings / Environment API | T3 | B | 便宜模型 |
| T10 | 前端设计 token 与主题系统 | T1 | A | 中等模型 |
| T11 | Home 页面 | T1,T9,T10 | B | 便宜模型 |
| T12 | Workflows 列表页 | T1,T6,T10 | B | 便宜模型 |
| T13 | Workflow Run Form 页面 | T1,T6,T7,T10 | A | 中等模型 |
| T14 | Runs 列表页 | T1,T7,T10 | B | 便宜模型 |
| T15 | Run Detail 页面骨架 | T1,T7,T10 | A | 中等模型 |
| T16 | Run Detail 实时事件接入 | T5,T15 | S | 高成本模型 |
| T17 | Gate UI 面板 | T8,T15,T16 | A | 中等模型 |
| T18 | Outputs / Logs / Eval Tabs | T7,T15 | B | 便宜模型 |
| T19 | i18n 基础接入 | T1 | B | 便宜模型 |
| T20 | 中英文文案覆盖 | T19,各页面 | C | 便宜模型 |
| T21 | 响应式与视觉打磨 | 各页面 | A | 中等模型 |
| T22 | 后端测试补齐 | T3~T9 | A | 中等模型 |
| T23 | 前端交互测试 / 冒烟测试 | T11~T21 | B | 便宜模型 |
| T24 | 启动脚本与文档整合 | 基本完成后 | C | 便宜模型 |

---

## 四、详细任务清单

## T1. 建立 Web UI 工程骨架

### 目标

建立前后端最小可运行骨架，但不动核心引擎。

### 产出

- 新建 `web/` 前端目录
- 确定前端构建方式
- 增加项目脚本
- 确定开发环境启动方式

### 建议内容

- `web/package.json`
- `web/src/main.tsx`
- `web/src/App.tsx`
- `web/src/routes/*`
- 根目录补充 `web:dev`, `web:build`

### 难度

`A`

### 推荐模型

中等模型即可

### 验收标准

- 前端可本地启动
- 后端可保留现有 CLI 能力不受影响

---

## T2. 抽象 Application Service 层

### 状态

`✅ 已完成（2026-03-20）`

### 目标

把 CLI 下方可复用能力抽成面向 Web 的服务层。

### 产出

- `src/app/services/workflow-service.ts`
- `src/app/services/run-service.ts`
- `src/app/services/gate-service.ts`
- `src/app/services/settings-service.ts`

### 关键点

- 不直接调用 CLI command
- 统一封装 loader / stateManager / engine / eval 访问
- 定义面向 Web 的返回 DTO

### ⚠️ 技术风险与注意事项

**1. 必须理解现有 `buildAppContext()` 的组装逻辑**

当前 CLI 命令的依赖组装都在 `src/cli/shared.ts` 的 `buildAppContext()` 中完成，包括 `ConfigLoader`、`StateManager`、`GateManager`、`ProgressUI`、`CLIEventHandler`、`WorkflowEngine` 的创建与注入。Service 层需要构建一个平行的 `buildWebContext()` 方法，替换 CLI 专属的 `GateManager`（改为 Web 版）和 `CLIEventHandler`（改为 `WebEventHandler`），但复用 `ConfigLoader`、`StateManager`、`OutputWriter` 等无 CLI 依赖的模块。

**2. DTO 类型必须独立定义，并设计为前后端可共享**

Service 层返回的 DTO 不应直接暴露引擎内部类型（如 `RunState`、`WorkflowConfig`）。建议在 `src/app/dto.ts` 或 `src/web/dto.ts` 中定义面向前端的精简类型，后续前端项目可以直接引用或拷贝这些类型，确保前后端类型安全。

**3. Service 层是后续所有 API 任务的瓶颈**

T3/T6/T7/T8/T9 都依赖此任务的产出。因此 T2 产出时不仅是实现代码，还需要明确每个 service 方法的签名和 DTO 定义，以便后续任务可以先用 mock 数据并行开发前端。

**4. 不要改动现有引擎模块的对外接口**

`WorkflowEngine`、`ConfigLoader`、`StateManager` 等模块只做"调用"，不做"修改"。如果发现现有模块不便调用，应通过在 service 层做适配，而非修改底层接口。唯一允许的底层改动是 `GateManager` 的抽象（属于 T4 范围）。

**5. 需要处理 `WorkflowEngine.run()` 的异步生命周期**

`WorkflowEngine.run()` 返回 `Promise<RunState>`，整个执行过程是同步阻塞到完成的。在 Web 场景下，`RunService.runWorkflow()` 需要"启动后立即返回 runId"而不是等到完成，因此需要用 `Promise` 在后台运行引擎，并通过 `RunRegistry` 管理运行中的任务上下文。

### 难度

`S`

### 推荐模型

`GPT-5.4` / `Opus 4.6`

### 验收标准

- Web 层可以只依赖 service 层，不直接拼底层依赖
- CLI 行为不被破坏
- 每个 service 方法的入参和返回 DTO 类型有明确定义
- `npm test` 现有测试全部通过

### 完成记录

- 新增 `src/app/context.ts`，提供 `buildWebContext()`
- 新增 `src/app/dto.ts`（Web DTO 与事件类型）
- 新增 services：
  - `src/app/services/workflow-service.ts`
  - `src/app/services/run-service.ts`
  - `src/app/services/gate-service.ts`
  - `src/app/services/settings-service.ts`
  - `src/app/services/run-registry.ts`

---

## T3. 设计并实现 Web Server 基础框架

### 目标

建立 Web API 服务入口。

### 产出

- `src/web/server.ts`
- `src/web/routes.ts`
- 基础错误处理
- JSON 响应工具

### 关键点

- 默认监听 `127.0.0.1`
- API 前缀统一为 `/api`
- 与未来 SSE 路由兼容

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 能启动 HTTP 服务
- 能返回健康检查或基础 API

---

## T4. Gate 机制 Web 化改造

### 状态

`✅ 已完成（2026-03-20）`

### 目标

让 Gate 从终端交互模式升级为可替换决策来源。

### 产出

- `GateProvider` 或等价抽象
- CLI Gate 实现保留
- Web Deferred Gate 实现
- pending gate 注册与释放机制

### 关键风险

- Promise 挂起与恢复
- run 中断时的清理
- gate action 幂等处理

### ⚠️ 技术风险与注意事项

**1. 必须理解当前 `GateManager` 的实现细节**

当前 `src/engine/gate.ts` 中的 `GateManager` 直接调用 `readline.createInterface({ input: stdin, output: stdout })` 并通过 `rl.question()` 阻塞等待终端输入。编辑模式通过 `$EDITOR` 环境变量打开临时文件。改造时不应在 `GateManager` 内部塞 `if (webMode)` 分支，而应抽出 `GateProvider` 接口：

```typescript
interface GateProvider {
  waitForDecision(stepId: string, output: string): Promise<GateDecision>;
}
```

然后分别实现 `InteractiveGateProvider`（保留现有 CLI 逻辑）和 `DeferredGateProvider`（Web 版）。`GateManager` 的构造函数接受 `GateProvider` 参数。

**2. `DeferredGateProvider` 的 Promise 生命周期管理**

Web 版 Gate 的核心是：进入 gate 时创建一个 `Promise` 并挂起，等 API 收到 `/gates/:stepId/action` 时 resolve 这个 Promise。以下情况必须处理：

- **用户关掉页面不再审批**：需要超时机制（建议可配置，默认 30 分钟），超时后自动 reject 并将 run 状态标记为 `interrupted`
- **服务进程重启**：内存中的 pending Promise 会丢失。重启后需要从 `.state.json` 恢复 gate.waiting 状态，但对应的 Promise 已不存在。建议重启后将这些 run 标记为 `interrupted`，用户通过 resume 继续
- **重复提交**：前端因网络问题可能重复发送 gate action，后端需要做幂等检查——如果 gate 已经 resolved，返回当前状态而非报错

**3. 改造范围必须克制**

只改 gate 的"决策输入源"抽象，不要同时改 gate 的业务逻辑（approve/reject/edit 的语义处理）。`GateDecision` 类型定义保持不变。

**4. 必须保证 CLI gate 的回归**

改造后执行现有 `gate.test.ts` 必须全部通过。建议新增 `gate-deferred.test.ts` 单独测试 Web 版 gate 的 Promise 挂起/resolve/超时/幂等逻辑。

**5. 和 `StateManager` 的配合**

当 step 进入 gate waiting 时，`StateManager` 需要把 step 状态持久化为可识别的 waiting 状态。确认现有 `state.ts` 是否已经持久化了 gate waiting 信息，如果没有，需要在 step status 中增加 `gate_waiting` 状态或在 step metadata 中记录。

### 难度

`S`

### 推荐模型

`GPT-5.4` / `Opus 4.6`

### 验收标准

- CLI gate 仍可正常工作（`gate.test.ts` 全部通过）
- Web API 可以驱动 approve / reject / edit
- DeferredGateProvider 有超时机制
- 重复提交 gate action 不会报错（幂等）
- 新增 `gate-deferred.test.ts` 测试覆盖

### 完成记录

- `src/engine/gate.ts` 新增：
  - `GateProvider`
  - `InteractiveGateProvider`
  - `DeferredGateProvider`（超时 + 幂等）
- `GateManager` 改为支持 provider 注入，CLI 交互逻辑保留
- 引擎增加 `gate_waiting` 状态持久化与 `gate.resolved` 事件
- 新增测试：`src/__tests__/gate-deferred.test.ts`
- 兼容更新测试：`src/__tests__/gate.test.ts`

---

## T5. SSE 事件流实现

### 状态

`✅ 已完成（2026-03-20）`

### 目标

把引擎事件和流式输出推送到前端。

### 产出

- `RunEventEmitter`
- `WebEventHandler`
- SSE 连接管理
- 事件 DTO 标准化

### 关键风险

- 断线处理
- 运行中与历史状态衔接
- stream chunk 高频推送的稳定性

### ⚠️ 技术风险与注意事项

**1. 必须理解当前 `EngineEventHandler` 接口**

当前 `src/engine/events.ts` 定义了 `EngineEventHandler` 接口，包含 `onWorkflowStart`、`onStepStart`、`onStepComplete`、`onStepFailed`、`onStepSkipped`、`onStreamChunk`（可选）、`onGateWaiting` 等方法。`WebEventHandler` 需要实现同一接口，把每个回调转化为标准化的 `WebRunEvent` DTO 并写入 SSE 推送通道。

**2. 流式输出的高频推送必须做节流**

`onStreamChunk(stepId, chunk)` 在 LLM 回复时会高频触发（每个 token 一次，可能每秒 30-50 次）。如果每个 chunk 都立即推 SSE 事件，前端渲染压力会很大。建议在 `WebEventHandler` 中对 `step.stream` 事件做 16-32ms 的节流缓冲——积攒一小批 chunk 后合并为一次 SSE 推送。

**3. 断线恢复协议必须明确**

用户刷新页面或 SSE 断线后，前端需要恢复状态。推荐协议：

1. 前端先调 `GET /api/runs/:runId` 获取 run 当前状态
2. 再调 `GET /api/runs/:runId/events` 获取已落盘的历史事件（来自 `events.jsonl`）
3. 如果 run 仍在 running，建立 SSE 连接 `GET /api/runs/:runId/stream` 接收增量事件
4. SSE 连接建立时，服务端可选发送一个 `sync` 事件告知当前 run 状态快照，避免历史事件和实时事件之间出现间隙

此协议需要在 T5 中明确定义，否则 T16（前端接入）会因为"历史和实时如何衔接"而卡住。

**4. 多 SSE 连接管理**

用户可能同时打开多个 run 详情页（多个浏览器 tab），每个 tab 会建立独立的 SSE 连接。`RunRegistry` 需要支持同一个 runId 绑定多个 SSE 响应对象，并在 run 结束时统一关闭。同时需要处理客户端断开连接时的清理（监听 `req.on('close', ...)`）。

**5. 事件 DTO 与内部事件的隔离**

前端不应直接依赖 `EngineEventHandler` 的方法名和参数结构。建议在 `src/app/events/web-event-mapper.ts` 中定义标准化的 `WebRunEvent` 联合类型，每个事件都包含 `type`、`runId`、`ts` 字段。这样即使引擎内部事件结构变化，前端协议也能保持稳定。

**6. 注意 SSE 的 HTTP 响应头设置**

SSE 需要设置 `Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`。如果前端通过开发代理访问（Vite dev server proxy），需要确保代理不会缓冲 SSE 响应。

### 难度

`S`

### 推荐模型

`GPT-5.4` / `Opus 4.6`

### 验收标准

- 浏览器可订阅某个 run 的实时事件
- `step.stream` / `gate.waiting` / `workflow.completed` 可正常收到
- stream chunk 推送有节流，不会导致前端卡顿
- 客户端断开后服务端能正确清理连接
- 断线恢复协议有明确文档或代码注释

### 完成记录

- 新增 `src/app/events/run-event-emitter.ts`（多连接管理）
- 新增 `src/app/events/web-event-handler.ts`（实现 `EngineEventHandler`）
- 新增 `src/app/events/web-event-mapper.ts`（事件 DTO 映射层）
- `step.stream` 事件已做 24ms 合并节流推送
- 新增/打通 SSE 路由：`GET /api/runs/:runId/stream`
- SSE 响应头包含 `text/event-stream`、`no-cache`、`keep-alive`
- 连接建立时发送 `sync` 事件用于状态衔接

---

## T6. Workflows API

### 目标

提供工作流列表与详情接口。

### 产出

- `GET /api/workflows`
- `GET /api/workflows/:workflowId`

### 难度

`B`

### 推荐模型

中等或便宜模型

### 验收标准

- UI 可获取工作流列表和详情摘要

---

## T7. Runs API

### 目标

提供运行生命周期相关 API。

### 产出

- `POST /api/runs`
- `POST /api/runs/:runId/resume`
- `GET /api/runs`
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/events`
- `GET /api/runs/:runId/steps/:stepId/output`
- `GET /api/runs/:runId/eval`

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 可以通过 API 启动和恢复运行
- 可以查看 run 详情、events、outputs、eval

---

## T8. Gate Action API

### 目标

让前端页面可提交 Gate 决策。

### 产出

- `POST /api/runs/:runId/gates/:stepId/action`

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- approve / reject / edit 三种动作都能生效

---

## T9. Settings / Environment API

### 目标

让 UI 能显示项目和环境状态。

### 产出

- `GET /api/settings`

### 返回建议

- project path
- locale
- theme
- api key configured
- base url configured

### 难度

`B`

### 推荐模型

便宜模型

### 验收标准

- 首页和设置页可读取状态信息

---

## T10. 前端设计 token 与主题系统

### 目标

先把视觉基础打稳，避免后期返工。

### 产出

- color token
- spacing token
- typography token
- radius / shadow token
- light / dark / system 支持

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 全局样式一致
- 页面间视觉语言统一

---

## T11. Home 页面

### 目标

完成首页和快速入口。

### 模块

- Hero
- Quick actions
- Recent runs
- Environment status

### 难度

`B`

### 推荐模型

便宜模型

### 验收标准

- 首屏能展示项目状态和常用入口

---

## T12. Workflows 列表页

### 目标

完成工作流浏览页。

### 模块

- workflow cards
- empty state
- workflow detail panel

### 难度

`B`

### 推荐模型

便宜模型

### 验收标准

- 用户能浏览并选择工作流

---

## T13. Workflow Run Form 页面

### 目标

完成运行表单页。

### 模块

- input mode switch
- plain text input
- JSON input
- advanced options
- submit action

### 关键点

- JSON 实时校验
- 按钮 loading 状态

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 用户可从 UI 发起 workflow run

---

## T14. Runs 列表页

### 目标

完成运行历史页。

### 模块

- list table / cards
- status filter
- workflow filter
- score display

### 难度

`B`

### 推荐模型

便宜模型

### 验收标准

- 用户可查看历史 runs 并进入详情

---

## T15. Run Detail 页面骨架

### 目标

完成详情页静态骨架。

### 模块

- run header
- step timeline
- live panel placeholder
- meta panel
- tabs skeleton

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 页面结构完整，可接入动态数据

---

## T16. Run Detail 实时事件接入

### 状态

`⚠️ 部分完成（仅后端前置完成，前端页面接入待继续）`

### 目标

把 SSE 事件接入详情页，形成实时 UI。

### 模块

- SSE subscription
- stream chunk append
- status updates
- reconnect / fallback

### 关键风险

- 页面刷新后的状态恢复
- stream 面板滚动策略

### ⚠️ 技术风险与注意事项

**1. 必须严格遵循 T5 定义的断线恢复协议**

页面首次加载或刷新后的数据恢复顺序：

1. 调 `GET /api/runs/:runId` 获取 run 当前快照
2. 调 `GET /api/runs/:runId/events` 获取历史事件，用于重建 step timeline 和已完成步骤的输出
3. 如果 run 状态为 `running`，建立 `EventSource` 连接到 `GET /api/runs/:runId/stream`
4. SSE 收到的增量事件与历史事件可能有重叠（取决于落盘时机），前端需要按 `ts` 或事件序号去重

如果不实现去重逻辑，页面刷新后可能出现重复的 step 状态或重复的输出内容。

**2. SSE 自动重连需要自定义**

浏览器原生 `EventSource` 会在断线后自动重连，但重连后会从头接收事件流。建议使用自定义的 SSE 客户端封装（或基于 `fetch` + `ReadableStream`），在重连时携带 `Last-Event-Id` 或时间戳参数，让服务端只推送增量事件。如果 MVP 不做增量恢复，至少需要在重连后重新走一遍"加载历史 + 接 SSE"的流程。

**3. 流式输出面板的性能**

LLM 流式输出可能产生大量文本（数千字），每秒追加多次。注意事项：

- 使用 `useRef` 管理输出文本缓冲区，避免每次 append 都触发 React 重渲染
- 流式输出面板的 DOM 更新建议用 `requestAnimationFrame` 节流
- 自动滚动到底部需要检测用户是否手动上翻（如果用户在查看历史输出，不应强制拉到底部）

**4. 多 step 并行执行时的 UI 状态管理**

DAG 调度器支持并行执行多个 step。前端可能同时收到多个 step 的 `step.started` 和 `step.stream` 事件。状态管理需要按 `stepId` 分别维护，不能假设"同一时间只有一个 step 在运行"。

**5. 状态机完整性**

Run Detail 页面的 UI 本质上是一个状态机，需要处理所有状态组合：

- run 正在运行 + step 正在流式输出
- run 正在运行 + step 在等待 gate
- run 已完成（成功/失败/中断）
- run 从未启动（无效 runId）
- SSE 连接失败或超时

每种状态都需要有对应的 UI 表现，不能出现空白页或无响应状态。

### 难度

`S`

### 推荐模型

高成本模型

### 验收标准

- 正在运行的任务可以实时更新页面
- 页面刷新后能正确恢复状态，不出现重复内容
- 并行 step 的事件能正确分发到各自的 UI 区域
- 流式输出面板不出现明显卡顿或闪烁
- SSE 断线后能自动恢复

### 已完成前置（供后续模型继续）

- `GET /api/runs/:runId`
- `GET /api/runs/:runId/events`
- `GET /api/runs/:runId/stream`
- `WebRunEvent` DTO 与 `sync` 事件已定义
- `gate.waiting` / `gate.resolved` / `step.stream` 事件链路已打通

---

## T17. Gate UI 面板

### 目标

在 Run Detail 页面中实现 Gate 处理 UI。

### 模块

- waiting alert
- approve action
- reject action
- edit textarea modal / panel

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 用户可在 UI 中完成 gate 审批操作

---

## T18. Outputs / Logs / Eval Tabs

### 目标

完成结果查看区域。

### 模块

- outputs tab
- logs tab
- eval tab

### 难度

`B`

### 推荐模型

便宜模型

### 验收标准

- 用户可查看输出、事件日志、评估结果

---

## T19. i18n 基础接入

### 目标

搭建前端多语言基础设施。

### 产出

- i18n provider
- locale files
- language switcher

### 难度

`B`

### 推荐模型

便宜模型

### 验收标准

- 页面可以在英文和中文之间切换

---

## T20. 中英文文案覆盖

### 目标

补齐所有页面和组件文案。

### 难度

`C`

### 推荐模型

便宜模型

### 验收标准

- 页面没有明显漏翻或硬编码文案

---

## T21. 响应式与视觉打磨

### 目标

让页面“好看且可用”。

### 模块

- layout polish
- spacing cleanup
- card hierarchy
- empty states
- loading / error states
- desktop / tablet / mobile adaptation

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 桌面端视觉统一
- 移动端不崩

---

## T22. 后端测试补齐

### 目标

补齐 Web 层和核心改造的测试。

### 建议覆盖

- services test
- gate deferred flow test
- SSE event mapper test
- routes test

### 难度

`A`

### 推荐模型

中等模型

### 验收标准

- 核心 API 和 gate 机制有自动化测试覆盖

---

## T23. 前端交互测试 / 冒烟测试

### 目标

验证页面关键路径。

### 建议覆盖

- open workflows
- submit run
- receive SSE
- gate action
- view outputs
- switch language

### 难度

`B`

### 推荐模型

便宜模型

### 验收标准

- MVP 主路径至少有基础冒烟测试

---

## T24. 启动脚本与文档整合

### 目标

让项目可被别人启动和理解。

### 产出

- 根目录 README 补充 Web UI 启动说明
- 开发脚本整理
- 目录说明

### 难度

`C`

### 推荐模型

便宜模型

### 验收标准

- 新人可根据文档启动 Web UI MVP

---

## 五、推荐实施顺序

## 第一批：必须先做

1. `T2` 抽象 Application Service 层
2. `T4` Gate 机制 Web 化改造
3. `T3` Web Server 基础框架
4. `T5` SSE 事件流实现

> 这四项建议优先由高质量模型完成，因为会决定后面大量任务是否顺畅。

## 第二批：后端闭环

5. `T6` Workflows API
6. `T7` Runs API
7. `T8` Gate Action API
8. `T9` Settings API

## 第三批：前端骨架

9. `T1` Web UI 工程骨架
10. `T10` 设计 token 与主题系统
11. `T19` i18n 基础接入

## 第四批：主页面

12. `T11` Home
13. `T12` Workflows
14. `T13` Run Form
15. `T14` Runs List
16. `T15` Run Detail 骨架

## 第五批：动态能力

17. `T16` Run Detail 实时事件接入
18. `T17` Gate UI
19. `T18` Outputs / Logs / Eval

## 第六批：收尾

20. `T20` 文案覆盖
21. `T21` 视觉打磨
22. `T22` 后端测试
23. `T23` 前端测试
24. `T24` 文档整合

---

## 六、最省钱的模型使用建议

如果你想尽量节省 `GPT-5.4` / `Opus 4.6` 的 token，推荐这样分：

### 只给高成本模型的任务

- `T2`
- `T4`
- `T5`
- `T16`

这四项是最值得花钱的地方。

### 给中等模型的任务

- `T3`
- `T7`
- `T8`
- `T10`
- `T13`
- `T15`
- `T17`
- `T21`
- `T22`

### 给便宜模型并行做的任务

- `T1`
- `T6`
- `T9`
- `T11`
- `T12`
- `T14`
- `T18`
- `T19`
- `T20`
- `T23`
- `T24`

---

## 七、建议并行分工方式

### 小团队模式

#### Worker 1：核心后端

- `T2`
- `T4`
- `T5`
- `T7`
- `T8`

#### Worker 2：前端骨架

- `T1`
- `T10`
- `T19`
- `T11`
- `T12`

#### Worker 3：业务页面

- `T13`
- `T14`
- `T15`
- `T18`

#### Worker 4：打磨与测试

- `T20`
- `T21`
- `T22`
- `T23`
- `T24`

---

## 八、结论

如果你的目标是“最省钱但不把架构做坏”，最好的策略不是平均分配模型，而是：

> 让高成本模型只做少数高风险边界任务，  
> 再把大部分标准实现任务分发给便宜模型并行完成。

本次 Web UI MVP 中，真正值得用贵模型的核心只有 4 块：

1. Service 层抽象  
2. Gate Web 化  
3. SSE 实时事件流  
4. Run Detail 实时联动

其余大多数工作，都可以交给更便宜的模型来推进。

---

## 九、MVP 验收清单

以下清单用于项目开发完成后的整体验收。验收人需要按顺序逐项检查，每项标注 ✅（通过）/ ❌（未通过）/ ⚠️（部分通过，需说明）。

---

### 9.1 基础环境验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| E1 | 执行 `npm test`，现有全部测试通过，无新增失败 | 命令行运行 |
| E2 | 执行 `npm run build`，TypeScript 编译无报错 | 命令行运行 |
| E3 | 执行 `npm run lint`，无新增 lint 错误 | 命令行运行 |
| E4 | CLI 命令 `run`、`resume`、`runs`、`workflows` 功能不受影响 | 用现有模板项目手动验证 |
| E5 | Web 服务可通过单条命令启动（如 `npm run web:dev` 或类似） | 命令行运行 |
| E6 | 前端开发服务可通过单条命令启动 | 命令行运行 |
| E7 | 前端构建产物可正常被后端服务托管或独立访问 | 浏览器访问 |

---

### 9.2 后端 API 验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| A1 | `GET /api/workflows` 返回工作流列表，字段包含 id, name, description, stepCount | curl 或浏览器 |
| A2 | `GET /api/workflows/:workflowId` 返回单个工作流详情 | curl |
| A3 | `POST /api/runs` 可成功启动一个 workflow run，立即返回 runId | curl |
| A4 | `GET /api/runs` 返回运行历史列表，支持 status/workflowId 筛选 | curl |
| A5 | `GET /api/runs/:runId` 返回单次 run 的完整状态 | curl |
| A6 | `GET /api/runs/:runId/events` 返回已落盘的事件列表 | curl |
| A7 | `GET /api/runs/:runId/steps/:stepId/output` 返回 step 输出文本 | curl |
| A8 | `GET /api/runs/:runId/eval` 返回评估结果（如有） | curl |
| A9 | `POST /api/runs/:runId/resume` 可恢复 interrupted 状态的 run | curl |
| A10 | `GET /api/runs/:runId/stream` 建立 SSE 连接，能收到实时事件 | curl 或 EventSource |
| A11 | `POST /api/runs/:runId/gates/:stepId/action` approve 生效 | curl |
| A12 | `POST /api/runs/:runId/gates/:stepId/action` reject 生效 | curl |
| A13 | `POST /api/runs/:runId/gates/:stepId/action` edit 生效 | curl |
| A14 | Gate action 重复提交不报错（幂等） | curl 连续两次 |
| A15 | `GET /api/settings` 返回项目路径、语言、API Key 配置状态 | curl |
| A16 | 所有 API 错误返回统一 JSON 格式（含 error message） | 传入非法参数验证 |

---

### 9.3 SSE 事件流验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| S1 | 启动 run 后，SSE 连接能收到 `workflow.started` 事件 | EventSource / 浏览器 DevTools |
| S2 | 每个 step 开始时收到 `step.started`，完成时收到 `step.completed` | 同上 |
| S3 | 流式输出时收到 `step.stream` 事件，内容正确 | 同上 |
| S4 | Gate 等待时收到 `gate.waiting` 事件 | 同上 |
| S5 | Gate 操作后收到 `gate.resolved` 事件 | 同上 |
| S6 | Run 完成时收到 `workflow.completed` 或 `workflow.failed` | 同上 |
| S7 | 客户端断开 SSE 后，服务端不报错、不内存泄漏 | 关闭浏览器 tab 后观察服务端日志 |
| S8 | stream chunk 推送有节流，不会每个 token 推一次 SSE 事件 | 观察 DevTools Network |

---

### 9.4 Gate 机制验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| G1 | CLI 模式下 gate 交互功能不受影响 | 终端手动运行含 gate 的 workflow |
| G2 | Web 模式下 step 进入 gate 后，run 正确挂起等待 | API + SSE 观察 |
| G3 | 通过 API approve 后，run 继续执行后续 step | API 调用 |
| G4 | 通过 API reject 后，run 进入 interrupted 状态 | API 调用 |
| G5 | 通过 API edit 后，后续 step 使用编辑后的输出 | API 调用 + 检查输出 |
| G6 | Gate 超时后 run 自动标记为 interrupted | 等待超时（或调短超时时间测试） |

---

### 9.5 前端页面验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| P1 | Home 页展示项目状态、快速入口、最近运行 | 浏览器访问 |
| P2 | Workflows 页展示工作流卡片列表 | 浏览器访问 |
| P3 | Workflows 页无工作流时展示空状态（非空白页） | 删除 workflows 后访问 |
| P4 | 点击 workflow 可进入详情/运行表单 | 浏览器交互 |
| P5 | Run Form 支持 plain text 输入并提交 | 浏览器交互 |
| P6 | Run Form 支持 JSON 输入并实时校验 | 输入非法 JSON 观察提示 |
| P7 | 提交 run 后自动跳转到 Run Detail 页 | 浏览器交互 |
| P8 | Run Detail 页实时显示 step 进度（timeline 更新） | 浏览器观察 |
| P9 | Run Detail 页实时显示流式输出文本 | 浏览器观察 |
| P10 | Run Detail 页 gate waiting 时显示审批面板 | 浏览器观察 |
| P11 | Gate 审批面板支持 approve / reject / edit 操作 | 浏览器交互 |
| P12 | Runs 列表页展示历史运行记录 | 浏览器访问 |
| P13 | Runs 列表页支持按 status 筛选 | 浏览器交互 |
| P14 | Runs 列表页点击可进入 Run Detail | 浏览器交互 |
| P15 | Run Detail 页 Outputs tab 可查看 step 输出 | 浏览器交互 |
| P16 | Run Detail 页 Logs tab 可查看事件日志 | 浏览器交互 |
| P17 | Run Detail 页 Eval tab 可查看评估结果（如有） | 浏览器交互 |
| P18 | Settings 页展示语言、主题、项目路径、环境状态 | 浏览器访问 |
| P19 | interrupted run 可通过 UI resume | 浏览器交互 |

---

### 9.6 国际化验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| I1 | 全部 UI 文案走 i18n key，无硬编码字符串 | 代码审查 + 切换语言观察 |
| I2 | 切换为英文后，所有页面文案为英文 | 浏览器交互 |
| I3 | 切换为中文后，所有页面文案为中文 | 浏览器交互 |
| I4 | 语言切换后刷新页面，语言选择被持久化 | 刷新浏览器 |
| I5 | 中英文切换后页面布局不出现明显变形 | 肉眼观察 |

---

### 9.7 视觉与体验验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| V1 | 设计 token 统一（颜色、间距、圆角、字体），页面间风格一致 | 肉眼比对各页面 |
| V2 | 不出现"后台管理模板"或"默认组件库皮肤"观感 | 肉眼评估 |
| V3 | 首屏 CTA 明确，新用户 10 秒内知道下一步操作 | 找一个未见过产品的人测试 |
| V4 | 空状态、loading 状态、error 状态都有合理的 UI 展示 | 模拟各种状态 |
| V5 | 流式输出不抖动、不闪烁 | 浏览器观察 |
| V6 | Light / Dark 主题切换正常 | 浏览器交互 |
| V7 | 桌面端（1280px+）视觉完整 | 浏览器缩放 |
| V8 | 移动端（375px）不出现严重布局崩溃 | 浏览器 DevTools 模拟 |

---

### 9.8 架构与代码质量验收

| # | 检查项 | 验收方式 |
|---|--------|----------|
| C1 | Web 层只依赖 service 层，不直接调用 CLI 命令或拼装底层依赖 | 代码审查 |
| C2 | Service 层的 DTO 类型有明确定义，不直接暴露引擎内部类型 | 代码审查 |
| C3 | `GateProvider` 接口已抽象，CLI 和 Web 各有独立实现 | 代码审查 |
| C4 | `WebEventHandler` 实现 `EngineEventHandler` 接口 | 代码审查 |
| C5 | SSE 断线恢复协议有文档或代码注释 | 代码审查 |
| C6 | 前后端 DTO 类型定义一致（或有共享机制） | 代码审查 |
| C7 | Web server 默认只监听 `127.0.0.1` | 代码审查 |
| C8 | API 敏感信息（API Key）不明文返回 | curl 验证 |
| C9 | 新增模块有合理的测试覆盖（service / gate deferred / SSE / routes） | 运行测试 |
| C10 | README 有 Web UI 启动说明，新人可据此启动项目 | 按文档操作 |

---

### 9.9 端到端冒烟验收

以下为最终端到端验收流程，需要在全新环境下完整走通：

**流程 1：首次使用**

1. 启动 Web 服务和前端
2. 打开浏览器访问首页
3. 确认首页展示项目状态和工作流入口
4. 进入 Workflows 页，看到模板工作流
5. 选择一个工作流，填写输入，点击 Run
6. 进入 Run Detail 页，观察 step timeline 实时更新
7. 观察流式输出实时展示
8. Run 完成后查看 Outputs 和 Logs

**流程 2：Gate 审批**

1. 启动一个含 gate 的工作流（如 `novel_writing`）
2. 等 step 进入 gate waiting
3. 在 UI 中点击 Approve
4. 确认后续 step 继续执行并完成

**流程 3：中断恢复**

1. 启动一个工作流，在 gate 等待时关闭浏览器 tab
2. 重新打开 Runs 页，找到 interrupted 的 run
3. 点击 Resume，确认工作流继续执行

**流程 4：语言切换**

1. 切换为中文，确认所有页面文案变为中文
2. 切换回英文，确认所有页面文案变为英文
3. 刷新页面，确认语言选择被持久化
