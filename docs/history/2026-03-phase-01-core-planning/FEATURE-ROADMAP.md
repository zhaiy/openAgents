# OpenAgents 功能优化需求文档

> 整理时间：2026-03-16
> 基于实际使用反馈（小说续写场景）

---

## 一、功能增强

### 1.1 输入参数系统 🔴 高优先级

**现状**：模板只支持 `{{input}}` 字符串，不支持命名参数

**需求**：

```yaml
# CLI 调用
openagents run novel_writing --input-json '{
  "novel_name": "新笔仙",
  "chapter": 4,
  "context_chapters": 3
}'

# workflow 中使用
steps:
  - id: plot_designer
    task: |
      续写《{{inputs.novel_name}}》第{{inputs.chapter}}章
      读取前{{inputs.context_chapters}}章作为上下文
```

**收益**：
- 结构化输入，避免字符串拼接
- 模板更清晰易读
- 支持类型校验（number/string/boolean）

---

### 1.2 Script Runtime 类型 🟡 中优先级

**现状**：`runtime.type` 只支持 LLM 调用类型

**需求**：

```yaml
# agent 定义
agent:
  id: file_reader
  name: 文件读取器
  type: script
  script: scripts/prepare-context.js
  # 或内联脚本
  script: |
    const fs = require('fs');
    return fs.readFileSync(path, 'utf-8');
```

```yaml
# workflow 中使用
steps:
  - id: load_context
    agent: file_reader
    inputs:
      path: "{{inputs.chapters_dir}}/{{inputs.novel_name}}"
```

**收益**：
- 支持文件读取、数据处理等预处理
- 减少外部脚本依赖
- 工作流更完整

---

### 1.3 自动加载 .env 文件 🟡 中优先级

**现状**：需要手动在 `openagents.yaml` 配置 API key

**需求**：

```bash
# 项目目录下的 .env 文件自动加载
OPENAGENTS_API_KEY=sk-xxx
OPENAGENTS_API_BASE_URL=https://api.example.com
```

**收益**：
- 配置更灵活
- 支持多环境（.env.dev, .env.prod）
- 敏感信息不进入版本控制

---

## 二、用户体验

### 2.1 Gate 自动通过选项 🟡 中优先级

**现状**：Gate 需要手动输入确认

**需求**：

```bash
# CLI 选项
openagents run xxx --auto-approve          # 自动通过所有 gate
openagents run xxx --gate-timeout 30       # 30秒无操作自动通过
openagents run xxx --gate approve-only     # 只对 approve 类型自动通过
```

**收益**：
- 测试更方便
- 自动化场景支持（CI/CD）

---

### 2.2 输出文件命名自定义 🟢 低优先级

**现状**：输出文件名固定为 `<step_id>.md`

**需求**：

```yaml
# workflow 定义
output:
  directory: "./output/{{workflow.id}}/{{run.id}}"
  files:
    - step: plot_designer
      filename: "02-剧情规划.md"
    - step: chapter_writer
      filename: "第{{inputs.chapter}}章.md"
    - step: chapter_reviewer
      filename: "04-审核意见.md"
```

**收益**：
- 输出文件名符合业务语义
- 支持动态命名

---

### 2.3 进度显示增强 🟢 低优先级

**现状**：进度 UI 基础，显示步骤状态

**需求**：

```
=== 小说章节续写 ===
Run ID: run_20260316_205116

✅ [1/3] plot_designer (113s, 2,847 tokens)
✅ [2/3] chapter_writer (81s, 4,521 tokens)  
✅ [3/3] chapter_reviewer (99s, 1,203 tokens)

📊 总计: 293s | 8,571 tokens | ¥0.12
```

**收益**：
- token 消耗可视化
- 成本估算
- 性能分析

---

## 三、开发者体验

### 3.1 模板调试命令 🟢 低优先级

**需求**：

```bash
# 预览模板渲染结果
openagents debug template \
  --workflow novel_writing \
  --input '{"novel_name":"新笔仙","chapter":4}'

# 输出渲染后的 task 内容
```

**收益**：
- 快速验证模板语法
- 减少试错成本

---

### 3.2 配置验证增强 🟢 低优先级

**需求**：

```bash
openagents validate --verbose

# 输出示例
✅ openagents.yaml
✅ workflows/novel_writing.yaml
⚠️  agents/writer.yaml
   - model "qwen-coder-plus" may not support creative writing
   - timeout_seconds (180) is low for 3000+ word generation
❌ agents/reviewer.yaml
   - missing required field: prompt.system
```

**收益**：
- 配置问题提前发现
- 最佳实践提示

---

### 3.3 项目初始化模板 🟢 低优先级

**需求**：

```bash
# 从模板创建项目
openagents init my-novel --template novel-writing
openagents init my-chatbot --template chatbot
openagents init my-crawler --template web-scraper

# 列出可用模板
openagents init --list-templates
```

**收益**：
- 快速启动新项目
- 最佳实践模板

---

## 四、架构改进

### 4.1 步骤输出缓存 🟢 低优先级

**需求**：

```yaml
# workflow 定义
cache:
  enabled: true
  ttl: 3600  # 1小时有效
  key: "{{inputs.novel_name}}-{{inputs.chapter}}"
```

**收益**：
- 重复运行节省成本
- 开发调试更快

---

### 4.2 并行步骤可视化 🟢 低优先级

**现状**：DAG 支持依赖解析，但未显示并行机会

**需求**：

```bash
openagents dag novel_writing --visualize

# 输出
┌─────────┐     ┌─────────┐
│ Step A  │     │ Step B  │  ← 可并行
└────┬────┘     └────┬────┘
     │               │
     └───────┬───────┘
             ▼
       ┌─────────┐
       │ Step C  │  ← 依赖 A, B
       └─────────┘
```

**收益**：
- 性能优化参考
- 理解工作流结构

---

### 4.3 错误恢复策略 🟢 低优先级

**需求**：

```yaml
steps:
  - id: risky_step
    agent: writer
    on_failure: fallback  # 使用备用 agent
    fallback_agent: backup_writer
    
  - id: optional_step
    agent: reviewer
    on_failure: skip  # 失败时跳过，不影响后续
    
  - id: critical_step
    agent: publisher
    on_failure: notify
    notify:
      webhook: https://hooks.slack.com/xxx
```

**收益**：
- 容错能力增强
- 生产环境更稳定

---

## 五、生态建设

### 5.1 Agent 模板库 🟢 低优先级

**需求**：

```bash
# 安装预定义的 agent
openagents agent install writer-novel
openagents agent install coder-python
openagents agent install reviewer-code

# 发布自定义 agent
openagents agent publish ./agents/my-agent.yaml
```

**收益**：
- 知识共享
- 快速复用

---

### 5.2 Workflow 市场 🟢 低优先级

**需求**：

```bash
# 搜索 workflow
openagents workflow search novel

# 安装 workflow
openagents workflow install novel-writing

# 发布 workflow
openagents workflow publish ./workflows/my-workflow.yaml
```

**收益**：
- 社区贡献
- 场景模板化

---

## 六、优先级排序

### Phase 1 - 核心功能（1-2周）

| 功能 | 优先级 | 工作量 | 价值 |
|------|--------|--------|------|
| 输入参数系统 | 🔴 高 | 中 | 高 |
| .env 自动加载 | 🟡 中 | 低 | 中 |
| Gate 自动通过 | 🟡 中 | 低 | 中 |

### Phase 2 - 体验优化（2-4周）

| 功能 | 优先级 | 工作量 | 价值 |
|------|--------|--------|------|
| Script Runtime | 🟡 中 | 高 | 高 |
| 输出文件命名 | 🟢 低 | 中 | 中 |
| 进度显示增强 | 🟢 低 | 低 | 低 |

### Phase 3 - 生态建设（长期）

| 功能 | 优先级 | 工作量 | 价值 |
|------|--------|--------|------|
| Agent 模板库 | 🟢 低 | 高 | 高 |
| Workflow 市场 | 🟢 低 | 高 | 高 |
| 并行可视化 | 🟢 低 | 中 | 低 |

---

## 七、技术实现建议

### 输入参数系统实现思路

1. **扩展 CLI 参数解析**
   ```typescript
   // src/cli/run.ts
   .option('-i, --input <json>', 'JSON input')
   .option('--input-file <path>', 'Input JSON file')
   ```

2. **扩展 TemplateContext**
   ```typescript
   interface TemplateContext {
     input: string;           // 保持兼容
     inputs: Record<string, any>;  // 新增：结构化输入
     steps: Record<string, ...>;
     // ...
   }
   ```

3. **扩展模板语法**
   ```typescript
   // src/engine/template.ts
   // 支持 {{inputs.xxx}} 语法
   const inputMatch = expr.match(/^inputs\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
   if (inputMatch) {
     return context.inputs[inputMatch[1]] ?? '';
   }
   ```

---

## 八、参考

- 实际使用场景：小说续写 Skill
- 测试时间：2026-03-16
- 反馈来源：贾维斯（OpenClaw Agent）

---

*文档版本：1.0*
*最后更新：2026-03-16 22:00*