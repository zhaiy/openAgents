# OpenAgents Feature Requests

**整理日期**: 2026-03-17  
**来源**: 实际使用反馈（小说续写场景）

---

## FR-001: API URL 全路径支持

### 优先级
🔴 高

### 问题描述

当前实现采用 URL 拼接方式：

```typescript
// 当前代码
fetch(`${this.baseUrl}/v1/chat/completions`, ...)
```

这导致以下问题：

1. **不同 API 提供商路径格式不同**
   - DashScope 标准：`.../compatible-mode/v1/chat/completions`
   - DashScope Coding：`.../v1/chat/completions`
   - OpenAI：`.../v1/chat/completions`

2. **用户难以预测正确的 baseUrl**
   - 需要查阅文档才知道正确的端点格式
   - 配置错误导致 404 或其他错误

3. **调试困难**
   - 错误信息不明确
   - 用户不知道实际请求的 URL 是什么

### 建议方案

支持两种配置方式：

```yaml
runtime:
  # 方式 1：完整 URL（推荐）
  api_base_url: https://coding.dashscope.aliyuncs.com/v1/chat/completions
  
  # 方式 2：base URL（向后兼容）
  api_base_url: https://api.openai.com
  # 代码自动拼接 /v1/chat/completions
```

### 实现逻辑

```typescript
// src/runtime/llm-direct.ts

private resolveApiUrl(baseUrl: string): string {
  // 如果 URL 已经包含 /chat/completions，直接使用
  if (baseUrl.includes('/chat/completions')) {
    return baseUrl;
  }
  
  // 移除末尾斜杠，拼接标准路径
  const normalized = baseUrl.replace(/\/+$/, '');
  return `${normalized}/v1/chat/completions`;
}
```

### 兼容性

- ✅ 向后兼容现有配置
- ✅ 支持 OpenAI、DashScope、Azure 等所有提供商
- ✅ 用户完全可控

### 工作量

低 - 只需修改 `llm-direct.ts` 中的 URL 处理逻辑

---

## FR-002: 可配置后置内容处理器（脚本）

### 优先级
🟡 中

### 问题描述

在实际使用中，核心痛点是**步骤输出不可控**，导致下游步骤上下文过大或格式不适配：

1. **输出体积过大**
   - `load_context` 输出 9000+ 字
   - 直接传给下一步会引发 token 膨胀

2. **精简方式高度场景化**
   - 有的场景要提取 JSON 字段
   - 有的场景要截断、清洗、脱敏
   - 这些规则很难靠少量内置处理器覆盖

3. **需要用户自定义能力**
   - 不希望每增加一种精简逻辑都改引擎代码
   - 希望通过配置脚本完成后置处理

### 建议方案

在 step 中优先支持**后置处理器**，并允许用户通过脚本定义内容过滤规则：

```yaml
workflow:
  id: novel_writing
  steps:
    - id: load_context
      agent: context_loader
      post_processors:
        - type: script
          name: shrink_context
          command: "node scripts/shrink-context.mjs"
          timeout_ms: 5000
          on_error: "fail" # fail | skip | passthrough

    - id: plot_designer
      agent: plot_architect
      depends_on: [load_context]
```

### 脚本规范（建议 v1）

#### 1) 输入协议

- 引擎将上一步原始输出以 **UTF-8 文本**写入脚本 `stdin`
- 同时通过环境变量提供上下文：
  - `OA_RUN_ID`
  - `OA_WORKFLOW_ID`
  - `OA_STEP_ID`
  - `OA_PROCESSOR_NAME`

#### 2) 输出协议

- 脚本必须将处理后的最终内容写到 `stdout`
- `stdout` 全部内容作为该 step 的最终输出，传递给下游步骤
- `stderr` 仅用于日志，不参与数据传递

#### 3) 退出码与错误策略

- `exit code = 0`：处理成功
- `exit code != 0`：处理失败，按 `on_error` 执行
  - `fail`：当前 step 失败（默认）
  - `skip`：跳过该处理器，保留原始输出
  - `passthrough`：记录错误并透传原始输出

#### 4) 资源限制（默认）

- `timeout_ms`: 默认 `5000`
- `max_output_chars`: 默认 `20000`（防止脚本无限输出）
- 超时或超限视为失败，按 `on_error` 处理

#### 5) 安全边界

- 脚本以子进程执行，不直接访问引擎内部对象
- 不注入敏感密钥；仅注入必要上下文环境变量
- 文档中明确：生产环境建议使用受信任脚本并做好审计

### 脚本示例

`scripts/shrink-context.mjs`:

```javascript
import { stdin, stdout, stderr } from 'node:process';

let input = '';
stdin.setEncoding('utf8');
stdin.on('data', chunk => {
  input += chunk;
});

stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const context = String(data.context ?? input);
    const compact = context.slice(0, 4000);
    stdout.write(compact);
  } catch (err) {
    stderr.write(`shrink-context failed: ${String(err)}\n`);
    process.exit(1);
  }
});
```

### 执行流程

```
步骤输入
    │
    ▼
┌─────────────────┐
│   Agent 执行     │
│  (LLM/Script)   │
└────────┬────────┘
         │ 原始输出
         ▼
┌─────────────────┐
│ Post Processors │
│  (user script)  │
└────────┬────────┘
         │ 处理后输出
         ▼
      步骤输出
```

### 类型定义

```typescript
// src/types/index.ts

type ProcessorErrorMode = 'fail' | 'skip' | 'passthrough';

interface ScriptPostProcessorConfig {
  type: 'script';
  name?: string;
  command: string; // e.g. "node scripts/shrink-context.mjs"
  timeout_ms?: number;
  max_output_chars?: number;
  on_error?: ProcessorErrorMode;
}

interface StepConfig {
  id: string;
  agent: string;
  task: string;
  depends_on?: string[];
  post_processors?: ScriptPostProcessorConfig[];
  // ... 其他字段
}
```

### 实现示例

```typescript
// src/engine/post-processor.ts
import { spawn } from 'node:child_process';

export async function runScriptPostProcessor(
  input: string,
  config: {
    command: string;
    timeout_ms?: number;
    max_output_chars?: number;
  },
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const timeout = config.timeout_ms ?? 5000;
  const maxOutput = config.max_output_chars ?? 20000;

  const child = spawn(config.command, {
    env,
    shell: true,
    stdio: 'pipe',
  });

  child.stdin.write(input, 'utf8');
  child.stdin.end();

  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
    if (stdout.length > maxOutput) {
      child.kill('SIGKILL');
    }
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`post-processor timeout: ${timeout}ms`));
    }, timeout);
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });

  if (stdout.length > maxOutput) {
    throw new Error(`post-processor output too large: ${stdout.length}`);
  }
  if (exitCode !== 0) {
    throw new Error(`post-processor exited with code ${exitCode}`);
  }
  return stdout;
}
```

### 工作量

中 - 需要新增脚本执行器、更新 schema、补充错误策略与测试

---

## 实施建议

### Phase 1（立即）

- [x] 实现 FR-001: API URL 全路径支持
- 工作量：低
- 价值：高
- 文件：`src/runtime/llm-direct.ts`

### Phase 2（后续）

- [ ] 定义 post_processor 脚本协议（stdin/stdout/env）
- [ ] 实现脚本执行器（timeout、输出上限、错误策略）
- [ ] 更新 workflow schema（`post_processors`）
- [ ] 添加单元测试
  - [ ] 成功路径
  - [ ] 脚本退出码非 0
  - [ ] 超时
  - [ ] 输出超限
- [ ] 更新文档

---

## 附录：使用场景示例

### 场景 1：小说续写 - 精简上下文

```yaml
steps:
  - id: load_context
    agent: context_loader
    post_processors:
      - type: script
        command: "node scripts/shrink-context.mjs"
        timeout_ms: 5000
        on_error: fail
```

### 场景 2：数据分析 - 提取关键字段

```yaml
steps:
  - id: analyze
    agent: data_analyzer
    post_processors:
      - type: script
        command: "python3 scripts/extract_summary.py"
        on_error: passthrough
```

### 场景 3：合规处理 - 脱敏后下发

```yaml
steps:
  - id: legal_filter
    agent: reviewer
    post_processors:
      - type: script
        command: "node scripts/redact-sensitive.mjs"
        on_error: fail
```

---

*文档版本：1.1*  
*最后更新：2026-03-17*