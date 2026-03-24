# OpenAgents 下一期任务执行卡

> 创建日期：2026-03-24
> 适用范围：下一期迭代 `N1-N8`
> 目标：把规划任务转成可直接分发给模型或开发者的执行单

---

## 一、使用方式

每次分发任务时，不要只引用任务编号。

建议最少一起提供：

1. 本文档中的对应执行卡
2. [API-CONTRACT-SOURCE-OF-TRUTH.md](/Users/zhaiyang/projects/OpenAgents/docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md)
3. [CORE-FLOW-SCENARIO-MATRIX.md](/Users/zhaiyang/projects/OpenAgents/docs/future/CORE-FLOW-SCENARIO-MATRIX.md)
4. [REVIEW-AND-QA-CHECKLIST.md](/Users/zhaiyang/projects/OpenAgents/docs/future/REVIEW-AND-QA-CHECKLIST.md)

---

## 二、统一模板

每次给模型的任务说明建议采用以下结构：

- 任务编号
- 目标
- 非目标
- 允许修改范围
- 禁止修改范围
- 必做测试
- 验收标准
- 输出要求

输出要求建议固定为：

- 修改了哪些文件
- 改了哪些行为
- 补了哪些测试
- 还有哪些风险或未完成项

---

## 三、任务执行卡

## N1. DTO 与 API 契约收口

### 目标

统一后端 DTO、路由返回结构、前端 API 类型和页面消费语义。

### 非目标

- 不新增页面
- 不改变主链路业务含义
- 不为了兼容旧字段而长期保留双字段逻辑

### 允许修改范围

- `src/app/dto.ts`
- `src/web/routes.ts`
- `web/src/api/index.ts`
- `web/src/pages/*`
- `src/__tests__/web-router.test.ts`

### 禁止修改范围

- 不做路由层大迁移
- 不改 workflow engine 核心执行语义

### 必做测试

- route 契约测试
- 关键 DTO 消费页面测试或 smoke 验证

### 验收标准

- 同一实体在前后端不再有明显重复命名
- 页面不再依赖隐式兼容字段
- 错误结构统一且有测试保护

## N2. SSE 与执行状态一致性加固

### 目标

保证执行页在首次加载、事件增量更新、刷新、重连后状态一致。

### 非目标

- 不新增新的执行视图
- 不改动已有事件的大方向业务语义，除非任务卡明确要求

### 允许修改范围

- `src/app/events/*`
- `src/app/services/run-visual-service.ts`
- `src/web/routes.ts`
- `web/src/stores/run-store.ts`
- `web/src/stores/graph-store.ts`
- `web/src/pages/RunExecutionPage.tsx`
- `src/__tests__/run-event-emitter.test.ts`
- `src/__tests__/run-visual-service.test.ts`

### 禁止修改范围

- 不通过增加前端兜底分支掩盖后端事件问题
- 不在多个 store 中重复维护同一状态真源

### 必做测试

- snapshot + 增量事件测试
- 刷新恢复测试
- 断线重连测试

### 验收标准

- 图节点状态与 Inspector 一致
- 刷新后可恢复关键状态
- 重连后不重复、不丢失关键事件

## N3. Run 主链路闭环加固

### 目标

收口“启动运行 -> 实时观察 -> Gate -> 结束/失败 -> 重跑”主链路。

### 非目标

- 不新增新流程入口
- 不修改 workflow engine 核心调度机制

### 允许修改范围

- `web/src/pages/WorkflowRunPage.tsx`
- `web/src/pages/RunExecutionPage.tsx`
- `web/src/pages/RunsPage.tsx`
- `src/app/services/run-service.ts`
- `src/app/services/run-reuse-service.ts`
- `src/app/services/config-draft-service.ts`
- 相关测试文件

### 禁止修改范围

- 不把异常处理做成大量页面特判
- 不绕开既有 run / draft / compare session 模型

### 必做测试

- run 创建与异常反馈测试
- gate 等待与处理测试
- rerun / rerun-with-edits 测试

### 验收标准

- 用户能稳定完成一次主链路
- 各类对象不存在时有统一反馈
- rerun 行为边界清楚且可预期

## N4. 核心链路测试补强

### 目标

让主链路具备自动化回归能力。

### 非目标

- 不追求一次补全所有页面的全量 E2E

### 允许修改范围

- `src/__tests__/`
- `web/tests/`
- 与测试相关的少量辅助代码

### 禁止修改范围

- 不为了让测试通过而弱化真实行为
- 不引入高维护成本的脆弱快照测试

### 必做测试

- API 路由测试
- run -> gate -> rerun 集成测试
- 最小 smoke / E2E

### 验收标准

- 至少一条完整主链路自动化可回归
- 契约变化会触发失败而非静默通过

## N5. Diagnostics 深化

### 目标

让 diagnostics 真正支持定位和下一步行动。

### 非目标

- 不只做页面美化
- 不新增无明确语义的“智能建议”

### 允许修改范围

- `src/app/services/diagnostics-service.ts`
- `src/app/dto.ts`
- `web/src/pages/DiagnosticsPage.tsx`
- 相关测试

### 禁止修改范围

- 不返回无法解释来源的诊断字段

### 必做测试

- failed node / downstream impact 测试
- 失败传播分析测试

### 验收标准

- 用户能看到失败点、影响面和建议动作
- 诊断结果能直接支持后续恢复或 rerun

## N6. Re-run / Recovery 增强

### 目标

提升 rerun 的复用效率，并为后续节点级恢复预留结构。

### 非目标

- 本期不直接实现完整节点级恢复

### 允许修改范围

- `src/app/services/run-reuse-service.ts`
- `src/app/services/config-draft-service.ts`
- `web/src/pages/WorkflowRunPage.tsx`
- 相关测试

### 禁止修改范围

- 不引入与现有 draft 模型并行的第三套配置模型

### 必做测试

- reusable config 测试
- rerun payload 差异测试
- draft 与 rerun 关系测试

### 验收标准

- 历史配置复用自然
- rerun 前差异和风险可理解
- 为后续恢复能力保留清晰接口

## N7. Comparison 深化

### 目标

让 compare 可支持调优与复盘决策。

### 非目标

- 不只是堆更多字段并排展示

### 允许修改范围

- `src/app/services/run-compare-service.ts`
- `src/app/dto.ts`
- `web/src/pages/RunComparisonPage.tsx`
- 相关测试

### 禁止修改范围

- 不返回没有语义解释的“分数化”字段

### 必做测试

- compare service 测试
- 页面差异摘要展示测试

### 验收标准

- 输入差异、关键节点差异、输出差异更可读
- compare session 生命周期清晰

## N8. 路由层与服务层整理

### 目标

控制复杂度上升，但不打断主链路。

### 非目标

- 不做高风险框架迁移
- 不大规模改动对外行为

### 允许修改范围

- `src/web/routes.ts`
- `src/app/context.ts`
- `src/app/services/*`
- 少量相关测试

### 禁止修改范围

- 不在本任务中顺带重写整个 Web server 组织方式

### 必做测试

- 路由注册和错误处理的回归测试

### 验收标准

- 路由复杂度下降
- 新增接口的维护成本不继续明显恶化
