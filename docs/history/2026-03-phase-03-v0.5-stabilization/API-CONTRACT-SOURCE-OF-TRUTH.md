# OpenAgents Web API 与事件契约真源

> 创建日期：2026-03-24
> 适用范围：`N1`、`N2`、`N3`、`N5`、`N7`
> 目标：明确下一期迭代中，哪些对象和事件是跨层开发的权威依据

---

## 一、文档目的

当前规划已经明确要收口 DTO、API 与 SSE，但如果没有“契约真源”，模型很容易在以下几层之间重复发明字段：

- `src/app/dto.ts`
- `src/web/routes.ts`
- `web/src/api/index.ts`
- `web/src/stores/*`
- `web/src/pages/*`

本文档的作用是明确：

1. 哪些对象是权威对象
2. 哪些字段必须统一命名
3. 哪些字段允许派生但不允许反向污染真源

---

## 二、统一规则

### 规则 R1：后端 DTO 是跨层传输真源

对 Web API 来说，跨层传输的权威结构应首先落在：

- `src/app/dto.ts`

路由层负责：

- 参数解析
- DTO 序列化
- 错误结构封装

前端 API 层负责：

- 复用 DTO 语义
- 最少量的适配

页面和 store 不应重新发明一个并行 DTO。

### 规则 R2：页面展示字段可以派生，但不得反向定义 API 语义

例如：

- `displayDuration`
- `statusBadgeTone`
- `formattedStartedAt`

这些字段可以存在于前端，但只能是派生展示字段，不能反向要求后端迎合页面临时命名。

### 规则 R3：时间字段策略必须统一

下一期建议统一采用以下约定：

- API 原始时间字段优先使用 `timestamp number`
- 展示格式化在前端完成
- 仅在明确需要字符串协议兼容时返回 `ISO string`

如果某个接口确实返回 `ISO string`，必须在 DTO 中明确标注，不允许由页面猜测。

### 规则 R4：错误响应结构统一

下一期建议统一错误响应至少包含：

- `error.code`
- `error.message`
- `error.details`

其中：

- `code` 用于稳定分支判断
- `message` 用于用户可见提示或日志
- `details` 用于补充上下文

不建议继续混用随意的 `{ message }`、`{ error }`、`{ reason }` 等结构。

---

## 三、核心实体真源建议

## 1. Run Summary

权威定义位置：

- `src/app/dto.ts`

最低统一字段建议：

- `runId`
- `workflowId`
- `status`
- `startedAt`
- `endedAt`
- `durationMs`
- `hasGate`
- `hasEval`

要求：

- Runs 列表页、Run 详情页、Comparison 入口对同一 run summary 使用同一语义

## 2. Run Detail

权威定义位置：

- `src/app/dto.ts`

最低统一字段建议：

- `runId`
- `workflowId`
- `status`
- `steps`
- `gateState`
- `evalSummary`
- `startedAt`
- `endedAt`

要求：

- Detail 是 detail，不要把页面局部派生字段直接写入 detail DTO

## 3. Visual State

权威定义位置：

- `src/app/dto.ts`
- `src/app/services/run-visual-service.ts`

最低统一字段建议：

- `runId`
- `sequence`
- `workflowStatus`
- `nodeStates`
- `activeNodeId`
- `gateState`
- `lastUpdatedAt`

要求：

- `run-store` 和 `graph-store` 必须围绕同一份 visual state 语义工作

## 4. Timeline

权威定义位置：

- `src/app/dto.ts`
- `src/app/services/run-visual-service.ts`

最低统一字段建议：

- `sequence`
- `eventType`
- `nodeId`
- `timestamp`
- `summary`

要求：

- timeline 是事件观察视图，不要混入页面临时状态字段

## 5. Diagnostics Summary

权威定义位置：

- `src/app/dto.ts`
- `src/app/services/diagnostics-service.ts`

最低统一字段建议：

- `runId`
- `failedNodeId`
- `waitingGateNodeId`
- `upstreamState`
- `downstreamImpact`
- `failureType`
- `recommendedActions`

## 6. Comparison DTO

权威定义位置：

- `src/app/dto.ts`
- `src/app/services/run-compare-service.ts`

最低统一字段建议：

- `runA`
- `runB`
- `inputDiff`
- `nodeDiffs`
- `outputSummaryDiff`
- `tokenDiff`
- `durationDiff`

---

## 四、SSE 事件真源建议

## 1. 事件分层

建议分为两类：

- snapshot 事件
- 增量事件

推荐规则：

- 首次进入或重连补偿时，优先使用 snapshot 建立基线
- 增量事件只表达基线之后的变化

## 2. 事件最小公共字段

所有事件建议统一包含：

- `sequence`
- `runId`
- `eventType`
- `timestamp`

如果缺少这四类字段，前后端很难做稳定重放和重连恢复。

## 3. sequence 规则

建议将 `sequence` 视为单 run 内的严格递增事件序号。

要求：

- 前端不得自行重排 sequence
- 重连恢复必须以 `lastEventId` 或等价序号为依据
- 页面不应通过事件到达顺序猜测真实先后

## 4. 允许的主要事件语义

下一期建议重点围绕以下事件收口：

- `step.started`
- `step.stream`
- `step.completed`
- `step.failed`
- `gate.waiting`
- `gate.resolved`
- `workflow.completed`

要求：

- 每个事件都要能回答“它更新了 visual state 的哪一部分”
- 不允许出现“页面靠猜测决定如何更新”的事件

---

## 五、字段命名建议

### 命名建议

- 用 `runId`，不要在不同层混用 `id`、`run_id`
- 用 `workflowId`，不要混用 `workflow`
- 用 `nodeId` 表示图节点或 step 节点标识
- 用 `timestamp` / `startedAt` / `endedAt`，不要混用 `time` / `created`
- 用 `durationMs` 表示时长

### 状态建议

- `queued`
- `running`
- `waiting`
- `completed`
- `failed`
- `cancelled`

如果前后端已有不同状态字面量，下一期应统一，不再让页面做多套兼容。

---

## 六、开发约束

以下行为视为违反契约真源原则：

1. 前端页面新增一个后端未定义的核心业务字段并反向依赖
2. store 将同一业务状态保存为两份真源
3. route 返回结构与 DTO 命名明显不一致
4. 用临时兼容逻辑长期保留旧字段和新字段并行
5. 用文案文本而非错误码驱动逻辑判断

---

## 七、结论

下一期开发过程中，建议把以下文件视为“契约收口核心区”：

- `src/app/dto.ts`
- `src/web/routes.ts`
- `src/app/events/*`
- `src/app/services/run-visual-service.ts`
- `web/src/api/index.ts`

如果模型在这些文件之外发明新的核心传输结构，应优先视为风险信号，而不是默认接受。
