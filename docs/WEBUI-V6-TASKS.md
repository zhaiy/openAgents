# openAgents Web UI v6 - 开发任务拆解文档

**对应文档**:
- `docs/PRD-v6.md`
- `docs/PRD-v5.md`
- `docs/TECHNICAL-DESIGN-WEBUI.md`

**目标**: 将 v6"配置与执行流程可视化管理"拆解成可执行、可分配、尽量闭环的任务包  
**适用版本**: `v0.5.0`  
**创建日期**: 2026-03-21  
**更新日期**: 2026-03-22  
**状态**: 草案（已根据可行性评估调整）

---

## 一、拆分原则

### 1.1 本次任务拆分目标

本次拆分重点解决三个问题：

1. 任务要足够具体，便于直接交给不同模型执行
2. 每个任务尽量形成局部闭环，而不是只做半截页面或半截 API
3. 优先保证真实业务路径闭环，而不是只堆"展示型 UI"

### 1.2 闭环原则

本次拆分要求尽量覆盖完整增删改查链路。

这里的"增删改查"不局限于数据库意义上的 CRUD，而是按产品能力理解：

| 类型 | 在 openAgents v6 中的含义 |
|------|------|
| Create | 创建 run、创建配置草稿、创建诊断摘要缓存 |
| Read | 查看 workflow、查看 visual graph、查看 run、查看日志/输出/诊断 |
| Update | 修改配置、更新草稿、处理 Gate、刷新状态、编辑后重跑 |
| Delete | 删除草稿、移除本地缓存视图、取消待处理 UI 状态 |

### 1.3 难度等级定义

| 等级 | 含义 | 典型任务 |
|------|------|------|
| **S** | 高风险架构、核心抽象、跨模块联调、并发/事件一致性 | 事件模型、执行可视化主链路、核心状态管理、基础设施升级 |
| **A** | 中高复杂度业务模块，涉及多个页面/接口/状态 | 可视化配置闭环、诊断闭环、重跑闭环 |
| **B** | 标准 API、标准前端页面、组件集成、普通测试 | 列表页、详情页、筛选器、摘要面板 |
| **C** | 低风险样式、文案、辅助工具、简单交互 | 空状态、i18n、视觉打磨、说明文档 |
| **D** | 极低风险机械性工作 | 文案补齐、icon 映射、常量整理、测试数据补充 |

### 1.4 模型分配建议

| 等级 | 建议模型 |
|------|------|
| **S** | GPT-5.4 / Opus 4.6 |
| **A** | GPT-5.4-mini / Claude Sonnet 类 |
| **B** | 5.3-codex / GPT-5.4-mini / Kimi K2.5 |
| **C** | 便宜模型优先 |
| **D** | 最便宜稳定模型即可 |

### 1.5 任务分层

本次拆分为 7 层：

1. **基础设施层**（前端基建 + 后端路由评估）
2. 基础模型层
3. 后端服务与 API 层
4. 前端页面与组件层
5. 诊断与复用层
6. 测试与质量层
7. 文档与收尾层

---

## 二、推荐开发顺序

建议按以下顺序推进：

1. **先完成基础设施升级**（T0 前端基建、T0.5 后端路由评估、T28 组件设计系统）—— 这三个任务可并行
2. 再完成 visual data model 和 API 边界（T1、T2、T3）
3. 完成 SSE 一致性改造（T4）并通过集成测试验证 —— **T4 是执行可视化链路的基石，必须在 T18 前完成**
4. 再完成 workflow overview 与 visual run config（T16、T17）
5. 再完成 execution console 主链路（T18、T19、T20）
6. 然后补 diagnostics / compare / re-run（T21、T22、T23）
7. 最后做外围页面升级、视觉收尾和文档

如果要并行：

- `S` 任务先由高成本模型定边界
- `B/C/D` 任务可以大量并发
- 依赖 SSE / visual state 的任务不要过早并行实现
- T15（前端 Graph 数据层）可先用 mock 数据推进，与后端 T3/T4 并行开发

### 关键路径警示

执行可视化主链路的依赖深度为 7 级：

```
T0 → T1 → T3 → T4 → T10 → T15 → T18 → T19/T20
```

其中包含 5 个 S 级任务。建议：
- T15 用 mock 数据先行，减少对 T10 的串行等待
- T28（组件设计系统）与 T0 并行启动，不要等页面开发时再补
- 每个 S 级任务完成后附带核心单元测试，不攒到最后补

---

## 三、总任务地图

| 编号 | 名称 | 闭环类型 | 依赖 | 难度 |
|------|------|------|------|------|
| **V6-T0** | **前端基础设施升级** | **基础设施** | **无** | **S** |
| **V6-T0.5** | **后端路由层评估与升级** | **基础设施** | **无** | **A** |
| V6-T1 | 定义 Visual View Model 与 DTO 契约（含现有 DTO 清理） | R/U 基础 | T0 | S |
| V6-T2 | Workflow Visual Summary Service | R | T1 | A |
| V6-T3 | Run Visual State Service | R/U | T1 | S |
| V6-T4 | Run Event Snapshot + SSE 一致性改造（含集成测试） | R/U | T1,T3,T0.5 | S |
| V6-T5 | Diagnostics Summary Service | R | T1,T3 | A |
| V6-T6 | Run Reuse / Re-run Service | C/R/U | T3 | A |
| V6-T7 | Config Draft Service | C/R/U/D | T1 | A |
| V6-T8 | Run Comparison Service（无状态） | R | T1,T3 | B |
| V6-T9 | Workflow Visual APIs | R | T2,T0.5 | B |
| V6-T10 | Run Visual APIs | R/U | T3,T4,T0.5 | A |
| V6-T11 | Diagnostics APIs | R | T5,T0.5 | B |
| V6-T12 | Re-run / Config Reuse APIs | C/R/U | T6,T0.5 | B |
| V6-T13 | Config Draft APIs | C/R/U/D | T7,T0.5 | B |
| V6-T14 | Run Comparison API（Session 闭环） | C/R/D | T8,T0.5 | B |
| V6-T15 | 前端 Graph 数据层与状态仓库 | R/U 基础 | T0,T1（可用 mock 先行） | S |
| V6-T16 | Workflow Overview 页面闭环 | R | T9,T15,T28 | A |
| V6-T17 | Visual Run Config 页面闭环 | C/R/U/D | T9,T12,T13,T15,T28 | S |
| V6-T18 | Execution Console 页面闭环 | R/U | T10,T15,T28 | S |
| V6-T19 | Node Inspector / Timeline / Live Output 组件 | R | T18 | A |
| V6-T20 | Gate 可视化处理闭环 | U | T10,T18 | A |
| V6-T21 | Diagnostics 页面闭环 | R | T11,T18,T28 | A |
| V6-T22 | Run Comparison 页面闭环（Session 模式） | C/R/D | T14,T18,T28 | B |
| V6-T23 | Re-run 与 Edit-and-Re-run 闭环 | C/R/U | T12,T17,T18 | A |
| V6-T24 | Home 工作台升级 | R | T11,T18,T21,T28 | B |
| V6-T25 | Workflows 列表升级 | R | T9,T16,T28 | B |
| V6-T26 | Runs 列表升级 | R/U | T10,T12,T14,T28 | B |
| V6-T27 | Settings 环境与默认项升级 | R/U | 现有设置 API | B |
| **V6-T28** | **可视化组件设计系统与状态样式** | **R 基础** | **T0** | **A** |
| V6-T29 | 空状态 / 错误状态 / 加载状态补齐 | R | T16~T27 | C |
| V6-T30 | i18n 与文案补齐 | R | T16~T29 | C |
| **V6-T31a** | **核心 Service 单元测试（随 S 级任务同步交付）** | **QA** | **T3,T4** | **A** |
| V6-T31b | 后端 API 测试补齐 | QA | T9~T14 | B |
| V6-T32 | 前端交互测试与冒烟测试 | QA | T16~T27 | A |
| V6-T33 | 联调、性能与一致性修复 | QA/U | T31a,T31b,T32 | S |
| V6-T34 | 文档、启动脚本与演示数据整理 | 收尾 | T33 | C |
| V6-T35 | 机械性收尾任务包 | 收尾 | 相关模块完成后 | D |

---

## 四、阶段化任务包

## Phase 0：基础设施与协议

> **变更说明**：此阶段新增 T0（前端基础设施升级）和 T0.5（后端路由层评估），并将 T28（组件设计系统）从 Phase 3 提前至此阶段。这三个任务可并行启动。

### V6-T0. 前端基础设施升级

### 目标

当前前端无全局状态管理、无图可视化库、无可复用组件体系。v6 的 DAG 实时可视化、三栏布局、SSE 增量合并等能力无法在当前基础上直接构建。本任务在所有页面开发前完成基础设施升级。

### 产出

- 引入 **Zustand** 作为全局状态管理方案
- 引入 **React Flow**（或 @xyflow/react）作为 DAG 图可视化基础库
- 重构 `web/src/api/` 层，统一请求/错误处理/缓存策略
- 建立 `web/src/stores/` 目录结构，为后续 graph state、run state 预留位置
- 建立 `web/src/components/ui/` 基础组件目录（Button、Badge、Card、Panel 等）

### 关键点

- 不改变现有页面功能，只做基础设施补齐
- Zustand store 先建空壳，后续任务填充业务逻辑
- React Flow 先验证基本渲染能力，确认与项目构建兼容
- API 层重构需保证现有 6 个页面的数据获取不受影响

### 闭环类型

- 基础设施

### 难度

`S`

### 推荐模型

高成本模型

### 验收标准

- 现有 6 个页面功能不受影响
- Zustand 可在任意组件中使用
- React Flow 可渲染简单的示例 DAG
- API 层有统一的请求/错误处理封装
- 基础 UI 组件可供后续页面引用

---

### V6-T0.5. 后端路由层评估与升级

### 目标

当前后端使用原生 Node.js `http` 模块手写路由匹配（`src/web/routes.ts` 中的 `WebRouter`）。v6 将新增 15+ 个 API 端点，继续在原生 http 上堆加会导致路由匹配脆弱、缺少中间件能力（参数校验、错误处理、日志）、维护成本高。

### 产出

- 评估是否引入轻量框架（推荐 Fastify 或封装更健壮的自有路由层）
- 如引入框架：迁移现有 API 端点，保证行为兼容
- 如不引入框架：至少封装统一的路由注册、参数解析、错误处理中间件
- 确保 SSE 端点在新路由层下正常工作

### 关键点

- 这是一个"要不要做"的评估任务，如果评估结论是当前路由层足够，可跳过迁移
- 迁移如果进行，必须保证所有现有 API 行为不变
- SSE 流式响应是特殊场景，需要单独验证

### 闭环类型

- 基础设施

### 难度

`A`

### 推荐模型

中高成本模型

### 验收标准

- 有明确的评估结论文档
- 如进行迁移，所有现有 API 端点测试通过
- SSE 流正常工作

---

### V6-T28. 可视化组件设计系统与状态样式

> **变更说明**：从原 Phase 3 / P2 **提前到 Phase 0 / P0**。所有页面（T16~T26）都依赖统一的状态型组件，必须在页面开发前完成。

### 目标

在页面开发前先沉淀一套状态型组件。

### 产出

- node card（支持 hover / selected / active / blocked 四态）
- edge / connector style
- status badge（running / gate_waiting / failed / completed / cached / pending / skipped）
- timeline item
- inspector panel
- metric card
- warning callout

### 依赖

- T0（需要 React Flow 和基础 UI 组件目录就绪）

### 闭环类型

- `Read` 基础

### 难度

`A`

### 推荐模型

中高成本模型

### 验收标准

- 不同页面使用统一状态视觉语言
- 组件在 Storybook 或独立 demo 页中可独立预览
- 状态色在浅色主题下可快速识别

---

### V6-T1. 定义 Visual View Model 与 DTO 契约

### 目标

建立 v6 所有可视化页面共用的数据结构，避免后续页面各自拼 DTO。**同时清理现有 DTO 不一致问题。**

### 产出

- `src/app/dto.ts` 扩展
- workflow visual summary DTO
- run visual state DTO
- run node state DTO
- diagnostics summary DTO
- compare result DTO（无状态对比结果，非 session）
- config draft DTO

### 关键点

- 不直接暴露底层 engine 类型
- 兼容 metadata 缺失的降级场景
- 前后端 DTO 尽量共享
- **修复现有 DTO 不一致**：当前 `RunDetailDto.steps` 为 `Record<string, RunStepDto>`，但前端假设为数组，需统一为前后端一致的结构
- **定义 workflow/step 元数据扩展 schema**：在 `config/schema.ts` 中增加 optional 的 `displayName`、`description`、`tags` 等字段，为 overview 和 config 页面提供降级依据
- 明确降级规则：无 description 则显示 prompt 截断、无 displayName 则用 step id

### 闭环类型

- `Read` 基础
- `Update` 基础

### 难度

`S`

### 推荐模型

高成本模型

### 验收标准

- 前后端无需重复定义临时类型
- workflow / run / diagnostics / compare / draft 都有稳定 DTO
- 能支撑后续页面而不反复重构
- **现有 DTO 不一致问题已修复**（RunDetailDto.steps 前后端一致）
- **元数据扩展 schema 已定义（optional 字段）**

---

### V6-T2. Workflow Visual Summary Service

### 目标

为 workflow overview 提供统一的可视化摘要服务。

### 产出

- `src/app/services/workflow-visual-service.ts`

### 服务能力

- list workflow visual summaries
- get workflow visual summary by id
- build mini DAG nodes/edges（复用 `DAGParser.parse()` 的 `ExecutionPlan`）
- summarize gates/evals/scripts/cache markers
- summarize input schema / inferred inputs

### 闭环类型

- `Read`

### 难度

`A`

### 推荐模型

中高成本模型

### 验收标准

- 能从当前 workflow 配置稳定生成 overview 数据
- 缺少 schema 时有合理降级

---

### V6-T3. Run Visual State Service

### 目标

把 run 的执行状态统一抽象成适合 UI 展示的 visual state。

### 产出

- `src/app/services/run-visual-service.ts`
- **核心单元测试**（作为 T31a 的一部分同步交付）

### 服务能力

- get run visual state
- map step events to node state
- aggregate active node ids / failed node ids / gate waiting ids
- hydrate node inspector data
- provide timeline entries

### 关键风险

- 事件不完整时如何回填快照
- run 刷新时如何保证状态一致
- pending/running/gate_waiting/cached 的定义边界

### 闭环类型

- `Read`
- `Update`

### 难度

`S`

### 推荐模型

高成本模型

### 验收标准

- 页面刷新后仍能恢复正确 visual state
- 即使错过部分 SSE 事件，也能通过快照拉平状态
- **核心单元测试覆盖状态映射、快照回填、边界状态**

---

### V6-T4. Run Event Snapshot + SSE 一致性改造

### 当前实现同步（2026-03-22）

- 已补齐前后端 SSE 协议对接，前端开始监听命名事件，不再只依赖默认 `message`
- 服务端 SSE 初始化支持从 query/header 读取 `lastEventId`
- 前端 `run-store` 已支持 `sync` 快照事件与 `run.closed` 状态收口
- 当前状态可视为 **已完成主链路闭环**

### 目标

建立"初始快照 + 增量事件"的一致性模型，避免前端状态飘移。**这是执行控制台（T18）、Node Inspector（T19）、Gate 可视化（T20）的基石，必须在这些任务之前完成并通过集成测试验证。**

### 产出

- SSE 事件增强（每条事件带 sequence 编号）
- snapshot API 对齐（`GET /api/runs/:id/visual-state` 返回完整快照）
- version / sequence 机制
- 前端 reconnect 策略（替换当前"出错即 close"的行为）
- **SSE 一致性集成测试套件**

### 关键点

- 每条事件带 sequence 或 logical timestamp
- 前端断线重连后可通过 lastEventId 重新对齐
- run 完成后最终快照与事件结果一致
- **当前 SSE 实现已知缺陷**：无 sequence 编号、前端 `EventSource` 出错直接 close 无重连、初始 sync 事件为空载荷。这些都需要在本任务中修复

### 闭环类型

- `Read`
- `Update`

### 难度

`S`

### 推荐模型

高成本模型

### 验收标准

- 前端可通过 snapshot 初始化 + SSE 增量刷新
- 重连后状态不乱序、不回退
- **必须包含集成测试，覆盖以下场景**：
  - 正常连接 -> 收到完整事件序列
  - 断线重连 -> 通过 sequence 重新对齐，不丢事件
  - 页面刷新 -> snapshot + 后续增量 = 完整状态
  - run 已完成 -> snapshot 直接返回最终状态
- **集成测试全部通过后方可标记本任务完成，不留到 T33 联调阶段**

---

## Phase 1：后端业务闭环

### V6-T5. Diagnostics Summary Service

### 目标

为诊断页面和失败 run 详情提供统一诊断摘要。

### 产出

- `src/app/services/diagnostics-service.ts`

### 服务能力

- list failed runs summary
- list waiting gates summary
- get run diagnostics summary
- map error -> suggested actions（本期基于规则，不依赖 LLM）
- correlate node logs / outputs / errors

### 闭环类型

- `Read`

### 难度

`A`

### 验收标准

- 能稳定返回失败节点、错误摘要、建议动作
- 能给首页和 diagnostics 页直接消费

---

### V6-T6. Run Reuse / Re-run Service

### 目标

把"历史 run 作为配置资产复用"的逻辑封装成独立服务。

### 产出

- `src/app/services/run-reuse-service.ts`

### 服务能力

- get reusable config from run
- create rerun payload
- create edited rerun payload
- duplicate run config as draft

### 闭环类型

- `Create`
- `Read`
- `Update`

### 难度

`A`

### 验收标准

- 可从历史 run 生成新 run 的默认配置
- 支持"原样重跑"和"修改后重跑"

---

### V6-T7. Config Draft Service

### 当前实现同步（2026-03-22）

- 已完成 `create / read / update / delete` 服务能力
- 前端配置页已接入草稿保存、加载、删除、更新
- 当前状态可视为 **CRUD 闭环已完成**

### 目标

为配置页提供草稿保存、读取、更新、删除闭环。

### 产出

- `src/app/services/config-draft-service.ts`

### 服务能力

- create draft
- get draft
- update draft
- list drafts by workflow
- delete draft

### 存储建议

- 本地 JSON 文件即可
- 以 workflowId + draftId 组织

### 闭环类型

- `Create`
- `Read`
- `Update`
- `Delete`

### 难度

`A`

### 验收标准

- 配置页可以保存草稿、读取草稿、删除草稿
- 不影响已有 run 数据

---

### V6-T8. Run Comparison Service（无状态）

> **变更说明**：从原设计的"comparison session"模式**简化为无状态对比**。Lite 版本不需要 session 管理，直接传入两个 runId 即可返回 diff 结果，降低实现复杂度。

### 目标

为轻量 run 比较提供无状态对比服务。

### 产出

- `src/app/services/run-compare-service.ts`

### 服务能力

- compare two runs by id（无状态，不需要 session）
- summarize input diff
- summarize status diff
- summarize key output diff
- summarize duration / token diff

### 闭环类型

- `Read`

### 难度

`B`（从 A 降级，去掉了 session 管理复杂度）

### 验收标准

- 至少能比较输入、状态、时长、token、关键输出摘要
- 无需创建/删除 session，传入两个 runId 即可

---

## Phase 2：API 层闭环

### V6-T9. Workflow Visual APIs

### 目标

向前端暴露 workflow 可视化相关读接口。

### API 建议

- `GET /api/workflows`
- `GET /api/workflows/:id`
- `GET /api/workflows/:id/visual-summary`

### 闭环类型

- `Read`

### 难度

`B`

### 验收标准

- 前端无需自己推断 visual summary

---

### V6-T10. Run Visual APIs

### 目标

暴露执行控制台所需的 run visual state 与 timeline 能力。

### API 建议

- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/runs/:id/visual-state`
- `GET /api/runs/:id/timeline`
- `GET /api/runs/:id/node/:nodeId`
- `GET /api/runs/:id/events`

### 闭环类型

- `Read`
- `Update`

### 难度

`A`

### 验收标准

- execution console 能通过这些接口完整工作

---

### V6-T11. Diagnostics APIs

### 目标

向 diagnostics 页面暴露读接口。

### API 建议

- `GET /api/diagnostics/failed-runs`
- `GET /api/diagnostics/waiting-gates`
- `GET /api/diagnostics/runs/:id`

### 闭环类型

- `Read`

### 难度

`B`

### 验收标准

- 首页和 diagnostics 页能直接消费

---

### V6-T12. Re-run / Config Reuse APIs

### 目标

暴露重跑和配置复用接口。

### API 建议

- `GET /api/runs/:id/reusable-config`
- `POST /api/runs/:id/rerun`
- `POST /api/runs/:id/rerun-with-edits`

### 闭环类型

- `Create`
- `Read`
- `Update`

### 难度

`B`

### 验收标准

- 前端可从 run detail 一键重跑或编辑后重跑

---

### V6-T13. Config Draft APIs

### 目标

暴露配置草稿完整 CRUD。

### API 建议

- `POST /api/workflows/:id/drafts`
- `GET /api/workflows/:id/drafts`
- `GET /api/workflows/:id/drafts/:draftId`
- `PATCH /api/workflows/:id/drafts/:draftId`
- `DELETE /api/workflows/:id/drafts/:draftId`

### 闭环类型

- `Create`
- `Read`
- `Update`
- `Delete`

### 难度

`B`

### 验收标准

- 草稿管理完整可用

---

### V6-T14. Run Comparison API（Session 闭环）

### 当前实现同步（2026-03-22）

- 原中期简化方案中的“无状态 compare”已升级为 session 模式
- 当前后端已支持：
  - `POST /api/compare`
  - `GET /api/compare/:id`
  - `DELETE /api/compare/:id`
- 同时保留 `GET /api/runs/compare` 作为兼容/直接比较入口
- 当前状态可视为 **C/R/D 闭环已完成**

### 目标

暴露轻量 compare session 闭环接口。

### API 建议

- `POST /api/compare`
- `GET /api/compare/:id`
- `DELETE /api/compare/:id`

### 闭环类型

- `Create`
- `Read`
- `Delete`

### 难度

`B`

### 验收标准

- 前端可以创建、读取、清除 compare session
- compare 页面无需自己管理 diff 持久态

---

## Phase 3：前端基础能力

### V6-T15. 前端 Graph 数据层与状态仓库

### 目标

建立 execution console 和 workflow overview 共用的前端 graph view state。

### 产出

- graph view model adapter（将后端 DTO 转为 React Flow 节点/边）
- selected node state（Zustand store）
- timeline state（Zustand store）
- SSE merge reducer
- snapshot hydration logic

### 建议内容

- `web/src/stores/graph-store.ts`
- `web/src/stores/run-store.ts`
- `web/src/lib/graph/*`
- `web/src/types/*`

### 关键点

- 可先用 mock 数据开发，不必等 T10 API 完成
- 基于 T0 引入的 Zustand 和 React Flow

### 闭环类型

- `Read`
- `Update`

### 难度

`S`

### 验收标准

- workflow overview 和 execution console 不再各自维护一套散乱状态
- mock 数据下可完整渲染 DAG 图并响应节点选择

---

## Phase 4：前端页面闭环

### V6-T16. Workflow Overview 页面闭环

### 目标

完成 workflow 概览页完整只读闭环。

### 页面能力

- workflow header
- structure summary
- mini DAG preview（基于 T15 的 graph view + T28 的 node card）
- node detail panel
- input summary
- run CTA

### 依赖

- T9（API）、T15（Graph 数据层）、T28（组件设计系统）

### 闭环类型

- `Read`

### 难度

`A`

### 验收标准

- 用户不看 YAML 也能理解大致结构

---

### V6-T17. Visual Run Config 页面闭环

### 当前实现同步（2026-03-22）

- 已完成输入模式切换、历史 run 导入、草稿保存/加载/更新/删除
- 已补齐 pre-run summary
- 已移除 `window.location.reload()` 这种不稳定实现
- 已接入 Settings 页面持久化下来的默认 runtime options（当前为本地持久化）
- 当前状态可视为 **页面闭环基本完成**
- 后续可继续增强：
  - schema-driven 表单体验
  - 字段级更细粒度校验提示

### 目标

完成配置页完整闭环，包括草稿、导入、运行前摘要。

### 页面能力

- simple form / json / from previous run 模式切换
- 字段级校验
- runtime options
- pre-run summary
- save draft
- load draft
- update draft
- delete draft
- submit run

### 闭环类型

- `Create`
- `Read`
- `Update`
- `Delete`

### 难度

`S`

### 关键点

- 这是 v6 最重要的配置闭环页面
- 要处理 schema 存在和缺失两种场景
- schema 缺失时退回 Plain Text / Raw JSON 模式

### 验收标准

- 用户能在页面内完成配置、保存、读取、删除、发起运行

---

### V6-T18. Execution Console 页面闭环

### 目标

完成执行控制台主视图闭环。

### 页面能力

- run header
- execution map（基于 T15 的 graph view + T28 的 node card）
- selected node highlighting
- status summary
- timeline summary
- live refresh（基于 T4 的 SSE 一致性机制）
- completion / failure state switch

### 依赖

- T10（API）、T15（Graph 数据层）、T28（组件设计系统）
- **T4 必须已完成并通过集成测试**

### 闭环类型

- `Read`
- `Update`

### 难度

`S`

### 验收标准

- 用户一眼知道当前执行位置
- 刷新后状态可恢复

---

### V6-T19. Node Inspector / Timeline / Live Output 组件

### 目标

完成 execution console 的三个核心子模块。

### 范围

- node inspector
- event timeline
- live output panel
- output expand/copy/wrap

### 闭环类型

- `Read`

### 难度

`A`

### 验收标准

- 用户点任何节点，都能看到关联输入/输出/日志摘要

---

### V6-T20. Gate 可视化处理闭环

### 目标

把 Gate 从"弹窗交互"升级成 execution console 内的核心状态流。

### 页面能力

- gate waiting 高亮
- gate queue summary
- approve
- reject
- edit then approve
- 处理后状态回写

### 闭环类型

- `Update`

### 难度

`A`

### 验收标准

- Gate 出现时用户无需离开主视图即可处理

---

### V6-T21. Diagnostics 页面闭环

### 当前实现同步（2026-03-22）

- 已修复页签不可切换问题
- 已接入 diagnostics detail 数据读取
- 当前页面已展示：
  - failed runs
  - waiting gates
  - selected run diagnostics
  - suggested actions
  - upstream states
- 当前状态可视为 **主闭环完成**
- 后续可继续增强 `downstreamImpact` 的可视化表达

### 目标

完成 diagnostics 一级页面与 run detail diagnostics tab。

### 页面能力

- failed runs list
- waiting gates list
- needs attention 区域
- run diagnostics detail
- suggested actions
- logs correlation

### 闭环类型

- `Read`

### 难度

`A`

### 验收标准

- 用户能快速从 diagnostics 进入具体问题处理

---

### V6-T22. Run Comparison 页面闭环（Session 模式）

### 当前实现同步（2026-03-22）

- 已改为 session 驱动：
  - 创建 comparison session
  - 读取 comparison session
  - 清除 comparison session
- 当前页面闭环为 **C/R/D 已完成**
- 与文档之前“无状态 compare”的中期简化方案相比，现已回到更完整的 session 方案

### 目标

完成 run 对比轻量闭环。

### 页面能力

- choose two runs（从列表或从 run detail 进入）
- create comparison session
- show diff summary（输入、状态、时长、token、关键输出）
- clear comparison session
- link to individual run details

### 闭环类型

- `Create`
- `Read`
- `Delete`

### 难度

`B`

### 验收标准

- 用户能快速看到两次 run 的关键差异
- comparison session 可创建、读取、清理

---

### V6-T23. Re-run 与 Edit-and-Re-run 闭环

### 目标

打通 run detail -> config page -> new run 的复用路径。

### 页面能力

- run again
- edit and rerun
- import previous config
- prefill config page

### 闭环类型

- `Create`
- `Read`
- `Update`

### 难度

`A`

### 验收标准

- 用户不需要复制 JSON 就能重跑

---

### V6-T24. Home 工作台升级

### 目标

把首页升级为工作台。

### 页面能力

- recent runs
- waiting gates
- failed runs
- quick actions
- environment cards

### 闭环类型

- `Read`

### 难度

`B`

### 验收标准

- 首页成为日常工作入口

---

### V6-T25. Workflows 列表升级

### 目标

增强 workflows 列表检索和概览能力。

### 页面能力

- search
- tag filter
- gate/eval filter
- visual summary excerpt
- open overview

### 闭环类型

- `Read`

### 难度

`B`

### 验收标准

- 用户能快速找到合适 workflow

---

### V6-T26. Runs 列表升级

### 目标

增强 runs 列表作为运营入口的能力。

### 页面能力

- status filter
- workflow filter
- time filter
- quick rerun
- quick compare entry
- failed/gate badges

### 闭环类型

- `Read`
- `Update`

### 难度

`B`

### 验收标准

- 用户能从 runs 列表直接进入重跑和对比

---

### V6-T27. Settings 环境与默认项升级

### 当前实现同步（2026-03-22）

- 环境状态展示已完成
- 默认 runtime options 已具备持久化能力，但当前采用的是 **前端 localStorage 持久化**
- 当前状态建议标记为 **R 完成，U 部分完成**
- 若后续希望多端或更强一致性，仍建议补后端持久化设置接口

### 目标

增强 settings 页的环境状态和默认运行项配置。

### 页面能力

- environment readiness
- provider/api key status
- default runtime options
- ui preferences

### 闭环类型

- `Read`
- `Update`

### 难度

`B`

### 验收标准

- 用户能知道环境是否可用
- 默认运行选项可修改

---

## Phase 5：体验补齐与测试

### V6-T29. 空状态 / 错误状态 / 加载状态补齐

### 目标

为新页面补齐完整状态覆盖。

### 范围

- empty workflows
- empty runs
- no diagnostics
- no drafts
- loading graph
- sse disconnected
- permission/config missing

### 难度

`C`

### 验收标准

- 页面不会出现裸空白或无解释错误

---

### V6-T30. i18n 与文案补齐

### 目标

补齐 v6 新页面与组件文案。

### 范围

- `src/i18n/locales/en.ts`
- `src/i18n/locales/zh.ts`
- `web/src/i18n/*`

### 难度

`C`

### 验收标准

- 关键页面无硬编码文案

---

### V6-T31a. 核心 Service 单元测试（随 S 级任务同步交付）

> **变更说明**：从原 T31 中拆出。核心 S 级任务（T3 Run Visual State、T4 SSE 一致性）的测试不应留到最后补，而是随对应 service 同步交付。

### 目标

为 S 级核心 service 提供单元测试和集成测试保障。

### 范围

- run visual state service 单元测试（状态映射、快照回填、边界状态）
- SSE 一致性集成测试（连接、重连、快照对齐、完成状态）
- workflow visual summary service 核心场景测试

### 难度

`A`

### 验收标准

- T3 和 T4 的验收标准中要求的测试全部通过
- 核心状态映射逻辑有覆盖

---

### V6-T31b. 后端 API 测试补齐

### 目标

为新增 API 端点补齐测试。

### 范围

- workflow visual API tests
- run visual API tests
- diagnostics API tests
- rerun/draft/compare API tests

### 难度

`B`

### 验收标准

- 所有新增 API 端点有基本的请求/响应测试

---

### V6-T32. 前端交互测试与冒烟测试

### 目标

补齐 v6 页面主路径测试。

### 范围

- workflow overview
- config draft CRUD
- submit run
- execution console render
- gate action
- rerun flow
- compare flow

### 难度

`A`

### 验收标准

- 核心用户路径有冒烟保障

---

### V6-T33. 联调、性能与一致性修复

### 当前实现同步（2026-03-22）

- 已完成一轮高优先级联调修复，覆盖：
  - 前端构建失败问题
  - 根工程 lint 错误
  - web lint 错误
  - SSE 实时链路不一致
  - Run Detail 输出展示错误
  - Diagnostics 页面交互缺口
- 当前工程验证状态：
  - `npm test` 通过
  - `npm run lint` 通过
  - `npm run web:build` 通过
  - `cd web && npm run lint` 通过
- 当前状态可视为 **第一轮联调修复已完成**
- 后续仍可继续关注：
  - 前端 bundle 体积偏大
  - Playwright / UI 级回归覆盖不足

### 目标

集中处理前后端联调、复杂状态 bug。

### 范围

- snapshot 与 event merge bug
- stale inspector bug
- duplicated rerun bug
- graph rendering performance

### 关键点

- SSE 一致性问题应已在 T4 集成测试中解决，此阶段不应再有 SSE 基础性 bug
- 重点处理跨模块联调和性能优化

### 难度

`S`

### 验收标准

- 关键闭环稳定可演示

---

### V6-T34. 文档、启动脚本与演示数据整理

### 目标

补齐开发与演示材料。

### 范围

- README / docs 更新
- 本地启动说明
- 演示 workflow / demo data
- 截图说明或 GIF 指引

### 难度

`C`

### 验收标准

- 新同学能按文档跑起并理解 v6 价值

---

### V6-T35. 机械性收尾任务包

### 目标

收拢适合最便宜模型处理的小任务。

### 示例

- icon 映射补齐
- 状态文案微调
- 常量提取
- 测试 fixtures 扩充
- loading skeleton 补点
- aria label / title 属性补齐

### 难度

`D`

### 验收标准

- 不阻塞主功能开发
- 适合低成本并发处理

---

## 五、按闭环组织的任务包

如果你想按"功能闭环"而不是按页面拆分，可以这样分配模型：

### 闭环包 0：基础设施闭环（最先启动，可并行）

包含：

- `V6-T0`（前端基础设施）
- `V6-T0.5`（后端路由评估）
- `V6-T28`（组件设计系统）

这三个任务无相互依赖，可完全并行。完成后所有后续页面和 API 开发才有稳固基础。

---

### 闭环包 A：Workflow 可视化浏览闭环

包含：

- `V6-T1`
- `V6-T2`
- `V6-T9`
- `V6-T15`
- `V6-T16`
- `V6-T25`

建议负责人：

- 1 个高成本模型定 DTO 和 graph model
- 1 个中等模型完成 API
- 1 个中等/便宜模型完成页面

---

### 闭环包 B：配置管理闭环

包含：

- `V6-T7`
- `V6-T13`
- `V6-T17`

闭环内容：

- 创建草稿
- 查看草稿
- 更新草稿
- 删除草稿
- 通过草稿启动 run

这是最典型的 CRUD 闭环。

---

### 闭环包 C：执行可视化闭环

包含：

- `V6-T3`
- `V6-T4`（含集成测试）
- `V6-T10`
- `V6-T15`
- `V6-T18`
- `V6-T19`
- `V6-T20`
- `V6-T31a`（核心 service 测试，随 T3/T4 同步交付）

这是 v6 最核心、也最适合高成本模型主导的闭环。

---

### 闭环包 D：诊断闭环

包含：

- `V6-T5`
- `V6-T11`
- `V6-T21`

闭环内容：

- 查看失败 run
- 查看待处理 Gate
- 查看具体诊断摘要
- 定位问题并跳转到对应 run

---

### 闭环包 E：重跑与复用闭环

包含：

- `V6-T6`
- `V6-T12`
- `V6-T17`
- `V6-T23`
- `V6-T26`

闭环内容：

- 从历史 run 读取配置
- 原样重跑
- 编辑后重跑

---

### 闭环包 F：对比闭环（轻量）

包含：

- `V6-T8`
- `V6-T14`
- `V6-T22`

闭环内容：

- 传入两个 runId 获取对比结果
- 查看对比摘要

这是一个纯 Read 闭环，无状态管理，实现最简。

---

## 六、推荐并行分配方案

### 方案一：成本最优

#### 高成本模型

- `V6-T0`
- `V6-T1`
- `V6-T3`
- `V6-T4`
- `V6-T15`
- `V6-T18`
- `V6-T33`

#### 中等模型

- `V6-T0.5`
- `V6-T2`
- `V6-T5`
- `V6-T6`
- `V6-T7`
- `V6-T17`
- `V6-T19`
- `V6-T20`
- `V6-T21`
- `V6-T23`
- `V6-T28`
- `V6-T31a`
- `V6-T32`

#### 便宜模型

- `V6-T8`
- `V6-T9`
- `V6-T11`
- `V6-T12`
- `V6-T13`
- `V6-T14`
- `V6-T24`
- `V6-T25`
- `V6-T26`
- `V6-T27`
- `V6-T29`
- `V6-T30`
- `V6-T31b`
- `V6-T34`
- `V6-T35`

---

### 方案二：按闭环小队推进

#### 小队 0：基础设施（最先启动，并行）

- `V6-T0`
- `V6-T0.5`
- `V6-T28`

#### 小队 1：Workflow 浏览

- `V6-T1`
- `V6-T2`
- `V6-T9`
- `V6-T16`
- `V6-T25`

#### 小队 2：配置与草稿

- `V6-T7`
- `V6-T13`
- `V6-T17`

#### 小队 3：执行控制台（最核心）

- `V6-T3`
- `V6-T4`
- `V6-T10`
- `V6-T15`
- `V6-T18`
- `V6-T19`
- `V6-T20`
- `V6-T31a`

#### 小队 4：诊断、重跑、对比

- `V6-T5`
- `V6-T6`
- `V6-T8`
- `V6-T11`
- `V6-T12`
- `V6-T14`
- `V6-T21`
- `V6-T22`
- `V6-T23`

#### 小队 5：外围页面与收尾

- `V6-T24`
- `V6-T26`
- `V6-T27`
- `V6-T29`
- `V6-T30`
- `V6-T31b`
- `V6-T32`
- `V6-T34`
- `V6-T35`

---

## 七、优先级建议

### P0（必须完成，阻塞核心链路）

- `V6-T0`（前端基础设施）
- `V6-T0.5`（后端路由评估）
- `V6-T1`（DTO 契约 + 现有 DTO 清理）
- `V6-T3`（Run Visual State）
- `V6-T4`（SSE 一致性 + 集成测试）
- `V6-T9`（Workflow Visual API）
- `V6-T10`（Run Visual API）
- `V6-T15`（前端 Graph 数据层）
- `V6-T16`（Workflow Overview）
- `V6-T17`（Visual Run Config）
- `V6-T18`（Execution Console）
- `V6-T20`（Gate 可视化）
- `V6-T28`（组件设计系统）
- `V6-T31a`（核心 Service 测试）

### P1（重要功能，紧跟 P0 完成）

- `V6-T2`
- `V6-T5`
- `V6-T6`
- `V6-T7`
- `V6-T11`
- `V6-T12`
- `V6-T13`
- `V6-T19`
- `V6-T21`
- `V6-T23`
- `V6-T24`
- `V6-T25`
- `V6-T26`

### P2（增强功能，视时间酌情安排）

- `V6-T8`
- `V6-T14`
- `V6-T22`
- `V6-T27`
- `V6-T29`
- `V6-T30`
- `V6-T31b`
- `V6-T32`
- `V6-T34`
- `V6-T35`

---

## 八、建议你如何发给模型

如果你想省 token，建议不要把整份 PRD 每次都喂给模型，而是：

1. **最先启动**：T0 / T0.5 / T28 三个基础设施任务，只需给 `当前源码目录结构 + package.json + 本任务文档中对应章节`
2. 再给负责 `S` 任务的模型 `PRD-v6 + 本任务文档 + 相关源码目录 + T0 产出的基础设施`
3. 再把它产出的接口、DTO、约束，作为输入喂给负责 `A/B/C` 任务的模型
4. `D` 级任务只给局部文件和明确改动目标即可

推荐每次分配给模型的输入内容：

- 任务编号
- 对应章节
- 依赖任务结果
- 目标文件范围
- 验收标准

这样最省 token，也最不容易跑偏。

---

## 九、变更记录

| 日期 | 变更内容 |
|------|------|
| 2026-03-21 | 初始草案 |
| 2026-03-21 | 可行性评估后调整：新增 T0（前端基础设施）、T0.5（后端路由评估）；T1 增加现有 DTO 清理和元数据 schema 扩展；T4 增加集成测试强制验收；T8/T14/T22 简化为无状态对比；T28 从 P2 提升至 P0；T31 拆分为 T31a（核心 Service 测试，P0）和 T31b（API 测试，P2）；更新关键路径分析和并行分配方案 |
| 2026-03-22 | 根据实际开发与修复结果同步状态：T4 已完成 SSE 主链路闭环；T7/T17 已完成草稿 CRUD 与配置页闭环；T21 已补齐 diagnostics detail；T14/T22 从“无状态 compare”升级回 session 模式；T27 当前为前端本地持久化，标记为 U 部分完成；T33 第一轮联调修复完成，主工程 test/lint/build 与 web lint/build 全部通过 |

---

## 十、结论

这份拆解的核心思路是：

- 把 v6 拆成几个真正可交付的闭环，而不是散碎页面
- 把高风险能力集中在少量 `S` 任务里，交给强模型
- 把大量 API、页面、样式、文案和测试拆成 `A/B/C/D`，交给便宜模型并发推进
- **基础设施先行**：T0 / T0.5 / T28 并行启动，为后续开发铺路
- **测试前置**：核心 S 级任务的测试随 service 同步交付，不攒到最后

如果按这份任务表推进，你后续可以比较顺滑地组织出：

- 基础设施闭环
- 配置闭环
- 执行闭环
- 诊断闭环
- 重跑闭环
- 对比闭环

这几条主链路都会更完整，也更适合后面继续演进到真正的 workflow console。
