# Feature Request: Context Summary 专用模型配置

## 背景问题

当前 `context.summary_model` 只支持指定模型名称，但该模型的 API 凭证（`api_key`、`api_base_url`）必须与 Agent 运行时共享同一套配置。这意味着：

- 如果想用**不同提供商**的模型做摘要压缩（如 Agent 用 GLM-5，压缩用便宜的硅基流动 GLM-4），当前无法实现
- 实际上 `processContext` 调用的是同一个 `runtimeFactory` 创建的 runtime 实例，共享全局 `api_key` / `api_base_url`

## 现状代码

`src/engine/workflow-engine.ts` 第 506 行：

```typescript
const processedContent = await processContext({
  rawContent,
  strategy,
  maxTokens: max_tokens,
  autoThresholds: projectConfig.context ? {
    rawLimit: projectConfig.context.auto_raw_threshold ?? 500,
    truncateLimit: projectConfig.context.auto_truncate_threshold ?? 2000,
  } : undefined,
  summarizeRuntime: this.deps.runtimeFactory(agent.runtime.type, projectConfig, agent),
  // ↑ 复用了 agent 的 runtime type、api_key、base_url
  summarizeModel: projectConfig.context?.summary_model || agent.runtime.model || default_model,
});
```

`src/types/index.ts` 第 159-162 行：

```typescript
context?: {
  auto_raw_threshold: number;
  auto_truncate_threshold: number;
  summary_model?: string;  // ← 只有 model 名字
};
```

## 期望行为

```yaml
# project.yaml
context:
  auto_raw_threshold: 500
  auto_truncate_threshold: 2000
  summary_model: "glm-4-flash"
  summary_api_key: "your-api-key"
  summary_api_base_url: "https://api.example.com/v1"
```

当配置了 `summary_api_key` / `summary_api_base_url` 时，`processContext` 创建专用的 summary runtime 实例，而不是复用 agent 的 runtime。

## 建议方案

### 1. Schema 扩展

`src/config/schema.ts` — 在 `context` 对象中增加两个可选字段：

```typescript
context: z.object({
  auto_raw_threshold: z.number().int().positive().default(500),
  auto_truncate_threshold: z.number().int().positive().default(2000),
  summary_model: z.string().optional(),
  summary_api_key: z.string().optional(),
  summary_api_base_url: z.string().url().optional(),
}).optional(),
```

对应 `ProjectConfig.context` 类型同步更新。

### 2. processContext 签名调整

新增 `summaryApiKey?: string` 和 `summaryApiBaseUrl?: string` 参数，在 `summarize` 策略下创建独立 runtime：

```typescript
case 'summarize': {
  if (!summarizeRuntime || !summarizeModel) {
    throw new Error('summarize strategy requires summarizeRuntime and summarizeModel');
  }
  // 如果有独立的 summary 配置，创建专用 runtime
  const summaryRuntime = summaryApiKey && summaryApiBaseUrl
    ? runtimeFactoryForSummary(summaryApiKey, summaryApiBaseUrl, summarizeModel)
    : summarizeRuntime;
  // ... 使用 summaryRuntime 执行摘要
}
```

### 3. WorkflowEngine 调用处

传入独立的 API 凭证：

```typescript
const processedContent = await processContext({
  rawContent,
  strategy,
  maxTokens: max_tokens,
  autoThresholds: /* ... */,
  summarizeRuntime: this.deps.runtimeFactory(agent.runtime.type, projectConfig, agent),
  summarizeModel: projectConfig.context?.summary_model || agent.runtime.model || default_model,
  // 新增
  summaryApiKey: projectConfig.context?.summary_api_key,
  summaryApiBaseUrl: projectConfig.context?.summary_api_base_url,
});
```

### 4. 优先级建议

当 `summary_api_key` / `summary_api_base_url` 均未配置时，回退到当前行为（复用 agent runtime），保证向后兼容。

## 价值

- **成本优化**：压缩任务用便宜模型，节省 GLM-5 调用额度
- **灵活组合**：支持任意 provider 组合（GLM + 硅基流动 / DeepSeek + OpenAI 等）
- **向后兼容**：不配置独立凭证时行为不变

## 关联

- `src/engine/context-processor.ts` — `processContext` 函数
- `src/engine/workflow-engine.ts` — 调用处
- `src/types/index.ts` — 类型定义
- `src/config/schema.ts` — Schema 定义
