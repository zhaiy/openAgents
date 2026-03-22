# openAgents - 产品需求文档（PRD）v6

**产品版本**: v0.5.0  
**文档编号**: PRD-v6  
**状态**: 草案 / 待评审  
**创建日期**: 2026-03-21  
**作者**: 翟扬 / Codex  
**项目地址**: https://github.com/openagents

---

## 一、版本背景

### 1.1 v5 回顾

在 `v0.4.x` 阶段，openAgents 已完成 Web UI MVP 的第一轮建设，核心价值在于：

- 用户可以通过 Web UI 浏览 workflow
- 用户可以通过表单发起运行
- 用户可以查看 runs 列表与单次运行详情
- 用户可以在页面内处理 Gate
- 用户可以通过 SSE 看到实时执行过程

这意味着产品已经完成了从“纯 CLI 工具”到“本地优先 AI Workflow UI”的第一步。

### 1.2 当前问题

虽然 v5 已经打通闭环，但当前 UI 仍然偏“功能入口集合”，还没有形成真正的“工作流控制台”体验。主要问题如下：

#### 问题 1：配置过程仍然偏表单化，缺少结构感

当前 workflow 运行前的配置主要体现为文本输入、JSON 输入和少量选项开关。  
对于多输入、多阶段、多 agent 的 workflow，用户无法快速理解：

- 这个流程会经过哪些步骤
- 每个步骤依赖什么输入
- 当前配置会影响哪些节点
- 哪些配置是必填、推荐、危险或高成本项

#### 问题 2：执行过程虽然可见，但缺少“全局可视化”

当前 Run Detail 更像“步骤列表 + 输出片段 + 流式文本”，还不能有效表达：

- 工作流整体 DAG 结构
- 当前卡在哪个节点
- 哪些步骤并行、哪些步骤串行
- 哪些节点依赖 Gate、Cache、Eval
- 失败传播路径和重试边界

#### 问题 3：配置与执行是割裂的

用户在运行前配置的是表单，在运行后看到的是状态列表，二者之间缺少统一的“流程模型”。

结果是：

- 配置前无法预判执行路径
- 执行中无法追溯输入影响
- 失败后难以知道应该改哪里重新运行

#### 问题 4：当前 UI 还不足以承接“团队协作式使用”

虽然本期仍然不做多人协作和权限系统，但如果产品希望成为“Agent workflow workbench”，那么至少需要：

- 让 workflow 更容易被理解
- 让 run 更容易被诊断
- 让配置更容易被复用
- 让运行结果更容易被比较

### 1.3 v6 的版本定位

> **v0.5.0 = 从“可运行的 Web UI”升级为“可视化配置与执行工作台”**

v6 的目标不是做一个低代码拖拽编排器，也不是在本期引入复杂在线编辑器；  
v6 的核心是：

- 把已有工作流执行能力“看得懂”
- 把运行前配置能力“配得清”
- 把运行中状态“盯得住”
- 把运行后问题“查得明”

---

## 二、版本目标

### 2.1 核心目标

v6 聚焦两个核心主题：

1. **配置可视化管理**
2. **执行流程可视化管理**

围绕这两个主题，版本需达成以下目标：

#### 目标 A：让用户在运行前理解流程

用户在点击“Run”前，应能直观看到：

- workflow 的节点结构
- 关键步骤说明
- 输入项与节点的关系
- 可选项对执行行为的影响

#### 目标 B：让用户在运行中掌控流程

用户在执行过程中，应能快速判断：

- 当前执行到哪里
- 哪些节点已完成 / 进行中 / 等待 / 失败 / 被跳过
- 是否存在 Gate 阻塞
- 是否存在高耗时、高 token、高风险节点

#### 目标 C：让用户在运行后快速复盘

用户完成执行后，应能高效完成：

- 查看结果摘要
- 定位失败原因
- 对比关键步骤输出
- 选择从头重跑或基于调整重新运行

### 2.2 非功能目标

#### 目标 D：界面专业、结构清晰

UI 不能只是“把 CLI 数据搬上页面”，而要有明确的信息层级、流程感和状态感。

#### 目标 E：尽量复用当前技术架构

v6 应继续复用：

- 现有 WorkflowEngine
- 现有 service 层
- 现有 run 状态与事件机制
- 现有 Web API 基础框架

#### 目标 F：为后续可视化编辑器打基础

虽然本期不做完整的拖拽编排器，但应提前建立：

- 节点视图的数据模型
- DAG 可视化的数据契约
- 配置 schema 与 UI 控件映射机制

---

## 三、版本范围

### 3.1 本期纳入范围

v6 纳入以下能力：

| 模块 | 内容 |
|------|------|
| Workflow Visual Overview | 工作流概览、步骤关系图、节点说明、输入依赖说明 |
| Visual Run Config | 结构化输入面板、分组配置、参数校验、预运行摘要 |
| Run Execution Visualization | DAG/流程视图、节点状态实时更新、阻塞点提示 |
| Run Diagnostics | 失败节点定位、日志与输出关联、重试建议 |
| Run Comparison Lite | 最近两次 run 的关键差异对比 |
| Re-run Experience | 基于历史输入快速重跑、修改后重跑 |
| UX/Design Upgrade | 页面布局、视觉体系、状态标签、空状态、引导文案升级 |

### 3.2 本期明确不做

以下内容不纳入 v6：

- 在线拖拽式 workflow 编辑器
- 在线编辑 YAML / agent / prompt 的完整 IDE
- 多人协作、权限系统、评论系统
- 云端托管和 SaaS 多租户
- 复杂资源监控和成本结算系统
- 完整的版本 diff 管理系统

### 3.3 延后但需预留接口

- Schema-driven 表单自动生成增强版
- 节点级重试 / 从失败节点恢复
- Workflow 版本历史与 diff 视图
- 成本分析面板
- 模板市场 / workflow 发布机制

---

## 四、目标用户

### 4.1 用户类型 A：非技术使用者

#### 典型角色

- 内容创作者
- AI 运营
- 研究助理
- 项目经理

#### 核心诉求

- 不看 YAML 也能理解流程
- 不学 CLI 也能配置并执行
- 遇到失败时知道该怎么办

### 4.2 用户类型 B：半技术工作流操作者

#### 典型角色

- AI PM
- 自动化流程维护者
- 业务侧解决方案同学

#### 核心诉求

- 能看到输入和节点关系
- 能快速识别 Gate、失败点、耗时点
- 能基于历史配置快速重跑

### 4.3 用户类型 C：技术设计者

#### 典型角色

- Workflow 作者
- Agent 配置维护者
- Prompt/模板设计者

#### 核心诉求

- 让非技术同事能更顺畅地使用自己设计的 workflow
- 让运行过程更容易被解释和排障
- 为未来可视化编辑能力铺路

---

## 五、核心产品定义

### 5.1 一句话定位

> **A local-first visual console for configuring, running, and diagnosing transparent AI workflows**

### 5.2 核心价值主张

openAgents v6 不是“拖拖拽拽的流程图工具”，而是：

- 对真实 workflow 执行过程的可视化解释器
- 对 workflow 输入配置的图形化控制台
- 对 run 诊断与复盘的可视化观察台

### 5.3 与 v5 的本质区别

v5 的重点是“有 UI，能跑通”。  
v6 的重点是“UI 真正能帮助用户理解和管理流程”。

---

## 六、核心用户场景

### 场景 1：首次使用一个 workflow

用户进入 `Workflows` 页面后，点击某个 workflow，希望先知道：

- 这个 workflow 是做什么的
- 它有几步
- 哪些步骤是关键节点
- 需要提供哪些输入
- 执行过程中是否会有人审 Gate

**v6 期望结果**：

- 用户在进入运行表单前，就能通过可视化概览理解流程结构

### 场景 2：填写配置后担心跑偏

用户输入了一批参数，但不确定：

- 有没有漏填
- 输入值是否合理
- 这次运行会不会很慢 / 很贵
- 是否会触发 Gate / Eval / Script Runtime

**v6 期望结果**：

- 页面展示预运行摘要和风险提示

### 场景 3：运行过程中需要盯进度

用户发起运行后，希望知道：

- 当前正在执行哪个节点
- 为什么长时间没动
- 是否卡在 Gate
- 是否某个分支失败了

**v6 期望结果**：

- 页面通过可视化流程图 + 节点状态面板实时反馈全局状态

### 场景 4：运行失败后定位问题

用户看到 run failed，希望快速回答：

- 是哪个节点失败
- 失败前依赖哪些节点
- 错误日志在哪
- 是否只需要调整某个输入再重跑

**v6 期望结果**：

- 页面优先高亮失败节点，并给出对应上下文、日志入口和推荐动作

### 场景 5：想复用上一次配置

用户上次跑过一个相似任务，这次只想改少量参数。

**v6 期望结果**：

- 用户可以从历史 run 一键复制配置重新运行

---

## 七、产品策略

### 7.1 设计原则

#### 原则 1：先“解释真实流程”，再谈“编辑流程”

本期不优先做可视化拖拽编辑，而是先把已有 workflow 可视化解释清楚。

#### 原则 2：统一配置视角与执行视角

配置页面和执行页面应基于同一套节点模型，避免“配置是一套语言，执行是另一套语言”。

#### 原则 3：默认简单，按需展开

对于非技术用户，默认看到的是：

- 概览
- 推荐配置
- 核心状态

高级信息如：

- 原始 JSON
- 详细事件流
- 节点元数据
- Eval 原始结果

应折叠在二级视图中。

#### 原则 4：状态优先于装饰

视觉风格可以专业、现代，但必须为“状态识别”和“流程理解”服务。

---

## 八、信息架构升级

### 8.1 一级导航

v6 建议采用以下一级导航：

| 导航 | 说明 |
|------|------|
| Home | 首页、最近活动、推荐入口 |
| Workflows | 工作流库 |
| Runs | 历史运行与状态检索 |
| Diagnostics | 失败 run、待处理 Gate、异常汇总 |
| Settings | 运行环境与项目设置 |

### 8.2 核心页面关系

```text
Home
  -> Workflow Library
      -> Workflow Overview
          -> Visual Run Config
              -> Run Execution Console
                  -> Result / Diagnostics / Re-run

Runs
  -> Run Detail
      -> Comparison / Re-run

Diagnostics
  -> Failed Run Detail
  -> Gate Queue
```

### 8.3 页面重构方向

| 页面 | v5 状态 | v6 方向 |
|------|------|------|
| Home | 基础入口页 | 升级为工作台首页 |
| Workflows | 卡片列表 | 增加概览、结构摘要、筛选 |
| Workflow Run | 基础表单 | 升级为可视化配置台 |
| Run Detail | 步骤列表页 | 升级为执行控制台 |
| Runs | 基础列表 | 增加筛选、状态摘要、重跑入口 |
| Settings | 基础设置 | 增加运行环境诊断和配置说明 |

---

## 九、功能设计

## 9.1 模块一：Workflow Visual Overview

### 目标

在用户开始配置之前，让用户理解 workflow 的整体结构与关键节点。

### 页面位置

- `Workflows` 列表中的详情页 / 详情抽屉
- `Run workflow` 前置概览页

### 核心模块

#### 模块 A：Workflow Header

展示：

- workflow 名称
- 描述
- 标签
- 步骤数
- agent 数
- 是否包含 Gate
- 是否包含 Eval
- 最近一次运行状态摘要

#### 模块 B：Structure Summary

用自然语言和标签展示：

- 总步骤数
- 串行 / 并行分支数
- 关键依赖节点
- 可能的人工介入点
- 预计输出物数量

#### 模块 C：Mini DAG Preview

展示 workflow 的简化结构图：

- 节点卡片
- 连接线
- 起点 / 终点
- Gate / Eval / Script / Cache 标记

MVP 级别不要求支持自由拖拽，但要求：

- 支持横向或纵向自动布局
- 支持点击节点查看节点详情
- 支持高亮当前 hover 节点及其上下游依赖

#### 模块 D：Node Detail Panel

点击节点后右侧展示：

- 节点名称
- 节点类型
- 所属 agent
- 输入来源
- 输出去向
- 是否有 Gate
- 是否启用 Eval
- 节点说明

### 用户收益

- 降低首次理解 workflow 的成本
- 增强“运行前信心”
- 为后续配置和执行可视化建立心智模型

### 验收标准

- 用户不看 YAML，也能理解 workflow 大致流程
- 用户能明确看到 Gate/Eval 等特殊节点
- 节点详情可以解释上下游依赖

---

## 9.2 模块二：Visual Run Config

### 目标

把“运行配置”从单纯表单，升级为“结构化参数面板 + 预运行摘要”。

### 页面定位

替代现有 `WorkflowRunPage` 的基础表单模式。

### 页面布局建议

采用左右双栏结构：

- 左侧：配置表单与输入面板
- 右侧：流程预览与运行摘要

在移动端降级为上下结构。

### 核心模块

#### 模块 A：Input Mode Switcher

支持三种模式：

1. Simple Form
2. JSON Editor
3. From Previous Run

默认进入 `Simple Form`。

#### 模块 B：Structured Input Form

若 workflow 存在输入 schema / metadata，则按字段分组展示：

- Basic Inputs
- Advanced Inputs
- Optional Inputs
- Runtime Options

字段级能力：

- 必填标记
- 类型说明
- 默认值
- placeholder / 示例值
- 即时校验
- 错误信息

如果 schema 缺失，则退回到：

- Plain Text
- Raw JSON

#### 模块 C：Runtime Options

支持但不全部默认展开：

- Enable streaming
- Auto approve gates
- Skip eval
- Concurrency / execution mode（如后续支持）
- Debug mode（仅高级模式显示）

#### 模块 D：Pre-run Summary

基于配置结果，展示本次运行摘要：

- workflow 名称
- 将使用的输入项摘要
- 关键节点数量
- 预计涉及 Gate / Eval / Script
- 风险提示

风险提示示例：

- 存在未填写的推荐字段
- JSON 中包含未知字段
- 将触发人工 Gate，流程可能暂停
- 当前配置可能导致较长上下文

#### 模块 E：Linked Flow Preview

右侧流程图中根据当前输入态做弱联动：

- 高亮受输入影响的关键节点
- 对特殊节点显示“将触发”的提示
- 对有条件分支的 workflow 可显示预计路径

> 注：如果当前引擎暂不支持显式条件分支模型，v6 可先保留“静态高亮”，后续再升级为“动态路径预测”。

### 核心交互

- 用户修改参数后，右侧摘要实时更新
- 表单错误时禁用 Run 按钮
- 支持“保存本次配置草稿”
- 支持“从最近一次成功 run 填充”

### 验收标准

- 非技术用户可以在 Simple Form 模式完成主要配置
- 复杂用户可以切换 JSON 模式
- 用户在点击运行前能看到本次运行摘要和风险提示

---

## 9.3 模块三：Run Execution Console

### 目标

将当前 Run Detail 升级为真正的执行控制台，而不是仅展示步骤列表。

### 页面定位

替代现有 `RunDetailPage` 主视图。

### 页面布局建议

采用三栏式信息结构：

- 左栏：流程总览 / 节点导航
- 中栏：主执行视图
- 右栏：详情侧栏

在小屏下可折叠为：

- 顶部状态摘要
- 流程图
- 详情 Tab

### 核心模块

#### 模块 A：Run Header

展示：

- runId
- workflow 名称
- 当前状态
- 开始时间
- 运行时长
- token 使用量
- 快捷动作

快捷动作包括：

- Re-run
- Re-run with edits
- Open outputs
- Copy config

#### 模块 B：Execution Map

这是 v6 的核心页面能力。

要求展示：

- 全量节点图
- 节点实时状态
- 当前活动节点高亮
- 并行分支状态同步显示
- 失败节点红色突出
- Gate 等待节点警示突出

节点状态至少包括：

- pending
- queued
- running
- streaming
- gate_waiting
- completed
- failed
- skipped
- cached

节点卡片建议展示：

- 节点名
- 状态
- 类型图标
- 耗时
- token / output 摘要（可选）

#### 模块 C：Timeline / Event Rail

除 DAG 外，增加线性时间视角：

- run started
- step started
- stream chunks received
- gate waiting
- gate resolved
- step completed / failed
- workflow completed / failed

作用：

- 帮助用户理解“先后顺序”
- 补足 DAG 图中不直观的时序信息

#### 模块 D：Node Inspector

点击任意节点后，在右侧展示：

- 节点描述
- 当前状态
- 输入摘要
- 输出摘要
- 日志摘要
- 错误信息
- 关联 Gate
- 上下游节点

#### 模块 E：Live Output Panel

展示当前选中节点的流式输出或最终输出：

- streaming 内容
- 最终结果
- copy / expand / wrap 操作
- 大文本折叠

#### 模块 F：Gate Action Panel

当节点进入 `gate_waiting` 时，页面应：

- 在流程图中高亮该节点
- 在顶部显示警示状态
- 在右侧直接展开 Gate 面板

支持操作：

- Approve
- Reject
- Edit then approve

### 关键交互要求

- SSE 实时驱动节点状态变化
- 选中的节点在状态更新时保持上下文不丢失
- 用户切换 Tabs 或刷新页面后，能恢复到当前 run 状态
- 当 run 完成或失败时，自动切换到“结果摘要 / 诊断摘要”

### 验收标准

- 用户能通过流程图一眼看到当前运行位置
- Gate 节点出现时，用户无需再从列表里寻找
- 失败时，失败节点和相关日志入口明显可见

---

## 9.4 模块四：Run Diagnostics

### 目标

让用户在执行失败或结果异常时，能够快速定位问题。

### 页面位置

- Run Detail 内的 `Diagnostics` Tab
- 一级导航 `Diagnostics`

### 核心模块

#### 模块 A：Failure Summary

展示：

- 失败节点
- 失败时间
- 错误类型
- 上游依赖状态
- 下游受影响节点

#### 模块 B：Suggested Actions

根据错误类型和上下文给出建议动作：

- 检查输入参数
- 检查模型配置
- 查看脚本错误日志
- 重新运行
- 调整后重新运行

> 本期建议先基于规则生成，不依赖复杂 LLM 解释层。

#### 模块 C：Logs Correlation

将日志与节点关联，而不是只给整段文本：

- 节点日志
- 错误堆栈
- 相关事件片段

#### 模块 D：Artifacts & Outputs

展示：

- 已产出的输出文件
- 缺失的预期输出
- 部分完成的节点产物

### 一级 Diagnostics 页面

建议包含三个视图：

1. Failed Runs
2. Waiting Gates
3. Needs Attention

### 验收标准

- 用户能在 30 秒内定位失败节点
- 用户能直接找到对应日志或输出
- 用户能知道下一步最可能的处理动作

---

## 9.5 模块五：Run Comparison Lite

### 目标

帮助用户对比两次运行结果差异，支撑“改一点配置重新跑”的工作模式。

### 范围控制

本期不做复杂 diff 引擎，只做轻量对比。

### 支持内容

- 输入参数差异
- 关键状态差异
- 失败 / 成功差异
- 关键步骤输出摘要差异
- 总耗时 / token 差异

### 入口

- Runs 列表：选择两个 runs 对比
- Run Detail：与上一次同 workflow run 对比

### 验收标准

- 用户能理解“这次为什么和上次不一样”
- 能快速看到输入与结果摘要的差异

---

## 9.6 模块六：Re-run Experience

### 目标

降低重复运行成本，把“历史 run”转化为“可复用配置资产”。

### 支持能力

- Re-run same config
- Re-run with edits
- Duplicate as new draft
- Copy JSON config

### 页面设计

在 Run Detail 顶部放置快捷动作：

- `Run Again`
- `Edit and Re-run`

在 Workflow Run Config 页面中支持：

- 从最近一次成功 run 导入
- 从最近一次失败 run 导入

### 验收标准

- 用户不需要手动复制粘贴 JSON 才能重跑
- 历史 run 可以直接成为新的配置起点

---

## 十、数据与状态设计

### 10.1 核心数据对象

v6 建议在前后端统一以下视图模型：

#### WorkflowVisualSummary

包含：

- workflowId
- name
- description
- nodeCount
- edgeCount
- gateCount
- evalCount
- visualNodes
- visualEdges
- inputSchemaSummary

#### WorkflowVisualNode

包含：

- id
- name
- type
- agentId
- hasGate
- hasEval
- isCachedCapable
- upstreamIds
- downstreamIds
- description

#### RunVisualState

包含：

- runId
- workflowId
- status
- startedAt
- completedAt
- durationMs
- nodeStates
- currentActiveNodeIds
- gateWaitingNodeIds
- failedNodeIds
- tokenUsage

#### RunNodeState

包含：

- nodeId
- status
- startedAt
- completedAt
- durationMs
- outputPreview
- logSummary
- errorMessage
- gateState
- tokenUsage

### 10.2 状态机约束

节点状态至少满足以下流转：

```text
pending -> queued -> running -> completed
pending -> queued -> running -> gate_waiting -> running -> completed
pending -> queued -> running -> failed
pending -> skipped
pending -> cached -> completed
```

run 状态至少满足：

```text
pending -> running -> completed
pending -> running -> interrupted
pending -> running -> failed
pending -> running -> gate_waiting (view state, optional aggregate state)
```

### 10.3 事件映射要求

Web 层需要将底层事件统一映射为可视化事件：

- `workflow.started`
- `workflow.completed`
- `workflow.failed`
- `step.queued`
- `step.started`
- `step.stream`
- `step.completed`
- `step.failed`
- `gate.waiting`
- `gate.resolved`
- `eval.started`
- `eval.completed`

---

## 十一、页面级详细需求

## 11.1 Home 页面升级

### 目标

从“欢迎页”升级为“工作台首页”。

### 核心内容

- Hero + 主 CTA
- Recent Runs
- Waiting Gates
- Failed Runs
- 推荐 workflow
- 环境状态卡片

### 验收标准

- 用户进入首页即可看到待处理事项
- 首页能成为日常使用入口，而不仅是一次性欢迎页

---

## 11.2 Workflows 页面升级

### 新增能力

- 搜索
- 标签筛选
- 按是否包含 Gate/Eval 筛选
- 结构摘要展示
- 最近运行状态展示

### 验收标准

- 用户能快速筛出适合当前任务的 workflow
- 列表页本身就具备一定流程解释能力

---

## 11.3 Runs 页面升级

### 新增能力

- 按状态筛选
- 按 workflow 筛选
- 按时间筛选
- 快速重跑
- 快速对比

### 验收标准

- 用户可以把 Runs 页当作日常运营入口使用

---

## 11.4 Settings 页面升级

### 新增能力

- 项目路径状态
- API Key / provider 配置状态
- 默认运行选项
- 环境检测结果
- UI 偏好设置

### 验收标准

- 用户知道环境是否就绪
- 运行问题能在 Settings 中排查一部分

---

## 十二、视觉与交互设计要求

### 12.1 视觉方向

延续 v5 “专业、现代、本地优先工具感”的方向，但要强化：

- 流程感
- 状态感
- 信息分层

### 12.2 视觉关键词

- calm
- precise
- structured
- breathable
- trustworthy

### 12.3 组件风格要求

#### 节点卡片

- 要有明确状态色
- 要有层级感
- 要支持 hover / selected / active / blocked 四类差异

#### 状态标签

要保证在浅色主题下可快速识别：

- running
- gate waiting
- failed
- completed
- cached

#### 面板布局

- 优先卡片化
- 避免纯表格堆叠
- 流程图区域要成为视觉中心，而不是辅助角落

### 12.4 响应式要求

桌面端优先，但移动端需保证：

- 可查看 run 状态
- 可处理 Gate
- 可查看关键输出

不要求移动端完整承载复杂对比和大图编辑能力。

---

## 十三、技术实现约束

### 13.1 技术原则

- 不重写引擎
- 优先增量扩展现有 service 层
- 优先使用现有 SSE 机制
- 优先在现有 Web 前端架构中演进

### 13.2 前端建议

- 引入统一的 workflow graph view model
- 将“步骤列表”升级为“节点视图 + 详情视图”组合
- 为 DAG 视图预留布局和缩放能力

### 13.3 后端建议

新增或增强以下接口：

- workflow visual summary API
- run visual state API
- run comparison API
- re-run with previous config API
- diagnostics summary API

### 13.4 兼容性要求

- CLI 行为不受影响
- 现有 run 数据结构尽量兼容
- 即使缺少 schema / metadata，UI 也应优雅降级

---

## 十四、埋点与成功指标

### 14.1 核心指标

#### 指标 A：首次成功运行率

定义：

- 新用户首次进入 UI 后，在不借助 CLI 的情况下成功完成一次 run 的比例

目标：

- 相比 v5 提升明显

#### 指标 B：配置完成率

定义：

- 进入 run config 页面后，完成并提交运行的比例

#### 指标 C：失败定位效率

定义：

- 用户从 run failed 到打开失败节点详情的平均时间

#### 指标 D：重跑转化率

定义：

- 历史 run 页面中触发 re-run / edit-and-rerun 的比例

#### 指标 E：Gate 处理效率

定义：

- Gate 出现后到用户完成操作的平均时间

### 14.2 定性指标

- 用户是否能描述 workflow 的关键步骤
- 用户是否能解释当前 run 卡住的原因
- 用户是否能独立完成“基于历史配置重跑”

---

## 十五、里程碑建议

### Phase 1：信息结构升级

目标：

- 打通 workflow overview
- 补齐 visual summary 数据模型
- 完成 run config 页面重构

交付重点：

- Workflow Overview
- Structured Config
- Pre-run Summary

### Phase 2：执行可视化升级

目标：

- 完成 Run Execution Console 主体
- 节点状态实时可视化
- Gate 与失败节点高亮

交付重点：

- Execution Map
- Node Inspector
- Timeline

### Phase 3：诊断与复用能力

目标：

- 完成 diagnostics 视图
- 完成 re-run 和 comparison lite

交付重点：

- Diagnostics
- Re-run
- Run Comparison Lite

---

## 十六、优先级拆分

### P0

- Workflow Visual Overview
- Visual Run Config
- Run Execution Console
- Gate 可视化高亮
- 失败节点高亮与诊断入口

### P1

- Run Comparison Lite
- Re-run with edits
- Diagnostics 首页
- 从历史 run 导入配置

### P2

- 配置草稿保存
- 更细粒度的成本/耗时分析
- 条件分支路径预测

---

## 十七、风险与应对

### 风险 1：底层 workflow 元数据不够支撑可视化

问题：

- 当前 workflow 配置未必具备足够完善的 schema、节点说明、显示名称

应对：

- v6 第一阶段允许通过推断 + 降级展示实现
- 同时补充 metadata 扩展规范

### 风险 2：DAG 可视化实现复杂度超预期

问题：

- 自动布局、状态同步、交互细节都可能拉高前端成本

应对：

- 本期先做只读图
- 不做拖拽编辑
- 优先保证状态表达，不追求复杂图编辑体验

### 风险 3：实时事件与页面状态一致性

问题：

- SSE 流、页面刷新、run 完成后的状态回填需要一致

应对：

- 采用“快照 + 增量事件”的组合模式
- 页面初始化先拉取 run visual state，再订阅事件流

### 风险 4：过度设计导致落地慢

问题：

- 如果一开始追求完整 workflow studio，交付会失控

应对：

- 坚持“可视化管理”而非“可视化编辑器”
- 严控范围在解释、观察、复跑三件事

---

## 十八、验收标准

### 18.1 功能验收

版本完成后，应满足：

1. 用户在运行前可查看 workflow 结构图和关键节点说明
2. 用户可通过结构化配置面板完成主要输入配置
3. 用户运行后可通过流程图实时观察节点状态变化
4. 用户在 Gate 出现时可直接从可视化页面完成处理
5. 用户在失败时可快速看到失败节点、相关日志和建议动作
6. 用户可基于历史 run 快速重跑

### 18.2 体验验收

版本完成后，应满足：

1. 不看 YAML 也能理解大致流程
2. 不读文档也能知道如何配置并运行
3. 页面不会让用户在“步骤列表”和“配置表单”之间来回猜测
4. 执行过程一眼能看出卡点和异常点

### 18.3 技术验收

版本完成后，应满足：

1. CLI 能力不受影响
2. 现有 Web API 基础可复用
3. 页面在 workflow metadata 不完整时可以优雅降级
4. SSE 场景下的可视化状态能与 run 快照保持一致

---

## 十九、附录：v6 对外表达建议

### 对内定义

> openAgents v6 的目标，是把 workflow 从“可以运行”升级为“可以理解、可以观察、可以复用”。

### 对外表达

> Visualize configuration. See execution live. Diagnose faster.

或：

> A visual console for transparent AI workflow execution.

---

## 二十、结论

v5 解决的是“有没有 UI”的问题。  
v6 要解决的是“这个 UI 是否真的能承接 workflow 产品化”的问题。

因此，v6 不应继续只堆页面功能，而要围绕“配置”和“执行”这两个核心阶段，建立一套统一、直观、可追踪的可视化管理体验。

如果 v6 做好，openAgents 将从一个“有 Web 壳子的 CLI 工具”，进一步成长为一个真正具备产品形态的本地优先 Agent Workflow Console。
