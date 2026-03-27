# RFC: Per-Agent 大模型配置支持

| 字段 | 内容 |
|------|------|
| 状态 | Draft |
| 创建日期 | 2026-03-26 |
| 作者 | 翟扬 |
| 相关 Issue | - |

---

## 1. 背景与动机

### 1.1 当前限制

OpenAgents 当前所有 Agent 的 API 配置（API Key、API Base URL）只能在 `openagents.yaml` 的 `runtime` 级别统一设置：

```yaml
runtime:
  default_type: llm-direct
  default_model: qwen-plus
  api_key: xxx          # 全局共享
  api_base_url: xxx      # 全局共享
```

这导致：

- **多模型混用场景受限** — 例如 writer agent 用智谱 GLM-4，reviewer agent 用 qwen-plus，两者无法共存
- **第三方模型接入困难** — 每个 agent 可能需要独立的 API endpoint
- **成本管理不灵活** — 无法针对不同 agent 绑定不同的 API Key 以便分开计费

### 1.2 目标

在不破坏现有项目配置的前提下，允许在 `agents/*.yaml` 的 `runtime` 块中独立配置：

- `model` — 已支持（本次确认并完善）
- `api_key` — **新增**
- `api_base_url` — **新增**

实现 **agent 级别配置优先，project 级别配置兜底** 的合并策略。

---

## 2. 当前状态分析

### 2.1 已支持

| 配置项 | 级别 | 文件 |
|--------|------|------|
| `runtime.type` | agent | `agents/*.yaml` |
| `runtime.model` | agent | `agents/*.yaml` ✅ |
| `runtime.timeout_seconds` | agent | `agents/*.yaml` ✅ |

### 2.2 不支持（本次改动范围）

| 配置项 | 当前级别 | 目标级别 |
|--------|----------|----------|
| `runtime.api_key` | project | project + agent |
| `runtime.api_base_url` | project | project + agent |

### 2.3 代码调用链

```
workflow-engine.ts:531
  → runtimeFactory(agent.runtime.type, projectConfig, agent)
  → factory.ts: createRuntime()
  → LLMDirectRuntime({ apiKey, baseUrl })   // agentConfig 未传入
```

---

## 3. 需求详细说明

### 3.1 配置示例（目标）

**openagents.yaml（project 级别 — 兜底）**
```yaml
runtime:
  default_type: llm-direct
  default_model: qwen-plus
  api_key: proj-default-key
  api_base_url: https://api.example.com/v1
```

**agents/writer.yaml**
```yaml
agent:
  id: writer
  name: 写作助手

runtime:
  type: llm-direct
  model: glm-4         # 覆盖 default_model
  api_key: glm-key    # 覆盖 project api_key
  api_base_url: https://open.bigmodel.cn/api/paas/v4  # 覆盖 project base_url
  timeout_seconds: 300
```

**agents/reviewer.yaml**
```yaml
agent:
  id: reviewer
  name: 审稿编辑

runtime:
  type: llm-direct
  model: qwen-plus     # 使用 project default_model
  # api_key / api_base_url 不配置 → 继承 project 级别
```

### 3.2 配置合并规则

优先级（高 → 低）：

1. `agents/*.yaml` 中的 `runtime.api_key`
2. `agents/*.yaml` 中的 `runtime.api_base_url`
3. `openagents.yaml` 中的 `runtime.api_key`
4. `openagents.yaml` 中的 `runtime.api_base_url`
5. 环境变量 `OPENAGENTS_API_KEY`（作为最后的全局兜底）
6. 环境变量 `OPENAGENTS_API_BASE_URL`

> **注意**：`model` 和 `timeout_seconds` 的合并逻辑不变（agent 优先）。

### 3.3 Schema 变更

**src/config/schema.ts — `AgentConfigSchema` 修改**

```typescript
// 修改前
runtime: z.object({
  type: RuntimeTypeSchema,
  model: z.string().optional(),
  timeout_seconds: z.number().int().positive().default(300),
}),

// 修改后
runtime: z.object({
  type: RuntimeTypeSchema,
  model: z.string().optional(),
  api_key: z.string().optional(),
  api_base_url: z.string().url().optional(),
  timeout_seconds: z.number().int().positive().default(300),
}),
```

### 3.4 类型定义变更

**src/types/index.ts — `AgentConfig` 接口修改**

```typescript
// 修改前
runtime: {
  type: RuntimeType;
  model?: string;
  timeout_seconds: number;
};

// 修改后
runtime: {
  type: RuntimeType;
  model?: string;
  api_key?: string;
  api_base_url?: string;
  timeout_seconds: number;
};
```

### 3.5 Runtime Factory 变更

**src/runtime/factory.ts**

```typescript
// 修改前
case 'llm-direct':
  return new LLMDirectRuntime({
    apiKey: projectConfig.runtime.api_key,
    baseUrl: projectConfig.runtime.api_base_url,
  });

// 修改后
case 'llm-direct':
  return new LLMDirectRuntime({
    apiKey: agentConfig?.runtime.api_key ?? projectConfig.runtime.api_key,
    baseUrl: agentConfig?.runtime.api_base_url ?? projectConfig.runtime.api_base_url,
  });
```

### 3.6 LLMDirectRuntime 变更

**src/runtime/llm-direct.ts — 构造函数**

```typescript
// 修改前
constructor(config: LLMDirectRuntimeConfig) {
  const apiKey = process.env.OPENAGENTS_API_KEY || config.apiKey;
  if (!apiKey) { throw ... }
  this.apiKey = apiKey;
  this.baseUrl = process.env.OPENAGENTS_API_BASE_URL || config.baseUrl || DEFAULT_BASE_URL;
}

// 修改后（逻辑不变，但显式注入了 agent 级别的 key/url）
constructor(config: LLMDirectRuntimeConfig) {
  const apiKey = process.env.OPENAGENTS_API_KEY || config.apiKey;
  if (!apiKey) { throw ... }
  this.apiKey = apiKey;
  this.baseUrl = process.env.OPENAGENTS_API_BASE_URL || config.baseUrl || DEFAULT_BASE_URL;
}
```

> 注：`LLMDirectRuntime` 本身不需要大改，因为 `createRuntime` 已经把合并后的值传进去了。唯一要改的是 `factory.ts` 传递正确的参数。

---

## 4. 向后兼容性

- **无 breaking change** — 所有新增字段均为 `optional`
- 现有 `agents/*.yaml` 不受影响，未配置 `api_key` / `api_base_url` 的 agent 继续使用 project 级别或环境变量
- 现有测试 fixture 不需要修改

---

## 5. 测试计划

### 5.1 单元测试

| 测试用例 | 说明 |
|----------|------|
| agent 有独立 api_key | agent 级别 key 优先于 project 级别 |
| agent 有独立 api_base_url | agent 级别 url 优先于 project 级别 |
| agent 无独立配置 | fallback 到 project 级别 |
| agent + project 均无配置 | fallback 到环境变量 |
| 三者均无配置 | 抛出 RuntimeError |
| schema 验证 | 非法 url 格式被 Zod 拦截 |

### 5.2 集成测试

- 用两个不同 API endpoint 的 agent 跑一个简单 workflow，验证各自调用正确的 endpoint

---

## 6. 实施计划

### Phase 1: Schema + 类型（0.5h）
- [ ] 修改 `src/types/index.ts` — `AgentConfig.runtime` 添加 `api_key?` 和 `api_base_url?`
- [ ] 修改 `src/config/schema.ts` — 对应 Zod schema 更新
- [ ] 修改 `src/config/validator.ts` — 如有需要

### Phase 2: Factory 注入（0.5h）
- [ ] 修改 `src/runtime/factory.ts` — 将 agentConfig 的 key/url 透传给 `LLMDirectRuntime`

### Phase 3: 测试（1h）
- [ ] 新增/更新 `src/__tests__/factory.test.ts`
- [ ] 新增 `src/__tests__/loader.test.ts` 的 agent 配置合并用例
- [ ] 手动端到端验证

### Phase 4: 文档（0.5h）
- [ ] 更新 `CLAUDE.md` 的 Configuration System 章节
- [ ] 更新 `README.zh-CN.md` 配置示例

---

## 7. 扩展预留（不属于本次 scope）

以下为后续可能的扩展方向，本次 **不** 实现：

| 方向 | 说明 |
|------|------|
| per-agent rate limit | 针对不同 agent 设置不同的 QPS 上限 |
| per-agent credentials store | 从 1Password/Vault 等读取密钥，而非明文配置 |
| per-agent tool allowlist | 每个 agent 独立配置可用工具列表 |
| `opencode` / `openclaw` runtime 的 per-agent 配置 | 当前这两个 runtime 暂不支持，future work |

---

## 8. 参考文件

- `src/config/schema.ts` — Zod 配置 schema
- `src/types/index.ts` — TypeScript 类型定义
- `src/runtime/factory.ts` — Runtime 工厂
- `src/runtime/llm-direct.ts` — LLM Direct Runtime 实现
- `src/engine/workflow-engine.ts:531` — Runtime 实例化调用点
- `docs/future/NEXT-ITERATION-PLAN.md` — 项目迭代规划参考格式
