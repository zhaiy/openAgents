# OpenAgents 下一期模型开发提示词

> 创建日期：2026-03-24
> 适用范围：下一期迭代 `M1-M7`
> 目标：为 `gpt-5.3-codex`、`GLM-5`、`Kimi K2.5`、`qwen3.5`、`minimax m2.7` 或更强模型提供可直接执行的开发提示词

---

## 一、使用说明

本文档用于直接向模型下发下一期“恢复与观测”相关任务。

建议使用顺序：

1. 先发送“通用总控提示词”
2. 再发送对应任务的“专项提示词”
3. 如任务涉及恢复语义、依赖范围、主链路，附上任务拆解文档
4. 如任务涉及成本与质量统计，附上迭代计划文档
5. 完成后按交付要求审查

建议配套文档：

- `docs/future/NEXT-ITERATION-PLAN.md`
- `docs/future/NEXT-ITERATION-TASKS.md`
- `docs/future/THREE-ITERATIONS-ROADMAP.md`

---

## 二、通用总控提示词

以下提示词建议在每次正式分发前先发送一次。

### 通用总控提示词

```text
你现在要在 OpenAgents 项目中完成一个有明确边界的迭代任务。

本期主题是：恢复与观测。

你的目标不是自由发挥，而是在既有规划内稳定落地。

请严格遵守以下要求：

1. 先阅读并遵守以下文档：
   - docs/future/NEXT-ITERATION-PLAN.md
   - docs/future/NEXT-ITERATION-TASKS.md
   - docs/future/THREE-ITERATIONS-ROADMAP.md

2. 本次任务必须遵守这些原则：
   - 不新增未约定的新主流程
   - 不擅自改变现有 run / rerun 主链路核心语义
   - 不做大规模重构
   - 不通过新增兼容字段或页面特判掩盖恢复语义或统计口径问题
   - 先定义恢复边界和统计口径，再做展示层收口
   - 测试必须与实现同步提交

3. 修改前先说明：
   - 你理解的任务目标
   - 你准备修改的文件
   - 哪些内容明确不在本次范围内

4. 如果你发现以下任一情况，不要硬做，请明确停下并说明：
   - 需要重新定义 recovery / rerun / reusable config 的系统级边界
   - 需要决定流程引擎核心调度机制是否支持节点恢复
   - 需要重新设计统计系统而不是局部增强
   - 任务说明与现有代码现实明显冲突

5. 完成后必须输出：
   - 修改摘要
   - 修改文件列表
   - 新增或更新的测试
   - 剩余风险
   - 是否建议升级到更强模型继续处理

如果你明白，请先复述你的执行边界，再开始动手。
```

---

## 三、模型分工建议

### 更适合 `gpt-5.3-codex` 的任务

- recovery 语义边界定义
- 恢复链路的跨层契约设计
- 成本 / 质量聚合口径定稿
- 多服务协同修改
- 低风险结构整理

### 更适合 `GLM-5` 的任务

- service 层增强
- DTO / route / 前端类型跨层同步
- recovery preview / metrics 聚合实现
- route / integration 测试补强

### 更适合 `Kimi K2.5` 的任务

- 页面收口
- 恢复预览与风险提示交互
- 成本与质量摘要面板
- 文案、空态、异常态收口
- smoke / E2E / 页面行为测试补充

### 更适合 `qwen3.5` 的任务

- 页面收口
- 异常态与空态处理
- 基础 API 消费层同步
- smoke / E2E / 基础测试补充

### 更适合 `minimax m2.7` 的任务

- service 层增强
- DTO / route / 前端类型同步
- 中复杂度聚合逻辑
- route / service 测试

### 不建议直接交给中等模型独立主导的任务

- `M1` 的恢复语义最终定稿
- `M2` 的恢复执行链路系统级边界
- `M7` 的统计与聚合层整理方案

---

## 四、任务提示词

## Prompt A：M1 节点级恢复语义与契约定义

### 建议模型

- 主推：`gpt-5.3-codex` 或同级更强模型
- 可配合：`GLM-5`
- 不建议：`qwen3.5` 独立主导

### 提示词

```text
请在 OpenAgents 项目中完成 M1：节点级恢复语义与契约定义。

先阅读以下文档：
- docs/future/NEXT-ITERATION-PLAN.md
- docs/future/NEXT-ITERATION-TASKS.md
- docs/future/THREE-ITERATIONS-ROADMAP.md

任务目标：
- 定义 recovery request / preview / response 的稳定契约
- 明确 recover、rerun、rerun-with-edits 三者边界
- 统一“复用节点 / 重跑节点 / 失效节点”的表达
- 明确 recovered run 与 source run 的关联关系

允许重点修改：
- src/app/dto.ts
- src/web/routes.ts
- web/src/api/index.ts
- src/app/services/run-reuse-service.ts
- src/app/services/diagnostics-service.ts
- 相关测试文件

明确禁止：
- 不直接扩散到大范围页面重构
- 不在契约未定义清楚前先做大量 UI 表达
- 不保留长期模糊兼容字段

请按以下顺序工作：
1. 先列出当前恢复相关数据模型有哪些不清楚的边界
2. 给出 recover / rerun / rerun-with-edits 的最终职责划分
3. 设计最小必要 DTO 和 route 契约
4. 实施最小必要修改
5. 补关键 contract / route 测试

交付要求：
- 输出 recovery 相关 DTO 清单
- 输出 recover 与 rerun 的边界说明
- 输出哪些字段是新引入的
- 输出新增测试
- 输出仍然需要更强模型决策的系统级问题

如果你发现当前代码无法支持节点级恢复语义，请明确停下并说明核心阻塞点。
```

---

## Prompt B：M2 恢复执行链路落地

### 建议模型

- 主推：`gpt-5.3-codex` 定边界后，`GLM-5` 落地
- 可配合：`Kimi K2.5`

### 提示词

```text
请在 OpenAgents 项目中完成 M2：恢复执行链路落地。

先阅读以下文档：
- docs/future/NEXT-ITERATION-PLAN.md
- docs/future/NEXT-ITERATION-TASKS.md
- docs/future/THREE-ITERATIONS-ROADMAP.md

任务目标：
- 把节点级恢复从契约推进到可执行主链路
- 支持从失败节点或指定节点发起恢复
- 基于依赖关系推导重跑范围
- 让 recovered run 可追踪、可解释

允许重点修改：
- src/app/services/run-reuse-service.ts
- src/app/services/run-service.ts
- src/app/context.ts
- src/web/routes.ts
- web/src/pages/WorkflowRunPage.tsx
- web/src/pages/RunExecutionPage.tsx
- 相关测试文件

明确禁止：
- 不修改 workflow engine 核心调度机制
- 不新增全新运行入口
- 不把恢复逻辑做成不可解释的页面特判

请按以下顺序工作：
1. 对照 M1 契约，确认恢复执行链路的最小闭环
2. 落地恢复请求到新 run 的转换逻辑
3. 明确恢复后 run 的标记和导航
4. 补异常反馈和测试

重点验收：
- 用户可以从失败 run 发起恢复
- 恢复后的 run 与原 run 的关系清晰
- 恢复失败时有统一反馈

交付要求：
- 说明恢复执行链路如何工作
- 说明哪些节点会被重跑、哪些会被复用
- 说明 recovered run 如何标识
- 说明新增测试
```

---

## Prompt C：M3 恢复预览与风险提示

### 建议模型

- 主推：`GLM-5`
- 可配合：`Kimi K2.5`

### 提示词

```text
请在 OpenAgents 项目中完成 M3：恢复预览与风险提示。

先阅读以下文档：
- docs/future/NEXT-ITERATION-PLAN.md
- docs/future/NEXT-ITERATION-TASKS.md
- docs/future/THREE-ITERATIONS-ROADMAP.md

任务目标：
- 让恢复动作在执行前具备 preview 与风险提示
- 让 diagnostics、rerun、recovery 三类入口有一致的说明方式
- 显示复用范围、重跑范围、下游失效风险

允许重点修改：
- src/app/services/run-reuse-service.ts
- src/app/services/diagnostics-service.ts
- src/web/routes.ts
- web/src/pages/WorkflowRunPage.tsx
- web/src/pages/DiagnosticsPage.tsx
- web/src/pages/RunComparisonPage.tsx
- 相关测试文件

明确禁止：
- 不做只展示不可信的数据
- 不返回没有计算依据的风险提示
- 不新增独立新页面

请按以下顺序工作：
1. 明确恢复 preview 需要表达哪些最关键的信息
2. 先做 DTO / service / route
3. 再做页面上的确认和风险提示
4. 补预览与真实行为一致性的测试

交付要求：
- 输出 preview 返回了哪些信息
- 输出风险提示如何得出
- 输出页面如何帮助用户做决策
- 输出新增测试
```

---

## Prompt D：M4 恢复链路测试补强

### 建议模型

- 主推：`GLM-5`
- 可配合：`Kimi K2.5` 或 `qwen3.5`

### 提示词

```text
请在 OpenAgents 项目中完成 M4：恢复链路测试补强。

先阅读以下文档：
- docs/future/NEXT-ITERATION-PLAN.md
- docs/future/NEXT-ITERATION-TASKS.md
- docs/future/THREE-ITERATIONS-ROADMAP.md

任务目标：
- 让 recovery 主链路具备自动化回归能力
- 覆盖 route、integration、最小 smoke / E2E

允许重点修改：
- src/__tests__/*
- web/tests/*
- 少量测试辅助代码

明确禁止：
- 不为了测试通过而弱化真实行为
- 不引入高维护成本的脆弱测试
- 不做与当前任务无关的大量产品逻辑改动

请按以下顺序工作：
1. 列出恢复链路当前最缺的自动化覆盖
2. 优先补 recovery request / preview / run relation / failure handling
3. 尽量复用已有测试模式
4. 保持测试可读、可维护、可稳定运行

交付要求：
- 输出新增测试清单
- 说明每个测试覆盖了哪个恢复场景
- 说明还有哪些高风险空白没有覆盖
- 如果某些测试当前无法稳定实现，请明确原因
```

---

## Prompt E：M5 成本观测能力

### 建议模型

- 主推：`GLM-5`
- 可配合：`Kimi K2.5`

### 提示词

```text
请在 OpenAgents 项目中完成 M5：成本观测能力。

先阅读以下文档：
- docs/future/NEXT-ITERATION-PLAN.md
- docs/future/NEXT-ITERATION-TASKS.md
- docs/future/THREE-ITERATIONS-ROADMAP.md

任务目标：
- 建立 step / run / workflow 三层基础成本观测能力
- 统一 tokenUsage 与 duration 聚合口径
- 支持定位高耗时、高 token 节点

允许重点修改：
- src/app/dto.ts
- src/app/services/run-service.ts
- src/app/services/run-compare-service.ts
- src/web/routes.ts
- web/src/pages/RunDetailPage.tsx
- web/src/pages/RunComparisonPage.tsx
- web/src/pages/HomePage.tsx
- 相关测试文件

明确禁止：
- 不只是把字段展示得更多
- 不引入没有统一口径的成本数字
- 不在多个页面各算一套不同统计

请按以下顺序工作：
1. 梳理当前 token / duration 数据在哪些层可得
2. 定义本次统一聚合口径
3. 实施 DTO / service / route 增强
4. 更新页面摘要
5. 补成本统计测试

交付要求：
- 说明成本观测新增了哪些信息
- 说明这些信息如何聚合得出
- 说明页面如何帮助用户识别高成本节点
- 说明新增测试
```

---

## Prompt F：M6 质量观测能力

### 建议模型

- 主推：`GLM-5`
- 可配合：`Kimi K2.5`

### 提示词

```text
请在 OpenAgents 项目中完成 M6：质量观测能力。

先阅读以下文档：
- docs/future/NEXT-ITERATION-PLAN.md
- docs/future/NEXT-ITERATION-TASKS.md
- docs/future/THREE-ITERATIONS-ROADMAP.md

任务目标：
- 建立 workflow 级成功率、失败率、gate 等待、失败类型、eval 摘要等质量指标
- 让首页或 diagnostics 页面能展示基础质量概览

允许重点修改：
- src/app/dto.ts
- src/app/services/diagnostics-service.ts
- src/web/routes.ts
- web/src/pages/HomePage.tsx
- web/src/pages/DiagnosticsPage.tsx
- web/src/pages/RunsPage.tsx
- 相关测试文件

明确禁止：
- 不返回没有来源的“质量分数”
- 不只做页面展示而不统一统计口径
- 不把趋势分析提前做成重功能

请按以下顺序工作：
1. 明确本期质量指标最小集合
2. 实施 service / DTO / route 聚合
3. 更新页面概览区
4. 补质量统计测试

交付要求：
- 说明新增了哪些质量指标
- 说明统计口径如何定义
- 说明页面如何帮助用户判断 workflow 健康度
- 说明新增测试
```

---

## Prompt G：M7 统计与聚合层适度整理

### 建议模型

- 主推：`gpt-5.3-codex` 或同级更强模型
- 不建议：`qwen3.5` 或 `minimax m2.7` 独立主导

### 提示词

```text
请在 OpenAgents 项目中完成 M7：统计与聚合层适度整理。

先阅读以下文档：
- docs/future/NEXT-ITERATION-PLAN.md
- docs/future/NEXT-ITERATION-TASKS.md
- docs/future/THREE-ITERATIONS-ROADMAP.md

任务目标：
- 收敛恢复、成本、质量相关聚合逻辑
- 为第三期趋势分析预留统一入口
- 在不做大迁移的前提下控制复杂度增长

允许重点修改：
- src/app/services/*
- src/app/dto.ts
- src/web/routes.ts
- 相关测试文件

明确禁止：
- 不做大规模目录重构
- 不为了“看起来更整洁”而改动大量稳定逻辑
- 不破坏上一期已经稳定的主链路

请按以下顺序工作：
1. 列出当前重复或分散的聚合逻辑
2. 设计最小必要的收敛方案
3. 做低风险整理
4. 补回归测试

交付要求：
- 说明聚合逻辑收敛到了哪里
- 说明哪些重复逻辑被消除
- 说明这样整理后对第三期有什么帮助
- 说明新增测试与剩余风险
```

