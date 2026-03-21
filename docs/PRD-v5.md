# openAgents - 产品需求文档（PRD）v5

**产品版本**: v0.4.0 MVP  
**文档编号**: PRD-v5  
**状态**: 草案 / 待评审  
**创建日期**: 2026-03-20  
**作者**: 翟扬 / Codex  
**项目地址**: https://github.com/openagents

---

## 一、v4 回顾与 v5 背景

### 1.1 当前产品现状

截至 v0.3.x，openAgents 已具备一套较完整的 CLI 工作流编排能力：

| 能力 | 状态 |
|------|------|
| CLI 工作流执行 | ✅ 已完成 |
| DAG 调度与并行执行 | ✅ 已完成 |
| Human-in-the-Loop Gate | ✅ 已完成 |
| 中断恢复 | ✅ 已完成 |
| 流式输出 | ✅ 已完成 |
| 结构化输入 | ✅ 已完成 |
| Script Runtime | ✅ 已完成 |
| Step Cache | ✅ 已完成 |
| Eval + Analyze | ✅ 已完成 |
| Skills 注册表 | ✅ 已完成 |
| Debug Template / DAG / Server | ✅ 已完成 |

### 1.2 当前瓶颈

CLI 已经证明 openAgents 的核心引擎方向是成立的，但在面向更广泛用户时，出现了明显门槛：

**瓶颈 1：CLI 对非技术用户不友好**  
用户需要理解命令、参数、目录结构、YAML 配置和运行状态文件。对于内容团队、运营团队、咨询团队、独立创作者，这个门槛太高。

**瓶颈 2：执行过程虽然透明，但还不够“可视化”**  
CLI 能显示进度和流式输出，但对于多步骤、多分支、长上下文任务，用户仍然难以快速理解“当前正在发生什么”。

**瓶颈 3：项目资产分散在文件系统中，不利于日常使用**  
工作流、agents、skills、runs、logs、eval 都是很有价值的资产，但目前需要依赖命令行和文件目录去找，不利于形成产品化体验。

**瓶颈 4：现有能力对外展示不够“产品化”**  
从价值上看，openAgents 已经具备“Agent workflow workbench”的雏形，但 UI 入口缺失，难以让新用户快速理解和上手。

### 1.3 v5 的定位

> **v0.4.0 = 本地优先的 Web UI MVP，让非技术用户也能跑通 openAgents 的核心工作流闭环**

v5 不是做一个“大而全”的平台，而是做一个**足够好用、足够美观、足够直观**的 Web UI MVP：

- 用 Web UI 承载已有引擎能力
- 降低非技术用户的使用门槛
- 保持“透明、可控、可追溯”的产品核心
- 为后续多用户、云端 API、团队协作打基础

---

## 二、版本目标与范围

### 2.1 核心目标

v5 的核心目标不是替代 CLI 的所有高级能力，而是完成一个清晰的 MVP 闭环：

> **选择模板 / 工作流 → 配置输入 → 发起运行 → 实时观察 → 审批 Gate → 查看结果 / 历史记录**

同时，Web UI 需要满足三个非功能目标：

1. **好看**：界面大方、现代、有品牌感，符合欧美用户的审美偏好  
2. **易懂**：第一次打开就知道“我能做什么”  
3. **可扩展**：未来能逐步承接编辑器、团队协作、云 API

### 2.2 版本范围

| 范围 | 内容 |
|------|------|
| **纳入 MVP** | Dashboard、Workflow Library、Run Detail、Gate 处理、Outputs/Logs、基础设置、多语言 |
| **延后** | 在线 YAML 可视化编辑器、Agent Builder、多人协作、权限系统、云端部署 |
| **不做** | SaaS 多租户、在线计费、分享市场、复杂 RBAC |

### 2.3 成功标准

MVP 发布后，满足以下标准即视为成功：

1. 非技术用户不看命令行文档，也能从 UI 成功跑通一个模板工作流  
2. 用户能在 UI 中看懂当前运行状态、输出结果、失败原因  
3. 用户能在 UI 中完成 Gate 审批与 Resume  
4. 用户能在 UI 中查看历史 runs、评估结果、关键日志  
5. UI 在英文环境下视觉观感专业，不像“管理后台拼装页”

---

## 三、目标用户

### 3.1 核心用户群

#### 用户 A：非技术内容创作者

| 特征 | 描述 |
|------|------|
| 背景 | 会使用 ChatGPT/Claude，但不写代码 |
| 需求 | 想把“调研 → 写作 → 审核”流程标准化 |
| 痛点 | 不愿意碰命令行、配置文件、环境变量 |

#### 用户 B：小团队中的 AI 运营 / 项目经理

| 特征 | 描述 |
|------|------|
| 背景 | 有产品/运营经验，技术一般 |
| 需求 | 想稳定复用工作流模板，查看运行记录和结果 |
| 痛点 | 需要一个图形化入口，而不是靠终端执行 |

#### 用户 C：技术用户 / 工作流设计者

| 特征 | 描述 |
|------|------|
| 背景 | 能维护 YAML / Prompt / 模型配置 |
| 需求 | 自己设计工作流，让团队其他人通过 UI 使用 |
| 痛点 | 当前只能把 CLI 项目交给别人，交付成本高 |

### 3.2 非目标用户

本期不是为以下人群设计：

- 需要多人实时协作和权限隔离的大型企业团队
- 需要云端托管和 API 网关的一体化平台用户
- 需要强可视化拖拽编排器的低代码用户

---

## 四、产品定位与差异化

### 4.1 v5 的一句话定位

> **A beautiful local-first workspace for running transparent AI agent workflows**

### 4.2 与竞品的差异化

相比 Dify、Flowise、LangGraph Studio 一类产品，openAgents Web UI 的差异化不在“拖拽画布”，而在：

1. **本地优先**：先服务单机、本地项目、本地输出目录  
2. **透明执行**：运行状态、日志、输出、Gate、评估结果全部可追溯  
3. **引擎复用**：直接承接已经验证过的 CLI 能力，而不是新造一套执行内核  
4. **渐进式产品化**：技术用户设计工作流，非技术用户通过 UI 使用

### 4.3 视觉定位

整体风格应避免“国产后台管理模板感”和“AI 紫色渐变套壳感”，目标是：

- 简洁但不单调
- 专业但不冰冷
- 有呼吸感和留白
- 更接近 Notion、Linear、Raycast、Vercel、Framer 这一类欧美 SaaS 工具的审美取向

---

## 五、MVP 核心功能设计

### 5.1 信息架构

MVP Web UI 采用 5 个一级导航：

| 导航 | 作用 |
|------|------|
| **Home** | 欢迎页、快速入口、最近运行 |
| **Workflows** | 查看模板与可运行工作流 |
| **Runs** | 查看运行历史与当前任务 |
| **Run Detail** | 查看单次运行的步骤、日志、输出、Gate |
| **Settings** | 语言、主题、项目路径、基础运行设置 |

> 说明：`Run Detail` 是路由页面，不一定出现在左侧导航中，但属于一级核心页面。

### 5.2 功能 1：Home Dashboard

#### 目标

让首次进入产品的用户在 10 秒内理解三件事：

1. 这个产品是做什么的  
2. 我下一步应该点哪里  
3. 最近发生了什么

#### 页面内容

- Hero 区域：一句价值主张 + 两个主 CTA
- Quick Actions：
  - Run a template
  - Open recent run
  - View workflows
- Recent Runs 列表
- 当前系统状态：
  - 当前项目路径
  - 默认语言
  - API Key 是否已配置

#### MVP 交互

- 首次进入时，如果没有任何 workflow，提示用户初始化模板项目
- 如果存在工作流，默认展示最近可运行的 3-5 个 workflow

### 5.3 功能 2：Workflow Library

#### 目标

让用户可以像浏览模板库一样挑选可运行工作流，而不是先理解 YAML 文件夹。

#### 页面内容

- Workflow 卡片列表
- 支持按以下维度展示：
  - 名称
  - 描述
  - 步骤数
  - 使用的 agents 数量
  - 是否启用 eval
- 数据来源：
  - 当前项目中的 workflows
  - 当前模板项目中的 metadata（如可用）

#### MVP 交互

- 点击卡片进入 Workflow Overview Drawer / Page
- 在详情中展示：
  - 工作流说明
  - 步骤结构摘要
  - 需要的输入项
  - “Run workflow” 按钮

### 5.4 功能 3：Run Workflow 表单

#### 目标

替代 CLI 的 `run <workflow_id> --input/--input-json/--stream/...` 操作。

#### MVP 表单项

- Workflow 标题与说明
- 输入模式：
  - Plain text
  - Structured JSON
- 输入表单：
  - 纯文本输入框
  - JSON 文本框（后续可升级为 schema-driven form）
- 运行选项：
  - Enable streaming
  - Auto-approve gates
  - Skip evaluation
- Submit 按钮

#### MVP 交互原则

- 默认以“简单模式”为主，只露出最常用项
- 高级选项折叠在 “Advanced options”
- JSON 输入错误需即时校验

### 5.5 功能 4：Run Detail 实时执行页

#### 目标

这是 MVP 最核心页面，承载“透明执行”的产品价值。

#### 页面结构

页面分为 3 栏或 2 栏响应式布局：

- 左侧：步骤列表 / 执行进度
- 中间：当前步骤详情 / 流式输出
- 右侧：元信息与操作区

#### 核心模块

1. **Run Header**
   - workflow 名称
   - run id
   - 状态（running / completed / failed / interrupted）
   - 开始时间 / 时长

2. **Step Timeline**
   - 每个 step 的状态
   - 当前执行中的 step 高亮
   - completed / failed / skipped / waiting visually distinct

3. **Live Output Panel**
   - 实时流式输出
   - 支持滚动
   - 可切换 raw / formatted 视图（formatted 可后续增强，MVP 可先只做 raw）

4. **Gate Action Panel**
   - 当 step 进入 gate.waiting 时显示：
     - Approve
     - Reject
     - Edit and continue
   - MVP 中 `Edit and continue` 可先采用文本框编辑最终输出

5. **Run Meta Panel**
   - token usage
   - model
   - duration
   - output files
   - error details

### 5.6 功能 5：Runs 历史页

#### 目标

让用户看到“我跑过什么、跑得怎么样、能不能继续处理”。

#### 列表字段

- Run ID
- Workflow
- Status
- Created At
- Duration
- Score（若有 eval）

#### MVP 交互

- 支持按 workflow / status 筛选
- 支持点击进入详情页
- interrupted run 支持 Resume

### 5.7 功能 6：Outputs / Logs / Eval

#### 目标

把原本埋在文件夹里的产物变成可读的 UI 模块。

#### 页面或 Tab 内容

- **Outputs**
  - 每个 step 的输出文件
  - 支持纯文本预览
- **Logs**
  - events.jsonl 以时间线方式展示
- **Eval**
  - 总分
  - 各维度得分
  - 与上一轮对比（若存在）

#### MVP 约束

- 只做“查看”和“复制”
- 不在 MVP 中做复杂分析图表

### 5.8 功能 7：Settings

#### MVP 内容

- Language: English / 简体中文
- Theme: Light / Dark / System
- Project path
- API Key 状态提示
- Base URL 状态提示

#### 注意事项

- 出于安全性，敏感值不一定在 UI 里直接编辑；MVP 可先展示状态和引导说明
- 后续版本再考虑在本地安全存储中直接管理密钥

---

## 六、MVP 不做什么

为了控制范围，本期明确不做以下内容：

### 6.1 可视化编排器

不做拖拽式 DAG 编辑器。  
原因：实现复杂度高，且当前项目的核心价值已由 YAML + 引擎验证，Web UI MVP 首先应该解决“使用门槛”，不是“创作方式革命”。

### 6.2 全量配置编辑器

不做完整的 Agent / Workflow / Skill 在线编辑器。  
MVP 可以展示只读信息，编辑能力延后到 v0.5+。

### 6.3 多用户系统

不做登录、组织、成员、权限。  
MVP 假设是单用户、本地项目、本地服务。

### 6.4 在线 SaaS 部署

不做云端托管。  
v5 定位是 local-first desktop companion / local web workspace。

---

## 七、用户流程

### 7.1 首次使用流程

```text
打开 Web UI
  -> 看到欢迎页和项目状态
  -> 进入 Workflows
  -> 选择模板工作流
  -> 填写输入
  -> 点击 Run
  -> 进入实时执行页
  -> 查看输出和结果
```

### 7.2 Gate 流程

```text
运行中
  -> 某 step 进入 gate.waiting
  -> UI 弹出 Gate 面板
  -> 用户选择 Approve / Reject / Edit
  -> 引擎继续执行或中断
```

### 7.3 历史查看流程

```text
打开 Runs
  -> 查看最近运行
  -> 点进某次 Run Detail
  -> 查看步骤状态 / 输出 / 日志 / 评分
  -> 如状态为 interrupted，则点击 Resume
```

---

## 八、界面与视觉设计要求

### 8.1 视觉方向

整体视觉关键词：

- Clean
- Editorial
- Spacious
- Premium
- Calm confidence

应避免：

- 过度鲜艳的 AI 渐变背景
- 紫色泛滥
- 过密信息堆叠
- 典型后台系统的强表格感

### 8.2 版式要求

- 使用足够留白，避免信息块挤在一起
- 卡片圆角克制，不要过度拟物
- 标题层级清晰，正文易扫读
- 首屏 CTA 明确，不让用户“看了不知道点哪里”

### 8.3 色彩建议

- 主色：偏深蓝、石墨黑、暖灰白体系
- 辅助色：低饱和绿色 / 橙色 / 红色用于状态反馈
- 背景：避免纯白大平面，建议用轻微暖灰或冷灰层次

### 8.4 字体建议

- 英文优先考虑：`Inter`, `Söhne` 风格, `Geist`, `IBM Plex Sans`
- 中文需要有兼容替代，保证中英文混排清晰

### 8.5 动效原则

- 动效只服务于状态感知，不做炫技
- loading / step transition / gate alert 可有轻微动画
- 流式输出应自然，不抖动、不闪烁

---

## 九、多语言设计

### 9.1 MVP 支持语言

- English
- 简体中文

### 9.2 语言策略

- 默认语言：跟随浏览器语言
- 用户可手动切换并持久化
- 所有 UI 文案必须走 i18n key，不允许硬编码在组件中

### 9.3 文案风格要求

英文文案应偏简洁、自然、产品化，避免中式英语。示例：

| 场景 | 不推荐 | 推荐 |
|------|--------|------|
| 空状态 | No data | No runs yet |
| 运行完成 | Workflow finished successfully | Run completed |
| 输入提示 | Please enter input content | Add your input |

### 9.4 国际化覆盖范围

MVP 需要国际化的范围包括：

- 导航
- 页面标题
- 按钮文案
- 状态标签
- 空状态
- 错误提示
- 表单提示

日志正文和模型输出不需要翻译。

---

## 十、技术方案建议（MVP）

### 10.1 架构原则

Web UI 必须尽量复用现有引擎，而不是再写一套执行逻辑。

推荐架构：

```text
Web UI (React / Next.js or Vite SPA)
    ->
Local Web Server / API Adapter
    ->
Existing WorkflowEngine
    ->
State / Output / Events / Eval files
```

### 10.2 建议技术选型

#### 前端

- React
- Next.js（App Router）或 Vite + React Router
- TypeScript
- Tailwind CSS 或 CSS Modules + 设计 token
- i18n：`next-intl` 或 `react-i18next`

#### 本地服务层

- Node.js
- 复用现有 TypeScript 引擎代码
- WebSocket / SSE 用于推送 run 事件与流式输出

#### 设计系统

- 不建议上来引入重型后台组件库
- 推荐自建轻量 UI primitives，保证品牌一致性

### 10.3 推荐实现路径

#### 路径 A：Next.js + 本地 API

优点：

- 页面路由、SSR/静态能力完善
- 更容易做漂亮的营销型首页和产品式界面
- 后续扩展到云端更自然

缺点：

- 需要梳理本地运行和 API 绑定方式

#### 路径 B：Vite SPA + Express/Hono 本地服务

优点：

- 更轻量
- 更贴近桌面本地工具

缺点：

- 页面组织与未来服务端扩展稍弱

**建议**：若你希望后续走产品化和云端路线，优先 **Next.js**。若你更追求当前本地 MVP 的开发效率，可先 **Vite SPA + 本地服务**。

### 10.4 与现有引擎的接口要求

为了支持 Web UI，需要进一步明确这些接口：

1. `listWorkflows()`
2. `getWorkflow(workflowId)`
3. `runWorkflow({ workflowId, input, inputData, stream, noEval, autoApprove })`
4. `resumeRun(runId, options)`
5. `listRuns(filters)`
6. `getRun(runId)`
7. `getRunEvents(runId)`
8. `getRunOutputs(runId)`
9. `gateAction(runId, stepId, action, payload)`

> 说明：如果当前 `WorkflowEngine` 与 CLI 仍有部分耦合，这一版应优先把“可被 Web 层调用”的服务接口抽出来。

---

## 十一、数据与状态设计

### 11.1 前端核心状态

| 状态 | 说明 |
|------|------|
| `currentProject` | 当前打开的项目路径 |
| `workflows` | 工作流列表 |
| `runs` | 运行历史 |
| `activeRun` | 当前详情页 run |
| `streamBuffer` | 流式输出缓存 |
| `locale` | 当前语言 |
| `theme` | 当前主题 |

### 11.2 Run Detail 事件流

MVP 建议基于事件驱动更新页面：

- `workflow.started`
- `step.started`
- `step.completed`
- `step.failed`
- `gate.waiting`
- `gate.approved`
- `workflow.completed`

前端不应靠轮询拼接复杂状态，尽量由事件流驱动 UI。

---

## 十二、页面清单与验收标准

### 12.1 页面清单

| 页面 | MVP 必须 | 说明 |
|------|----------|------|
| Home | ✅ | 欢迎页 + 最近运行 |
| Workflows List | ✅ | 工作流浏览和启动入口 |
| Workflow Run Form | ✅ | 输入和运行配置 |
| Run Detail | ✅ | 实时执行、Gate、输出、日志 |
| Runs List | ✅ | 历史记录 |
| Settings | ✅ | 语言 / 主题 / 路径 / 环境状态 |

### 12.2 功能验收

#### A. 运行能力

- 用户可以在 UI 中启动一个 workflow
- 用户可以选择 plain text 或 JSON 输入
- 用户可以打开 streaming 模式
- 用户可以在 UI 中 resume interrupted run

#### B. 可视化能力

- 用户可以看到步骤进度
- 用户可以看到当前输出流
- 用户可以看到最终 outputs / logs / eval

#### C. Gate 能力

- 当 step 等待审批时，UI 能实时提示
- 用户可以 approve / reject / edit
- Gate 操作后界面实时刷新状态

#### D. 国际化能力

- 英文和中文都能完整切换
- 页面布局不会因中英文长度变化而明显变形

#### E. 审美基线

- 首屏、列表页、详情页在桌面端都具备统一设计语言
- 不出现明显“表单堆砌 + 默认组件库皮肤”观感

---

## 十三、开发阶段建议

### Phase 1：服务接口层

目标：让 Web UI 能驱动现有引擎

- 抽象 Web 可调用的 service 层
- 打通 run / resume / list / detail / gateAction
- 打通事件流推送

### Phase 2：MVP 页面骨架

目标：先跑通完整路径

- Home
- Workflows
- Run Form
- Run Detail
- Runs List
- Settings

### Phase 3：视觉打磨与多语言

目标：把产品从“能用”提升到“愿意用”

- 统一设计 token
- 打磨空状态 / loading / error 状态
- 中英文文案完善
- 响应式适配

### Phase 4：Beta 验证

目标：验证真实用户是否能顺畅上手

- 用默认模板做可用性测试
- 观察首次启动是否有障碍
- 观察 Gate 和 Run Detail 是否易理解

---

## 十四、风险与应对

### 风险 1：引擎与 CLI 仍有隐性耦合

**应对**：先抽 service 层，再做页面；避免 UI 直接依赖 CLI 命令执行。

### 风险 2：MVP 范围膨胀

**应对**：坚持只做“运行、观察、审批、查看结果”闭环，不在第一期做编辑器和拖拽器。

### 风险 3：UI 做成普通后台

**应对**：前期先定义设计 token、参考板和页面风格原则，优先做视觉基线而不是事后补救。

### 风险 4：国际化滞后

**应对**：从第一天起所有 UI 文案走 i18n key，不接受先英文硬编码后补翻译。

---

## 十五、v5 结论

v5 的本质，不是“给 CLI 套一层网页壳”，而是把 openAgents 从**开发者工具**推进到**可交付给普通用户使用的产品**。

MVP 的关键不是做多少页面，而是完成这条真正成立的体验链路：

> **用户无需理解命令行和 YAML，也能通过一个漂亮、清晰、可信的 Web 界面，运行并理解一个多 Agent 工作流。**

如果这条链路跑通，openAgents 才真正具备进入更广泛用户场景的基础。

---

## 附录 A：建议首页文案方向

### 英文 Hero 候选

**Option A**
> Run AI agent workflows with clarity, control, and confidence.

**Option B**
> A local-first workspace for transparent multi-agent execution.

**Option C**
> Build the workflow once. Let anyone on your team run it.

### 中文 Hero 候选

**方案 A**
> 让多 Agent 工作流的执行过程清晰可见、可控、可追溯。

**方案 B**
> 一个面向本地优先场景的多 Agent 工作台。

**方案 C**
> 技术用户搭好工作流，普通用户也能直接运行。

---

## 附录 B：建议视觉参考关键词

- Linear
- Notion
- Vercel
- Framer
- Raycast
- Stripe Dashboard

> 注意：参考的是“节奏、留白、信息层级、色彩克制”，不是照搬具体样式。
