# OpenAgents 下一期模型开发提示词

> 创建日期：2026-03-24
> 适用范围：下一期迭代 `N1-N8`
> 目标：为 `gpt-5.3-codex`、`GLM-5`、`Kimi K2.5`、`qwen3.5`、`minimax m2.7` 或更强模型提供可直接执行的开发提示词

---

## 一、使用说明

本文档用于直接向模型下发开发任务。

建议使用顺序：

1. 先发送“通用总控提示词”
2. 再发送对应任务的“专项提示词”
3. 如任务涉及 DTO / API / SSE，附上契约真源文档
4. 如任务涉及主链路，附上场景矩阵
5. 完成后按质检清单审查

建议配套文档：

- `docs/future/TASK-EXECUTION-CARDS.md`
- `docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md`
- `docs/future/CORE-FLOW-SCENARIO-MATRIX.md`
- `docs/future/REVIEW-AND-QA-CHECKLIST.md`
- `docs/future/MODEL-DELIVERY-GUIDE.md`

---

## 二、通用总控提示词

以下提示词建议在每次正式分发前先发送一次。

### 通用总控提示词

```text
你现在要在 OpenAgents 项目中完成一个有明确边界的迭代任务。

你的目标不是自由发挥，而是在既有规划内稳定落地。

请严格遵守以下要求：

1. 先阅读并遵守以下文档：
   - docs/future/TASK-EXECUTION-CARDS.md
   - docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md
   - docs/future/CORE-FLOW-SCENARIO-MATRIX.md
   - docs/future/REVIEW-AND-QA-CHECKLIST.md
   - docs/future/MODEL-DELIVERY-GUIDE.md

2. 本次任务必须遵守这些原则：
   - 不新增未约定页面或新主流程
   - 不擅自改变主链路行为语义
   - 不做大规模重构
   - 不通过新增兼容字段或页面特判掩盖根因
   - 先解决契约和状态问题，再做展示层收口
   - 测试必须与实现同步提交

3. 修改前先说明：
   - 你理解的任务目标
   - 你准备修改的文件
   - 哪些内容明确不在本次范围内

4. 如果你发现以下任一情况，不要硬做，请明确停下并说明：
   - 需要重新定义 DTO / API / SSE 的系统级边界
   - 需要决定 snapshot / event patch / reconnect 的核心语义
   - 需要大范围重排 store 或路由架构
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

- 系统级边界定义
- 跨层契约收口
- SSE / store / route / service 协同修改
- 主链路行为收口
- 低风险结构整理

### 更适合 `GLM-5` 的任务

- service 层增强
- DTO / route / 前端类型跨层同步
- diagnostics / compare / rerun 数据结构增强
- route / integration 测试补强

### 更适合 `Kimi K2.5` 的任务

- 页面收口
- 前端交互与展示增强
- 可视化体验增强
- 文案、空态、异常态收口
- smoke / E2E / 页面行为测试补充

### 更适合 `qwen3.5` 的任务

- 页面收口
- 异常态收口
- 文案与交互反馈统一
- smoke / E2E / 基础测试补充
- 在边界已明确情况下同步前端 API 消费层

### 更适合 `minimax m2.7` 的任务

- service 层增强
- DTO / route / 前端类型跨层同步
- diagnostics / compare / rerun 数据结构增强
- 中复杂度 route / integration 测试

### 不建议直接交给中等模型独立主导的任务

- `N1` 的最终契约定稿
- `N2` 的 SSE 核心一致性机制设计
- `N3` 的主链路系统级行为边界定义
- `N8` 的结构性整理

---

## 四、任务提示词

## Prompt A：N1 DTO 与 API 契约收口

### 建议模型

- 主推：`gpt-5.3-codex` 或同级更强模型
- 可配合：`GLM-5`
- 不建议：`qwen3.5` 独立主导

### 提示词

```text
请在 OpenAgents 项目中完成 N1：DTO 与 API 契约收口。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md

任务目标：
- 统一后端 DTO、路由返回结构、前端 API 类型定义和页面真实消费方式
- 收口 Run Summary / Run Detail / Visual State / Timeline 的字段语义
- 统一时间字段策略
- 统一错误响应结构
- 清理前端隐式兼容逻辑

允许重点修改：
- src/app/dto.ts
- src/web/routes.ts
- web/src/api/index.ts
- web/src/pages/*
- src/__tests__/web-router.test.ts

明确禁止：
- 不新增页面
- 不进行路由层大迁移
- 不保留长期双字段兼容逻辑
- 不用前端兜底去掩盖后端契约漂移

请按以下顺序工作：
1. 先列出当前你识别到的主要 DTO / API 语义漂移点
2. 给出本次要统一的字段命名和错误结构方案
3. 实施最小必要修改
4. 补充关键 route / contract 测试
5. 检查页面是否仍依赖隐式兼容字段

交付要求：
- 输出本次统一了哪些 DTO
- 输出哪些字段被改名、删除或收口
- 输出错误结构最终形式
- 输出补了哪些测试
- 输出还有哪些潜在漂移没有处理

如果你发现需要先重新定义整个契约体系而不是局部收口，请停止修改并明确说明原因。
```

---

## Prompt B：N2 SSE 与执行状态一致性加固

### 建议模型

- 主推：`gpt-5.3-codex` 或同级更强模型
- 可配合：`GLM-5`
- 不建议：`qwen3.5` 独立主导

### 提示词

```text
请在 OpenAgents 项目中完成 N2：SSE 与执行状态一致性加固。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md
- docs/future/CORE-FLOW-SCENARIO-MATRIX.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md

任务目标：
- 保证 Run Execution 相关状态在首次加载、事件增量更新、刷新、重连后保持一致
- 收口 snapshot 与 event patch 边界
- 收口 sequence / lastEventId / reconnect 逻辑
- 避免 run-store 与 graph-store 双写漂移

允许重点修改：
- src/app/events/*
- src/app/services/run-visual-service.ts
- src/web/routes.ts
- web/src/stores/run-store.ts
- web/src/stores/graph-store.ts
- web/src/pages/RunExecutionPage.tsx
- src/__tests__/run-event-emitter.test.ts
- src/__tests__/run-visual-service.test.ts

明确禁止：
- 不通过前端兼容逻辑掩盖事件真源问题
- 不在多个 store 中同时维护同一核心状态真源
- 不擅自新增全新的执行页状态模型

请按以下顺序工作：
1. 先梳理当前 snapshot、增量事件、页面恢复之间的状态流
2. 找出导致刷新恢复、重连恢复不稳定的主要根因
3. 定义本次修改后的状态来源边界
4. 做最小必要实现
5. 补充刷新恢复、断线重连、事件顺序相关测试

重点验收：
- 执行页刷新后可恢复
- 重连后不会重复或丢失关键状态
- 图节点状态与 Inspector 状态一致

交付要求：
- 说明 visual state 的单一真源是什么
- 说明 run-store 与 graph-store 各自职责
- 说明 sequence / reconnect 的最终处理方式
- 说明新增了哪些测试覆盖 S9 / S10 场景

如果你发现需要先做系统级事件语义重构，请先停下来说明，不要直接扩散修改范围。
```

---

## Prompt C：N3 Run 主链路闭环加固

### 建议模型

- 主推：`gpt-5.3-codex` 定边界后，`GLM-5` 或 `Kimi K2.5` 分子任务落地

### 提示词

```text
请在 OpenAgents 项目中完成 N3：Run 主链路闭环加固。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/CORE-FLOW-SCENARIO-MATRIX.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md

任务目标：
- 收口 启动运行 -> 实时观察 -> Gate -> 结束/失败 -> 重跑 主链路
- 统一输入校验、预运行摘要、Gate 反馈、rerun 行为边界、异常对象缺失反馈

允许重点修改：
- web/src/pages/WorkflowRunPage.tsx
- web/src/pages/RunExecutionPage.tsx
- web/src/pages/RunsPage.tsx
- src/app/services/run-service.ts
- src/app/services/run-reuse-service.ts
- src/app/services/config-draft-service.ts
- 相关测试文件

明确禁止：
- 不新增新的运行入口或新页面
- 不修改 workflow engine 核心调度机制
- 不把异常流做成大量页面特判

请按以下顺序工作：
1. 对照场景矩阵，确认 S1-S5、S7-S14 哪些场景目前不完整
2. 优先收口输入校验与启动反馈
3. 收口 Gate waiting / resolved 交互反馈
4. 收口 rerun / rerun-with-edits 边界
5. 统一 run / draft / compare session 不存在时的反馈
6. 补对应测试

重点验收：
- 用户能稳定走完一次主链路
- 异常对象缺失时有统一反馈
- rerun 系列行为可预期

交付要求：
- 说明你补齐了哪些主链路场景
- 说明各类异常反馈如何统一
- 说明新增了哪些测试
- 说明仍未覆盖的场景

如果你发现当前代码缺少清晰的主链路行为定义，请先列出冲突点，再决定是否继续修改。
```

---

## Prompt D：N4 核心链路测试补强

### 建议模型

- 主推：`GLM-5`
- 可配合：`Kimi K2.5` 或 `qwen3.5`

### 提示词

```text
请在 OpenAgents 项目中完成 N4：核心链路测试补强。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/CORE-FLOW-SCENARIO-MATRIX.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md

任务目标：
- 让核心主链路具备自动化回归能力
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
1. 基于场景矩阵列出当前最缺的自动化覆盖
2. 优先补 S1-S5、S7-S10、S11-S14 的关键回归用例
3. 尽量复用已有测试模式
4. 保持测试可读、可维护、可稳定运行

交付要求：
- 输出新增测试清单
- 说明每个测试对应覆盖了哪些场景
- 说明还有哪些高风险空白没有覆盖
- 如果某些测试当前无法稳定实现，请明确原因
```

---

## Prompt E：N5 Diagnostics 深化

### 建议模型

- 主推：`GLM-5`
- 可配合：`Kimi K2.5`

### 提示词

```text
请在 OpenAgents 项目中完成 N5：Diagnostics 深化。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md
- docs/future/CORE-FLOW-SCENARIO-MATRIX.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md

任务目标：
- 让 diagnostics 从失败摘要升级为可定位、可行动的诊断能力
- 补齐 failed node、downstream impact、失败传播解释、推荐动作

允许重点修改：
- src/app/services/diagnostics-service.ts
- src/app/dto.ts
- web/src/pages/DiagnosticsPage.tsx
- 相关测试文件

明确禁止：
- 不新增无法解释来源的诊断字段
- 不只做页面展示增强而不增强语义

请按以下顺序工作：
1. 梳理当前 diagnostics 返回了什么、缺了什么
2. 明确 failed node、downstream impact、recommended actions 的语义
3. 实施 service + DTO 增强
4. 更新页面展示
5. 补失败传播与影响面测试

交付要求：
- 说明新增了哪些 diagnostics 字段
- 说明这些字段如何得出
- 说明页面如何帮助用户采取下一步动作
- 说明测试覆盖了哪些失败链路
```

---

## Prompt F：N6 Re-run / Recovery 增强

### 建议模型

- 主推：`gpt-5.3-codex` 或 `GLM-5`
- 可配合：`Kimi K2.5`

### 提示词

```text
请在 OpenAgents 项目中完成 N6：Re-run / Recovery 增强。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md
- docs/future/CORE-FLOW-SCENARIO-MATRIX.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md

任务目标：
- 提升 rerun 的复用效率
- 收口 reusable config、draft、historical config、rerun payload 关系
- 为后续节点级恢复预留接口

允许重点修改：
- src/app/services/run-reuse-service.ts
- src/app/services/config-draft-service.ts
- web/src/pages/WorkflowRunPage.tsx
- 相关测试文件

明确禁止：
- 本期不直接实现完整节点级恢复
- 不再引入第三套配置模型
- 不让 rerun 依赖不可解释的隐式历史状态

请按以下顺序工作：
1. 梳理 reusable config、draft、rerun payload 当前关系
2. 明确本次保留的数据模型边界
3. 增强历史输入复用与 rerun 前差异展示
4. 为 recovery 预留清晰接口
5. 补对应测试

交付要求：
- 说明最终的数据模型关系
- 说明 rerun 前用户能看到哪些差异或风险
- 说明 recovery 预留接口的边界
- 说明新增测试

如果你发现当前 rerun 语义本身不清楚，请先列出冲突点，不要直接补丁式扩展。
```

---

## Prompt G：N7 Comparison 深化

### 建议模型

- 主推：`GLM-5`
- 可配合：`Kimi K2.5`

### 提示词

```text
请在 OpenAgents 项目中完成 N7：Comparison 深化。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/API-CONTRACT-SOURCE-OF-TRUTH.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md

任务目标：
- 让 compare 从基础对比升级为可支持调优和复盘决策的能力
- 增强输入差异、关键节点差异、输出差异摘要
- 规范 compare session 生命周期

允许重点修改：
- src/app/services/run-compare-service.ts
- src/app/dto.ts
- web/src/pages/RunComparisonPage.tsx
- 相关测试文件

明确禁止：
- 不只是增加字段并排展示
- 不返回没有解释来源的抽象分数

请按以下顺序工作：
1. 梳理当前 compare 的不足
2. 先增强 comparison DTO 和 service
3. 再增强页面展示
4. 补 compare service 与页面测试

交付要求：
- 说明 compare 结果新增了哪些有决策价值的信息
- 说明 compare session 生命周期如何更清晰
- 说明新增测试
```

---

## Prompt H：N8 路由层与服务层整理

### 建议模型

- 主推：`gpt-5.3-codex` 或同级更强模型
- 不建议：`qwen3.5` 或 `minimax m2.7` 独立主导

### 提示词

```text
请在 OpenAgents 项目中完成 N8：路由层与服务层整理。

先阅读以下文档：
- docs/future/TASK-EXECUTION-CARDS.md
- docs/future/REVIEW-AND-QA-CHECKLIST.md
- docs/future/MODEL-DELIVERY-GUIDE.md

任务目标：
- 在不打断主链路开发的前提下，控制路由和服务层复杂度上升
- 提取低风险的公共参数解析、错误处理、重复转换逻辑

允许重点修改：
- src/web/routes.ts
- src/app/context.ts
- src/app/services/*
- 少量相关测试

明确禁止：
- 不做高风险框架迁移
- 不重写 Web server 组织方式
- 不改变现有外部行为语义

请按以下顺序工作：
1. 先识别低风险且收益明显的整理点
2. 只做不改变行为语义的整理
3. 补必要回归测试
4. 列出不建议在本次继续推进的重构项

交付要求：
- 说明提取了哪些公共逻辑
- 说明为何这些修改是低风险的
- 说明回归测试
- 说明后续仍建议保留的技术债
```

---

## 五、分模型快捷版提示词

## 1. 发给 `gpt-5.3-codex` 的快捷前置语

```text
本次任务可能涉及系统边界定义。请你优先做“边界定稿 + 最小实现 + 测试保护”，不要一上来做大重构。你的首要任务是把契约、状态来源、主链路语义定清楚，并让后续中等模型可以继续安全接手。
```

## 2. 发给 `GLM-5` 的快捷前置语

```text
本次任务允许你做明确边界下的 service、DTO、route、页面同步修改，但不允许擅自升级为系统级设计重构。你需要优先保持契约一致性、状态真源单一，以及测试同步补齐。
```

## 3. 发给 `Kimi K2.5` 的快捷前置语

```text
本次任务更偏页面收口、交互反馈、可视化体验或页面测试补充。你不要重新定义系统边界，不要发明新的 DTO / 状态模型，也不要通过兼容分支掩盖根因。你的重点是：在既有边界下稳定落地页面、提示、交互和测试。
```

## 4. 发给 `qwen3.5` 的快捷前置语

```text
本次任务更偏页面收口、异常态收口或基础测试补充。你不要重新定义系统边界，不要发明新的 DTO / 状态模型，也不要通过兼容分支掩盖根因。你的重点是：在既有边界下稳定落地页面、提示和测试。
```

## 5. 发给 `minimax m2.7` 的快捷前置语

```text
本次任务允许你做明确边界下的 service、DTO、route、页面同步修改，但不允许擅自升级为系统级设计重构。你需要优先保持契约一致性、状态真源单一，以及测试同步补齐。
```

## 6. 发给更强模型的快捷前置语

```text
本次任务可能涉及系统级边界定义。请你优先做“边界定稿 + 最小实现 + 测试保护”，不要一上来做大重构。你的首要任务是把契约、状态来源、主链路语义定清楚，并让中等模型后续可以继续接手。
```

---

## 六、能力不足时的升级提示词

如果你判断当前模型已经不适合继续做，可以直接发下面这段给更强模型：

```text
前一个模型在当前任务上已经暴露出能力边界，具体表现为：
- 契约持续漂移 / 状态持续不稳 / 主链路边界无法收口 / 兼容补丁过多（按实际填写）

请你不要重复从页面 patch 开始修，而是先做以下事情：
1. 重新梳理该任务的系统边界
2. 明确真源 DTO / 状态真源 / 事件语义 / 主链路语义
3. 给出最小必要修改方案
4. 补关键测试，防止后续模型继续漂移

你的目标不是做更多功能，而是把边界定稳，让后续中等模型能够继续安全接手。
```

---

## 七、推荐使用方式

建议你后续真实分发时采用下面这个格式：

1. 发送“通用总控提示词”
2. 发送“按任务的专项提示词”
3. 如需要，再加一段模型专属前置语
4. 完成后用 `REVIEW-AND-QA-CHECKLIST` 审查

这样做的目的不是让提示词更长，而是让模型更少误解任务边界、更少把问题做散。
