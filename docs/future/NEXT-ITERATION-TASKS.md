# OpenAgents 下一期迭代任务拆解

> 创建日期：2026-03-22
> 对应文档：`docs/future/NEXT-ITERATION-PLAN.md`
> 适用阶段：下一期“功能收口、架构加固、核心流程做扎实”迭代

---

## 一、文档目的

本文档用于把下一期迭代计划进一步拆成可执行的任务包，便于：

- 做排期
- 做依赖管理
- 分配给不同模型或不同开发者
- 作为阶段验收依据

本次拆分不追求任务数量多，而追求：

1. 主链路优先
2. 契约优先
3. 一致性优先
4. 每个任务尽量形成局部闭环

---

## 二、优先级定义

| 优先级 | 含义 |
|------|------|
| `P0` | 必须完成，否则本期“做扎实”的目标不成立 |
| `P1` | 强烈建议完成，能显著提高现有能力的真实价值 |
| `P2` | 可伴随推进，用于控制技术债与后续成本 |

---

## 三、难度定义

| 等级 | 含义 |
|------|------|
| `S` | 涉及跨层契约、核心状态、主链路一致性、较高联调风险 |
| `A` | 中高复杂度业务闭环，涉及多个模块 |
| `B` | 标准页面/API/测试增强任务 |
| `C` | 收尾、整理、文档、低风险增强 |

---

## 四、推荐开发顺序

建议按以下顺序推进：

1. `N1` DTO 与 API 契约收口
2. `N2` SSE 与执行状态一致性加固
3. `N3` Run 主链路闭环加固
4. `N4` 核心链路测试补强
5. `N5` Diagnostics 深化
6. `N6` Re-run / Recovery 增强
7. `N7` Comparison 深化
8. `N8` 路由层与服务层整理

关键路径如下：

```text
N1 -> N2 -> N3 -> N4
         \-> N5 -> N6
         \-> N7
N8 可伴随进行，但不应阻塞主链路
```

---

## 五、任务总表

| 编号 | 名称 | 优先级 | 难度 | 依赖 |
|------|------|------|------|------|
| N1 | DTO 与 API 契约收口 | P0 | S | 无 |
| N2 | SSE 与执行状态一致性加固 | P0 | S | N1 |
| N3 | Run 主链路闭环加固 | P0 | A | N1, N2 |
| N4 | 核心链路测试补强 | P0 | A | N1, N2, N3 |
| N5 | Diagnostics 深化 | P1 | A | N1, N2 |
| N6 | Re-run / Recovery 增强 | P1 | A | N1, N3, N5 |
| N7 | Comparison 深化 | P1 | B | N1, N3 |
| N8 | 路由层与服务层整理 | P2 | B | N1 |

---

## 六、详细任务拆解

## N1. DTO 与 API 契约收口

### 目标

统一后端 DTO、路由返回结构、前端 API 类型定义和页面真实消费方式。

### 重点范围

- `src/app/dto.ts`
- `src/web/routes.ts`
- `web/src/api/index.ts`
- `web/src/pages/*`

### 子任务

1. 统一 Run Summary / Run Detail / Visual State / Timeline 字段定义
2. 统一时间字段格式策略并形成约定
3. 统一错误返回结构
4. 清理前端兼容性推断逻辑
5. 补最关键路由测试

### 建议产出

- DTO 契约表
- 调整后的类型定义
- 路由契约测试

### 验收标准

- 前后端关键类型不再明显重复漂移
- 页面不再依赖隐式字段兼容
- 关键 API 契约有测试保护

---

## N2. SSE 与执行状态一致性加固

### 目标

保证 Run Execution 相关状态在首次加载、事件增量更新、刷新、重连后保持一致。

### 重点范围

- `src/app/events/*`
- `src/app/services/run-visual-service.ts`
- `src/web/routes.ts`
- `web/src/stores/run-store.ts`
- `web/src/stores/graph-store.ts`
- `web/src/pages/RunExecutionPage.tsx`

### 子任务

1. 明确 snapshot 与 event patch 的边界
2. 统一 sequence / lastEventId / reconnect 逻辑
3. 收敛 run-store 与 graph-store 的职责
4. 收口节点状态更新逻辑，避免双写漂移
5. 补刷新恢复、断线重连测试

### 建议产出

- SSE 一致性处理方案
- 执行页状态模型整理
- 对应测试

### 验收标准

- 执行页刷新后状态可恢复
- 重连后不会重复/丢失关键状态
- 图节点状态与 Inspector 状态一致

---

## N3. Run 主链路闭环加固

### 目标

围绕“启动运行 -> 实时观察 -> Gate -> 结束/失败 -> 重跑”做交互和错误场景收口。

### 重点范围

- `web/src/pages/WorkflowRunPage.tsx`
- `web/src/pages/RunExecutionPage.tsx`
- `web/src/pages/RunsPage.tsx`
- `src/app/services/run-service.ts`
- `src/app/services/run-reuse-service.ts`
- `src/app/services/config-draft-service.ts`

### 子任务

1. 收口输入校验与预运行摘要
2. 收口 Gate 等待与处理后的页面反馈
3. 收口 rerun / rerun-with-edits 的行为边界
4. 统一 run 不存在、draft 不存在、session 失效等异常反馈
5. 优化页面之间的导航与状态衔接

### 建议产出

- 主链路验收清单
- 主链路相关修复
- 关键异常路径处理补齐

### 验收标准

- 用户能稳定完成一次完整运行闭环
- 主链路异常时有清晰反馈
- rerun 系列能力行为可预期

---

## N4. 核心链路测试补强

### 目标

把当前以 service 单测为主的状态，提升到“关键流程可自动回归”。

### 重点范围

- `src/__tests__/`
- `web/tests/`

### 子任务

1. API 路由测试补强
2. SSE 事件链路测试
3. run -> gate -> rerun 集成测试
4. Diagnostics / Comparison / Draft 关键路径测试
5. Web 端最小可执行 smoke/E2E 回归集

### 建议产出

- 测试矩阵
- 一组核心集成测试
- 一组最小端到端回归用例

### 验收标准

- 至少一条完整主链路有自动化覆盖
- 契约变化和主链路回归能被及时发现

---

## N5. Diagnostics 深化

### 目标

让诊断页具备更强的定位能力和行动指引能力。

### 重点范围

- `src/app/services/diagnostics-service.ts`
- `web/src/pages/DiagnosticsPage.tsx`
- `src/app/dto.ts`

### 子任务

1. 补齐 downstream impact 分析
2. 增强错误分类与建议动作
3. 增强失败传播解释
4. 增强与 execution console 的联动
5. 补 diagnostics service 测试

### 建议产出

- 强化后的 diagnostics DTO
- 更实用的 Diagnostics 页面
- 失败传播测试

### 验收标准

- 用户能更快定位失败节点和影响面
- 诊断结果可直接指导下一步动作

---

## N6. Re-run / Recovery 增强

### 目标

让现有 rerun 能力更适合真实调试、复用和后续恢复能力建设。

### 重点范围

- `src/app/services/run-reuse-service.ts`
- `src/app/services/config-draft-service.ts`
- `web/src/pages/WorkflowRunPage.tsx`

### 子任务

1. 明确 reusable config 模型
2. 增强历史输入复用体验
3. 增强 rerun 前差异展示
4. 为节点级恢复预留服务接口
5. 收口 draft 与 rerun 的关系

### 建议产出

- 更清晰的 recovery/reuse 数据模型
- rerun 体验增强版
- 预留接口说明

### 验收标准

- rerun 操作成本下降
- 历史配置复用更自然
- 后续恢复能力不需要大规模返工

---

## N7. Comparison 深化

### 目标

把当前轻量对比做成对调优和复盘真正有价值的能力。

### 重点范围

- `src/app/services/run-compare-service.ts`
- `web/src/pages/RunComparisonPage.tsx`
- `src/app/dto.ts`

### 子任务

1. 增强输入差异可读性
2. 增强关键节点状态与输出差异摘要
3. 增强 token / duration 对比展示
4. 规范 compare session 生命周期
5. 补 compare service 与页面测试

### 建议产出

- 增强版 comparison DTO
- 更实用的 comparison 页面
- compare 测试补齐

### 验收标准

- compare 结果可支持调优决策
- 不再只是基础数据并排展示

---

## N8. 路由层与服务层整理

### 目标

在不打断主链路开发的前提下，控制复杂度继续上升。

### 重点范围

- `src/web/routes.ts`
- `src/app/context.ts`
- `src/app/services/*`

### 子任务

1. 拆分路由注册逻辑
2. 抽公共参数解析与错误处理
3. 清理重复 service 转换逻辑
4. 记录后续是否需要引入轻量框架

### 建议产出

- 路由整理稿
- 若干低风险重构
- 技术债与后续建议

### 验收标准

- 路由文件复杂度下降
- 后续新增接口不再明显加重维护负担

---

## 七、阶段建议

## Phase A：必须收口阶段

- N1 DTO 与 API 契约收口
- N2 SSE 与执行状态一致性加固
- N3 Run 主链路闭环加固
- N4 核心链路测试补强

### 阶段目标

先确保系统“跑得稳、看得准、能回归”。

## Phase B：价值增强阶段

- N5 Diagnostics 深化
- N6 Re-run / Recovery 增强
- N7 Comparison 深化

### 阶段目标

在稳定基础上，提高诊断、复盘和恢复价值。

## Phase C：适度整理阶段

- N8 路由层与服务层整理

### 阶段目标

控制技术债增长，为接下来的两期打底。

---

## 八、建议分配策略

如果多人并行，建议按以下方式拆分：

1. 一人负责 `N1 + N2`
2. 一人负责 `N3 + N6`
3. 一人负责 `N5 + N7`
4. 一人负责 `N4`
5. `N8` 作为伴随式整理任务穿插推进

如果主要由模型协作完成，建议：

- `S` 级任务优先由高能力模型定边界
- `A/B` 级任务在边界明确后并行落地
- 测试任务不要最后再补，至少与 N1-N3 同步推进

---

## 九、本期完成定义

当以下条件同时满足时，可认为“下一期迭代完成”：

1. P0 全部完成
2. 至少完成 2 个 P1 任务
3. 核心链路具备自动化回归能力
4. 执行页状态一致性问题显著减少
5. Diagnostics / rerun / compare 至少有两项达到“真实可用”而非“基础可展示”

---

## 十、与后续两期的衔接

本期任务完成后，后续两期可以更自然地进入：

1. 节点级恢复 / 从失败点继续执行
2. 成本与质量观测
3. workflow 版本与差异分析
4. 更深入的运行复盘能力

因此，本期最重要的价值不是新增多少页面，而是让 OpenAgents 的现有控制台、服务层与流程引擎进入可持续演进状态。

