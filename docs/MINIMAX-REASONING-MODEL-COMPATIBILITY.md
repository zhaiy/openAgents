# Issue: MiniMax 推理模型响应格式兼容性问题

**日期**: 2026-03-19  
**状态**: Open / 需要决策  
**优先级**: Medium  
**影响模块**: `src/runtime/llm-direct.ts`

---

## 问题描述

使用 MiniMax-M2.7 等推理模型时，OpenAgents 工作流失败，错误信息：

```
LLM response does not contain choices[0].message.content
```

### 根因分析

MiniMax 推理模型（如 MiniMax-M2.7）的 API 响应格式与标准 OpenAI 兼容格式不同：

**标准 OpenAI 格式**：
```json
{
  "choices": [{
    "message": {
      "content": "实际回复内容"
    }
  }]
}
```

**MiniMax 推理模型格式**：
```json
{
  "choices": [{
    "message": {
      "content": "",
      "reasoning_content": "推理过程+最终答案"
    }
  }]
}
```

推理模型将完整内容放在 `reasoning_content` 字段中，`content` 字段为空字符串。

### 验证测试

```bash
curl -X POST "https://api.minimaxi.com/v1/text/chatcompletion_v2" \
  -H "Authorization: Bearer <API_KEY>" \
  -d '{"model":"MiniMax-M2.7","messages":[{"role":"user","content":"Hi"}],"max_tokens":50}'
```

响应中 `content` 为空，`reasoning_content` 包含推理过程和回答。

---

## 影响范围

- 所有使用 MiniMax 推理模型的工作流
- 可能影响其他使用类似响应格式的推理模型（如果有）

---

## 解决方案

### 方案 1: 修改 LLMDirectRuntime 处理推理内容（推荐）

修改 `src/runtime/llm-direct.ts`，在解析响应时优先检查 `reasoning_content`：

```typescript
// 解析响应时
let output = message?.content;

// 如果 content 为空但有 reasoning_content，使用 reasoning_content
if (!output && message?.reasoning_content) {
  output = message.reasoning_content;
}
```

**优点**：
- 兼容 MiniMax 推理模型
- 向后兼容普通模型
- 不影响其他 provider

**缺点**：
- 需要修改核心 runtime 代码

### 方案 2: 使用非推理模型

切换到 MiniMax 的非推理模型（如 MiniMax-Text-01）。

**优点**：
- 无需代码修改

**缺点**：
- 模型能力可能不同
- 需要用户自行测试

### 方案 3: 添加 Provider 特定处理

在 `LLMDirectRuntime` 中根据 `baseUrl` 或新增配置项判断 provider，添加特殊处理逻辑。

**优点**：
- 可处理多种 provider 的特殊格式

**缺点**：
- 增加复杂度
- 需要维护 provider 列表

---

## 实施计划

1. **短期（方案 1）**：
   - 修改 `src/runtime/llm-direct.ts`
   - 添加 `reasoning_content` 回退逻辑
   - 测试验证

2. **长期**：
   - 考虑统一的响应标准化处理
   - 添加单元测试覆盖各种响应格式

---

## 相关文件

- `src/runtime/llm-direct.ts` - LLM 运行时实现
- `src/types/index.ts` - 类型定义
- `.env.example` - 环境变量配置示例

---

## 参考资料

- [MiniMax API 文档](https://platform.minimax.io/docs/api-reference/text-chat)
- [MiniMax-MCP GitHub](https://github.com/MiniMax-AI/MiniMax-MCP)
