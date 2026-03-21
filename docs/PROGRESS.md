# OpenAgents 二期开发进度跟踪

> 创建时间：2026-03-17
> 最后更新：2026-03-20

---

## 快速恢复指南

断网重连后，告诉我：**"继续执行开发计划"**，我会读取此文件恢复进度。

---

## 总体进度

| Phase | 状态 | 进度 |
|-------|------|------|
| Phase 1 | ✅ 完成 | 3/3 |
| Phase 2 | ✅ 完成 | 3/3 |
| Phase 3 | ✅ 完成 | 5/5 |
| Phase 4 | ✅ 完成 | 1/3 (4.2/4.3 跳过) |
| Web UI MVP | 🚧 进行中 | T1 完成, T10-T18 完成, T19 部分 |

**当前阶段**：Web UI MVP 开发中
**二期开发完成**

---

## Phase 1：核心功能（第 1 周）

### Task 1.1：.env 自动加载
- **状态**：✅ 已完成
- **工时**：0.5 天
- **复杂度**：低
- **改动文件**：
  - `package.json` - 新增 dotenv 依赖
  - `src/cli/index.ts` - dotenv 加载逻辑
- **测试文件**：`src/__tests__/env-loading.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过
  - [x] npm run build 成功

### Task 1.2：Gate 自动通过选项
- **状态**：✅ 已完成
- **工时**：1.5 天
- **复杂度**：低
- **改动文件**：
  - `src/types/index.ts` - GateOptions 接口
  - `src/cli/run.ts` - CLI 选项
  - `src/cli/resume.ts` - CLI 选项
  - `src/cli/shared.ts` - buildAppContext 参数
  - `src/engine/gate.ts` - autoApprove 逻辑
  - `src/engine/workflow-engine.ts` - 签名扩展
- **测试文件**：`src/__tests__/gate.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过
  - [x] npm run build 成功

### Task 1.3：输入参数系统
- **状态**：✅ 已完成
- **工时**：3 天
- **复杂度**：中
- **改动文件**：
  - `src/types/index.ts` - RunState.inputData
  - `src/cli/run.ts` - --input-json/--input-file 选项
  - `src/engine/template.ts` - inputs 支持
  - `src/engine/workflow-engine.ts` - 透传 inputs
  - `src/engine/state.ts` - inputData 持久化
- **测试文件**：`src/__tests__/template.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过
  - [x] npm run build 成功

---

## Phase 2：体验优化（第 2-3 周）

### Task 2.1：进度显示增强
- **状态**：✅ 已完成
- **工时**：3 天
- **复杂度**：中
- **改动文件**：
  - `src/types/index.ts` - TokenUsage 接口，StepState 扩展
  - `src/runtime/llm-direct.ts` - 提取详细 token 信息
  - `src/engine/workflow-engine.ts` - 存储 tokenUsage/durationMs
  - `src/ui/progress.ts` - 汇总展示
  - `src/i18n/locales/en.ts` - progressSummaryTotal
  - `src/i18n/locales/zh.ts` - progressSummaryTotal
- **测试文件**：`src/__tests__/llm-direct.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过
  - [x] npm run build 成功

### Task 2.2：输出文件命名自定义
- **状态**：✅ 已完成
- **工时**：2 天
- **复杂度**：中
- **改动文件**：
  - `src/types/index.ts` - WorkflowConfig.output.files
  - `src/config/schema.ts` - files schema
  - `src/output/writer.ts` - 自定义文件名
  - `src/engine/workflow-engine.ts` - 解析文件名
- **测试文件**：`src/__tests__/schema.test.ts`, `src/__tests__/writer.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (78 tests)
  - [x] npm run build 成功

### Task 2.3：Script Runtime
- **状态**：✅ 已完成
- **工时**：5 天
- **复杂度**：高
- **改动文件**：
  - `src/types/index.ts` - RuntimeType 扩展 'script'，AgentConfig.runtime.model 改为 optional，新增 script 字段
  - `src/config/schema.ts` - RuntimeTypeSchema 扩展，AgentConfigSchema 支持 script 配置和验证
  - `src/runtime/script.ts` - **新建** ScriptRuntime 实现
  - `src/runtime/factory.ts` - 注册 script 类型，签名变更接受 agentConfig
  - `src/engine/workflow-engine.ts` - RuntimeFactory 类型和调用处适配
  - `src/cli/agents.ts` - 处理 optional model 字段
- **测试文件**：`src/__tests__/script-runtime.test.ts`, `src/__tests__/runtime-factory.test.ts`, `src/__tests__/schema.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (101 tests)
  - [x] npm run build 成功

---

## Phase 3：开发者体验 + 架构改进（第 4-6 周）

### Task 3.1：模板调试命令
- **状态**：✅ 已完成
- **工时**：1 天
- **复杂度**：低
- **改动文件**：
  - `src/cli/debug.ts` - **新建** debug template 子命令
  - `src/cli/index.ts` - 注册 debug 命令
  - `src/i18n/locales/en.ts` - 新增 debug 相关翻译
  - `src/i18n/locales/zh.ts` - 新增 debug 相关翻译
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (101 tests)
  - [x] npm run build 成功

### Task 3.2：DAG 可视化命令
- **状态**：✅ 已完成
- **工时**：2 天
- **复杂度**：中
- **改动文件**：
  - `src/ui/dag-visualizer.ts` - **新建** ASCII DAG 渲染
  - `src/cli/dag.ts` - **新建** dag 子命令
  - `src/cli/index.ts` - 注册命令
  - `src/i18n/locales/en.ts` - 新增 dag 相关翻译
  - `src/i18n/locales/zh.ts` - 新增 dag 相关翻译
- **测试文件**：`src/__tests__/dag-visualizer.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (109 tests)
  - [x] npm run build 成功

### Task 3.3：配置验证增强
- **状态**：✅ 已完成
- **工时**：3 天
- **复杂度**：中
- **改动文件**：
  - `src/config/validator.ts` - **新建** ConfigValidator 类
  - `src/cli/validate.ts` - 添加 --verbose 选项
  - `src/i18n/locales/en.ts` - 新增验证相关翻译
  - `src/i18n/locales/zh.ts` - 新增验证相关翻译
- **测试文件**：`src/__tests__/validator.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (121 tests)
  - [x] npm run build 成功

### Task 3.4：步骤输出缓存
- **状态**：✅ 已完成
- **工时**：4 天
- **复杂度**：中高
- **改动文件**：
  - `src/engine/cache.ts` - **新建** StepCache 类
  - `src/types/index.ts` - 新增 CacheConfig, EventType 扩展
  - `src/config/schema.ts` - 新增 CacheConfigSchema
  - `src/engine/workflow-engine.ts` - 缓存检查和写入逻辑
  - `src/cli/cache.ts` - **新建** cache clear/stats 子命令
  - `src/cli/index.ts` - 注册 cache 命令
  - `src/cli/shared.ts` - 添加 cache 到 engine deps
- **测试文件**：`src/__tests__/cache.test.ts`, `src/__tests__/schema.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (139 tests)
  - [x] npm run build 成功

### Task 3.5：错误恢复策略
- **状态**：✅ 已完成
- **工时**：4 天
- **复杂度**：高
- **改动文件**：
  - `src/types/index.ts` - OnFailureAction, NotifyConfig
  - `src/config/schema.ts` - on_failure schema, superRefine 验证
  - `src/engine/workflow-engine.ts` - 错误处理逻辑 (skip/fallback/fail)
  - `src/output/notifier.ts` - **新建** webhook 通知
- **测试文件**：`src/__tests__/error-recovery.test.ts`, `src/__tests__/schema.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (156 tests)
  - [x] npm run build 成功

---

## 执行日志

### 2026-03-20
- **Web UI MVP（S 级任务）进展更新**
  - ✅ `T2` 完成：Application Service 层抽象
    - 新增 `src/app/context.ts`、`src/app/dto.ts`
    - 新增 `workflow/run/gate/settings` 服务与 `run-registry`
  - ✅ `T4` 完成：Gate 机制 Web 化
    - `src/engine/gate.ts` 抽象 `GateProvider`
    - 新增 `InteractiveGateProvider` 与 `DeferredGateProvider`（超时 + 幂等）
    - 新增 `src/__tests__/gate-deferred.test.ts`
    - 保持 CLI gate 兼容，现有 `gate.test.ts` 回归通过
  - ✅ `T5` 完成：SSE 事件流
    - 新增 `RunEventEmitter`、`WebEventHandler`、`web-event-mapper`
    - 打通 `GET /api/runs/:runId/stream`，支持多连接与断开清理
    - `step.stream` 事件已做节流缓冲推送
  - ⚠️ `T16` 当前状态：仅后端前置完成（前端 Run Detail 实时接入待后续模型继续）
  - 已通过 `npm run build` 与 `npm test`

- **LLM Direct Runtime 兼容性修复**：自动适配推理模型输出字段和流式/非流式响应形态
  - `src/runtime/llm-direct.ts` - 新增统一输出提取逻辑，优先使用 `message.content` / `delta.content`，为空时自动回退到 `reasoning_content`
  - `src/runtime/llm-direct.ts` - `executeStream()` 根据实际 `Content-Type` 自动处理 `text/event-stream` 和普通 JSON 响应，兼容请求流式但服务端返回非流式 JSON 的 provider
  - `src/runtime/llm-direct.ts` - 统一 token usage 构建逻辑，减少分支重复
  - `src/__tests__/llm-direct.test.ts` - 新增 3 个兼容性测试用例，覆盖非流式 `reasoning_content`、流式 `reasoning_content`、流式请求的 JSON 回退
  - `docs/MINIMAX-REASONING-MODEL-COMPATIBILITY.md` - 记录 MiniMax 推理模型兼容性问题分析和修复方案
  - `npx vitest run src/__tests__/llm-direct.test.ts` 通过 (12 tests)

### 2026-03-17
- 创建进度跟踪文档
- 开始 Phase 1
- **Task 1.1 完成**：.env 自动加载
  - 安装 dotenv 依赖
  - 修改 `src/cli/index.ts` 添加 .env/.env.local/.env.{NODE_ENV} 加载逻辑
  - 新增 `src/__tests__/env-loading.test.ts` 测试文件
  - lint/test/build 全部通过
- **Task 1.2 完成**：Gate 自动通过选项
  - `src/types/index.ts` - 新增 GateOptions 接口
  - `src/cli/run.ts` - 添加 --auto-approve 和 --gate-timeout 选项
  - `src/cli/resume.ts` - 同上
  - `src/cli/shared.ts` - buildAppContext 接受 gateOptions
  - `src/engine/gate.ts` - 支持 autoApprove 和 timeout 自动通过
  - `src/__tests__/gate.test.ts` - 新增 6 个测试用例
  - lint/test/build 全部通过 (54 tests)
- **Task 1.3 完成**：输入参数系统
  - `src/types/index.ts` - RunState 新增 inputData 字段
  - `src/cli/run.ts` - 添加 --input-json 和 --input-file 选项
  - `src/engine/template.ts` - 支持 {{inputs.xxx}} 模板语法，含嵌套属性
  - `src/engine/workflow-engine.ts` - run() 方法接受 inputData 参数
  - `src/engine/state.ts` - initRun 支持 inputData 持久化
  - `src/__tests__/template.test.ts` - 新增 10 个测试用例
  - lint/test/build 全部通过 (64 tests)
- **Phase 1 完成** ✅
- **Task 2.1 完成**：进度显示增强
  - `src/types/index.ts` - 新增 TokenUsage 接口，StepState 添加 tokenUsage/durationMs
  - `src/runtime/llm-direct.ts` - 提取 prompt_tokens/completion_tokens/total_tokens
  - `src/engine/workflow-engine.ts` - 存储 tokenUsage 和 durationMs 到 StepState
  - `src/ui/progress.ts` - complete() 方法添加汇总统计展示
  - `src/i18n/locales/en.ts` 和 `zh.ts` - 新增 progressSummaryTotal 翻译
  - `src/__tests__/llm-direct.test.ts` - 新增 3 个测试用例
  - lint/test/build 全部通过 (67 tests)
- **Task 2.2 完成**：输出文件命名自定义
  - `src/types/index.ts` - 新增 OutputFileConfig 接口
  - `src/config/schema.ts` - 新增 OutputFileConfigSchema 和 files 数组验证，支持 step 引用校验
  - `src/output/writer.ts` - writeStepOutput 支持自定义文件名，支持子目录创建
  - `src/engine/workflow-engine.ts` - 添加 customFilename 模板解析逻辑，gate edit 也使用自定义文件名
  - `src/__tests__/schema.test.ts` - 新增 4 个 output.files 测试用例
  - `src/__tests__/writer.test.ts` - 新建测试文件，包含 8 个测试用例
  - lint/test/build 全部通过 (78 tests)
- **Task 2.3 完成**：Script Runtime
  - `src/types/index.ts` - RuntimeType 添加 'script'，AgentConfig.runtime.model 改为 optional，新增 script 字段
  - `src/config/schema.ts` - AgentConfigSchema 支持 script 配置和 superRefine 验证
  - `src/runtime/script.ts` - 新建 ScriptRuntime 实现，支持内联脚本和文件脚本
  - `src/runtime/factory.ts` - 注册 script 类型，签名变更接受 agentConfig 参数
  - `src/engine/workflow-engine.ts` - RuntimeFactory 类型更新，传递 agent 参数
  - `src/cli/agents.ts` - 处理 optional model 字段显示
  - `src/__tests__/script-runtime.test.ts` - 新建测试文件，包含 15 个测试用例
  - `src/__tests__/runtime-factory.test.ts` - 新增 script 类型测试
  - `src/__tests__/schema.test.ts` - 新增 6 个 script agent 测试用例
  - lint/test/build 全部通过 (101 tests)
- **Phase 2 完成** ✅
- **Task 3.2 完成**：DAG 可视化命令
  - `src/ui/dag-visualizer.ts` - 新建 DAG ASCII 可视化渲染器
  - `src/cli/dag.ts` - 新建 dag 子命令
  - `src/cli/index.ts` - 注册 dag 命令
  - `src/i18n/locales/en.ts` 和 `zh.ts` - 新增 dag 相关翻译
  - `src/__tests__/dag-visualizer.test.ts` - 新建测试文件，包含 8 个测试用例
  - lint/test/build 全部通过 (109 tests)
- **Task 3.3 完成**：配置验证增强
  - `src/config/validator.ts` - 新建 ConfigValidator 类，实现 5 种验证规则
  - `src/cli/validate.ts` - 添加 --verbose/-v 选项，集成高级验证
  - `src/i18n/locales/en.ts` 和 `zh.ts` - 新增验证相关翻译
  - `src/__tests__/validator.test.ts` - 新建测试文件，包含 12 个测试用例
  - lint/test/build 全部通过 (121 tests)
- **Task 3.4 完成**：步骤输出缓存
  - `src/engine/cache.ts` - 新建 StepCache 类，支持 SHA256 key 计算、TTL 检查
  - `src/types/index.ts` - 新增 CacheConfig 接口，扩展 EventType
  - `src/config/schema.ts` - 新增 CacheConfigSchema，支持 workflow 和 step 级别配置
  - `src/engine/workflow-engine.ts` - 集成缓存逻辑，命中时跳过 runtime 调用
  - `src/cli/cache.ts` - 新建 cache clear/stats 子命令
  - `src/cli/shared.ts` - 添加 cache 到 engine deps
  - `src/__tests__/cache.test.ts` - 新建测试文件，包含 14 个测试用例
  - lint/test/build 全部通过 (139 tests)
- **Task 3.5 完成**：错误恢复策略
  - `src/types/index.ts` - 新增 OnFailureAction, NotifyConfig 接口，扩展 StepConfig
  - `src/config/schema.ts` - 新增 OnFailureActionSchema, NotifyConfigSchema，superRefine 验证 fallback_agent
  - `src/output/notifier.ts` - 新建 webhook 通知功能
  - `src/engine/workflow-engine.ts` - 实现 skip/fallback/fail 三种错误恢复策略
  - `src/__tests__/error-recovery.test.ts` - 新建测试文件，包含 9 个测试用例
  - `src/__tests__/schema.test.ts` - 新增 8 个 on_failure/notify 测试用例
  - lint/test/build 全部通过 (156 tests)
- **Phase 3 完成** ✅
- **Task 4.1 完成**：项目初始化模板扩展
  - 重构 `templates/` 目录结构，将原有模板移入 `templates/default/`
  - 新增 `templates/chatbot/` 聊天机器人模板（chatbot agent + conversation workflow）
  - 新增 `templates/web-scraper/` 网页抓取模板（content_extractor + summarizer agents）
  - 新增 `template.json` 元数据文件（支持中英文名称和描述）
  - 更新 `src/cli/init.ts` 支持 `--template <name>` 选择模板
  - 更新 `src/cli/init.ts` 支持 `--list-templates` 列出所有可用模板
  - 新增 `src/__tests__/init-templates.test.ts` 包含 13 个测试用例
  - lint/test/build 全部通过 (169 tests)

---

## Phase 4：生态建设（长期）

### Task 4.1：项目初始化模板扩展
- **状态**：✅ 已完成
- **工时**：2 天
- **复杂度**：中
- **改动文件**：
  - `templates/default/` - 重构默认模板目录结构
  - `templates/chatbot/` - **新建**聊天机器人模板
  - `templates/web-scraper/` - **新建**网页抓取模板
  - `templates/*/template.json` - **新建**模板元数据文件
  - `src/cli/init.ts` - 支持 --template 和 --list-templates 选项
  - `src/i18n/locales/en.ts` 和 `zh.ts` - 新增模板相关翻译
- **测试文件**：`src/__tests__/init-templates.test.ts`
- **完成标记**：
  - [x] npm run lint 通过
  - [x] npm test 通过 (169 tests)
  - [x] npm run build 成功

### Task 4.2：Agent 模板库
- **状态**：⏭️ 跳过
- **原因**：功能与 4.1 重复，用户可直接通过模板系统获取完整 agent

### Task 4.3：Workflow 市场
- **状态**：⏭️ 跳过
- **原因**：功能与 4.1 重复，用户可直接通过模板系统获取完整 workflow

---

**Phase 4 完成** ✅（跳过 4.2/4.3）

---

## Web UI MVP（T1-T24）

> 时间：2026-03-20

### Task T1：Web UI 工程骨架
- **状态**：✅ 已完成
- **改动文件**：
  - `web/package.json` - Vite + React + TypeScript 依赖
  - `web/vite.config.ts` - Vite 配置，含 API 代理
  - `web/tsconfig*.json` - TypeScript 配置
  - `web/tailwind.config.js` - Tailwind CSS 配置
  - `web/postcss.config.js` - PostCSS 配置
  - `web/index.html` - HTML 入口
  - `web/src/main.tsx` - React 入口
  - `web/src/App.tsx` - 路由配置
  - `web/src/index.css` - 全局样式与设计 token
  - `web/src/components/Layout.tsx` - 页面布局与导航
- **完成标记**：
  - [x] npm run build 成功
  - [x] 前端开发服务可启动

### Task T10：前端设计 token 与主题系统
- **状态**：✅ 基本完成
- **改动文件**：
  - `web/src/index.css` - CSS 变量定义（color, spacing, typography）
- **完成标记**：
  - [x] 全局样式一致

### Task T11-T18：前端页面
- **状态**：✅ 已完成
- **改动文件**：
  - `web/src/pages/HomePage.tsx` - 首页
  - `web/src/pages/WorkflowsPage.tsx` - 工作流列表页
  - `web/src/pages/WorkflowRunPage.tsx` - 工作流运行表单
  - `web/src/pages/RunsPage.tsx` - 运行历史页
  - `web/src/pages/RunDetailPage.tsx` - 运行详情页（含 SSE 实时事件）
  - `web/src/pages/SettingsPage.tsx` - 设置页
- **API 层**：
  - `web/src/api/index.ts` - API 客户端封装
- **Hooks**：
  - `web/src/hooks/useApi.ts` - 数据获取 hook
- **完成标记**：
  - [x] 页面结构完整

### Task T19：i18n 基础接入
- **状态**：✅ 已完成
- **改动文件**：
  - `web/src/i18n/index.tsx` - i18n provider 与翻译函数
- **完成标记**：
  - [x] 中英文切换功能可用

### Task T20：中英文文案覆盖
- **状态**：✅ 已完成
- **改动文件**：
  - `web/src/i18n/index.tsx` - 完整中英文翻译（100+ keys）
  - `web/src/pages/RunDetailPage.tsx` - Token Usage、Duration、Gate 等翻译
  - `web/src/pages/SettingsPage.tsx` - Environment、Theme 等翻译
  - `web/src/pages/WorkflowsPage.tsx` - Eval enabled 翻译
- **完成标记**：
  - [x] 所有页面文案使用 i18n key

### Task T21：响应式与视觉打磨
- **状态**：✅ 已完成
- **改动文件**：
  - `web/src/index.css` - 设计 token、CSS 组件类、动画
  - `web/src/components/Layout.tsx` - 移动端响应式导航
  - `web/src/pages/HomePage.tsx` - 空状态、loading 状态、卡片响应式
  - `web/src/pages/WorkflowsPage.tsx` - 响应式网格布局
  - `web/src/pages/RunsPage.tsx` - 桌面表格/移动端卡片双视图
  - `web/src/pages/RunDetailPage.tsx` - 响应式详情布局
  - `web/src/pages/SettingsPage.tsx` - 响应式设置页
  - `web/src/pages/WorkflowRunPage.tsx` - JSON 实时校验
- **完成标记**：
  - [x] 移动端布局正常
  - [x] 空状态、loading 状态完善
  - [x] 视觉风格统一

### Task T22：后端测试补齐
- **状态**：✅ 已完成
- **改动文件**：
  - `src/__tests__/web-router.test.ts` - Web 路由测试
  - `src/__tests__/app-services.test.ts` - Service 层测试
- **完成标记**：
  - [x] Web 路由核心功能测试
  - [x] Service 层 mock 测试
  - [x] npm test 通过 (262 tests)

### Task T23：前端交互测试
- **状态**：✅ 已完成
- **改动文件**：
  - `web/tests/smoke.spec.ts` - Playwright 冒烟测试
  - `web/playwright.config.ts` - Playwright 配置
- **npm 脚本**：
  - `npm run test:e2e` - 运行前端冒烟测试
- **完成标记**：
  - [x] 基础页面加载测试
  - [x] 导航功能测试
  - [x] 语言切换测试

### Task T24：启动脚本与文档整合
- **状态**：✅ 已完成
- **改动文件**：
  - `package.json` - 新增 web:dev, web:build, web:start, web 脚本
  - `README.md` - 新增 Web UI 章节，包含启动说明和 API 文档
- **完成标记**：
  - [x] README 包含 Web UI 启动说明
  - [x] API 端点文档完整

---

## Web UI MVP 完成总结

**Web UI MVP 所有任务已完成（T1-T24）**

| 任务组 | 状态 |
|--------|------|
| T1 工程骨架 | ✅ |
| T2 Service 层（之前完成） | ✅ |
| T3 Web Server（之前完成） | ✅ |
| T4 Gate Web 化（之前完成） | ✅ |
| T5 SSE 事件流（之前完成） | ✅ |
| T6-T9 API（之前完成） | ✅ |
| T10 设计 token | ✅ |
| T11-T18 页面 | ✅ |
| T19 i18n | ✅ |
| T20 文案覆盖 | ✅ |
| T21 视觉打磨 | ✅ |
| T22 后端测试 | ✅ |
| T23 前端测试 | ✅ |
| T24 文档整合 | ✅ |

**最终验收状态：**
- ✅ npm test: 262 tests passed
- ✅ npm run build: TypeScript 编译成功
- ✅ npm run lint: 无 lint 错误
- ✅ 前端构建: npm run build (web/) 成功

**Web UI 启动方式：**
```bash
# 终端 1：启动后端 API 服务
npm run web

# 终端 2：启动前端开发服务器
npm run web:dev

# 访问 http://localhost:5173
```

---

## 备注

- 详细规格见 `/Users/zhaiyang/projects/openAgents/docs/DEVELOPMENT-PLAN.md`
- 功能路线图见 `/Users/zhaiyang/projects/openAgents/docs/FEATURE-ROADMAP.md`
- 项目指南见 `/Users/zhaiyang/projects/openAgents/CLAUDE.md`
