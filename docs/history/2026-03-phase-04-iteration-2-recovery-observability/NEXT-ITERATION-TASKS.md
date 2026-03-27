# OpenAgents 下一期迭代任务拆解

> 创建日期：2026-03-24
> 对应文档：`docs/future/NEXT-ITERATION-PLAN.md`
> 适用阶段：下一期“恢复与观测”迭代

---

## 一、文档目的

本文档用于把下一期迭代计划进一步拆成可执行任务，便于：

- 做排期
- 做依赖管理
- 分配给不同模型或不同开发者
- 作为阶段验收依据

本次拆分强调以下原则：

1. 恢复主链路优先
2. 统计口径优先
3. 跨层闭环优先
4. 测试同步优先

---

## 二、优先级定义

| 优先级 | 含义 |
|------|------|
| `P0` | 必须完成，否则本期“恢复与观测”目标不成立 |
| `P1` | 强烈建议完成，能显著提升现有能力的真实价值 |
| `P2` | 可伴随推进，用于控制技术债与后续成本 |

---

## 三、难度定义

| 等级 | 含义 |
|------|------|
| `S` | 涉及恢复语义、跨层状态、聚合口径、较高联调风险 |
| `A` | 中高复杂度业务闭环，涉及多个模块 |
| `B` | 标准页面/API/测试增强任务 |
| `C` | 收尾、整理、文档、低风险增强 |

---

## 四、推荐开发顺序

建议按以下顺序推进：

1. `M1` 节点级恢复语义与 DTO/API 定义
2. `M2` 恢复执行链路落地
3. `M3` 恢复预览与风险提示
4. `M4` 恢复链路测试补强
5. `M5` 成本观测能力
6. `M6` 质量观测能力
7. `M7` 统计与聚合层整理

关键路径如下：

```text
M1 -> M2 -> M3 -> M4
  \-> M5
  \-> M6
M7 可伴随进行，但不应阻塞恢复主链路
```

---

## 五、任务总表

| 编号 | 名称 | 优先级 | 难度 | 依赖 |
|------|------|------|------|------|
| M1 | 节点级恢复语义与契约定义 | P0 | S | 无 |
| M2 | 恢复执行链路落地 | P0 | S | M1 |
| M3 | 恢复预览与风险提示 | P0 | A | M1, M2 |
| M4 | 恢复链路测试补强 | P0 | A | M1, M2, M3 |
| M5 | 成本观测能力 | P1 | A | M1 |
| M6 | 质量观测能力 | P1 | A | M1 |
| M7 | 统计与聚合层适度整理 | P2 | B | M1, M5, M6 |

---

## 六、详细任务拆解

## M1. 节点级恢复语义与契约定义

### 目标

先定义清楚恢复能力的边界、请求结构、结果结构和与 rerun 的关系，避免后续实现阶段出现语义漂移。

### 重点范围

- `src/app/dto.ts`
- `src/web/routes.ts`
- `web/src/api/index.ts`
- `src/app/services/run-reuse-service.ts`
- `src/app/services/diagnostics-service.ts`

### 子任务

1. 定义 recovery request / preview / response DTO
2. 明确 recover、rerun、rerun-with-edits 的边界
3. 定义“复用节点 / 重跑节点 / 失效节点”的统一表达
4. 定义 source run / recovery source / recovered run 的关联字段
5. 补关键契约测试

### 建议产出

- Recovery DTO 契约表
- 恢复语义说明
- 契约测试

### 验收标准

- 恢复行为边界清楚
- 前后端不再各自推断恢复含义
- 路由契约有测试保护

---

## M2. 恢复执行链路落地

### 目标

把节点级恢复从定义推进到真实可执行路径。

### 重点范围

- `src/app/services/run-reuse-service.ts`
- `src/app/services/run-service.ts`
- `src/app/context.ts`
- `src/web/routes.ts`
- `web/src/pages/WorkflowRunPage.tsx`
- `web/src/pages/RunExecutionPage.tsx`

### 子任务

1. 支持从失败节点或指定节点发起恢复
2. 根据依赖关系推导重跑范围
3. 支持恢复时保留/复用已有上下文信息
4. 在 run 详情和执行页中标记 recovered run
5. 收口恢复后导航与状态衔接

### 建议产出

- 恢复执行链路实现
- 恢复路径页面入口
- 主链路集成测试

### 验收标准

- 用户可以从失败 run 发起节点级恢复
- 恢复后的 run 可被追踪
- 恢复主链路异常时有清晰反馈

---

## M3. 恢复预览与风险提示

### 目标

让恢复动作在执行前可被解释和确认。

### 重点范围

- `src/app/services/run-reuse-service.ts`
- `src/app/services/diagnostics-service.ts`
- `src/web/routes.ts`
- `web/src/pages/WorkflowRunPage.tsx`
- `web/src/pages/DiagnosticsPage.tsx`
- `web/src/pages/RunComparisonPage.tsx`

### 子任务

1. 展示本次恢复将复用的节点
2. 展示本次恢复将重跑的节点
3. 展示下游输出失效或重新生成风险
4. 对 gate / eval / failed downstream 提供额外提示
5. 统一 rerun / rerun-with-edits / recover 的 preview 体验

### 建议产出

- Recovery Preview API
- 页面预览卡片或确认面板
- 风险提示文案和测试

### 验收标准

- 用户恢复前能看见影响范围
- preview 与真实恢复结果一致
- diagnostics 可直接引导恢复动作

---

## M4. 恢复链路测试补强

### 目标

建立恢复主链路的自动化保护，避免后续迭代把恢复能力做成脆弱补丁。

### 重点范围

- `src/__tests__/`
- `web/tests/`

### 子任务

1. recovery 路由测试
2. recovery preview 契约测试
3. failed run -> diagnostics -> recover 集成测试
4. recover 后 run 标识与导航测试
5. 最小 smoke / E2E 恢复链路回归

### 建议产出

- 恢复链路测试矩阵
- 一组恢复集成测试
- 一组页面级 smoke 用例

### 验收标准

- 至少一条恢复主链路有自动化覆盖
- 恢复范围和 preview 一致性可被及时发现回归

---

## M5. 成本观测能力

### 目标

建立 step / run / workflow 三层基础成本观测能力。

### 重点范围

- `src/app/dto.ts`
- `src/app/services/run-service.ts`
- `src/app/services/run-compare-service.ts`
- `src/web/routes.ts`
- `web/src/pages/RunDetailPage.tsx`
- `web/src/pages/RunComparisonPage.tsx`
- `web/src/pages/HomePage.tsx`

### 子任务

1. 统一 tokenUsage 与 duration 聚合口径
2. 提供高耗时、高 token 节点摘要
3. 在 run detail / comparison 中补充成本视角
4. 在 workflow 或首页提供最近运行成本摘要
5. 补成本统计测试

### 建议产出

- 成本观测 DTO
- 成本摘要面板
- 成本聚合测试

### 验收标准

- 用户能识别“哪里慢”“哪里贵”
- comparison 可看到成本差异
- 统计口径在不同页面一致

---

## M6. 质量观测能力

### 目标

建立 workflow 级质量聚合与质量概览能力。

### 重点范围

- `src/app/dto.ts`
- `src/app/services/diagnostics-service.ts`
- `src/web/routes.ts`
- `web/src/pages/HomePage.tsx`
- `web/src/pages/DiagnosticsPage.tsx`
- `web/src/pages/RunsPage.tsx`

### 子任务

1. 聚合 workflow 成功率 / 失败率
2. 聚合 gate 等待频次
3. 聚合失败类型分布
4. 聚合最近运行 eval 摘要
5. 在首页或 diagnostics 中展示质量概览

### 建议产出

- 质量观测 DTO
- 质量概览卡片或摘要区
- 质量统计测试

### 验收标准

- 用户能快速判断某个 workflow 是否健康
- 失败和 gate 问题具备基础分布视图
- 为趋势分析预留稳定字段

---

## M7. 统计与聚合层适度整理

### 目标

适度整理恢复、成本、质量相关聚合逻辑，为第三期趋势分析做结构预留。

### 重点范围

- `src/app/services/*`
- `src/app/dto.ts`
- `src/web/routes.ts`

### 子任务

1. 收敛重复聚合逻辑
2. 统一 workflow metrics / run metrics 入口
3. 清理临时兼容字段
4. 补充统计口径说明
5. 补必要的低风险回归测试

### 建议产出

- 轻量聚合层整理
- 统计口径说明文档
- 低风险结构回归测试

### 验收标准

- 聚合逻辑不再分散在多个页面和服务里
- 统计字段含义更清晰
- 第三期趋势能力不需要重新大面积返工

