# OpenAgents 本期交接文档

> 生成时间：2026-03-25
> 本期主题：复盘与演进（聚焦版）

---

## 一、本期完成情况

### 7 个任务全部交付

| 任务 | 负责人 | 状态 | 核心交付 |
|------|--------|------|---------|
| E1 运行版本快照与关联基线 | backend-engineer | ✅ 完成 | `RunState` 新增 `workflowSnapshot` / `sourceRunId` / `recoveryInfo`，运行时捕获配置快照 |
| E2 版本差异视图 | backend-engineer | ✅ 完成 | `WorkflowConfigDiff` / `NodeConfigDiff` / `ChangeImpactType`，compare 升级为配置差异解释 |
| E3 历史趋势分析 | frontend-engineer | ✅ 完成 | HomePage / WorkflowOverviewPage / RunsPage 添加质量趋势摘要入口 |
| E4 失败 run 复盘摘要 | backend-engineer | ✅ 完成 | `failureRecap` / `sourceRunInfo`，`computeFailureRecap` |
| E5 复盘链路联动收口 | frontend-engineer | ✅ 完成 | 统一入口 / recovered run 跳转 / Recovery Context 面板 / `failureRecap.insight` |
| E6 测试补强 | qa-engineer | ✅ 完成 | **530 测试通过**，新增 `recovery-planner.test.ts` + `review-chain.integration.test.ts` |
| E7 聚合层整理 | architect | ✅ 完成 | Token 聚合统一 / DTO 分类标记 / 冗余包装函数删除 |

### 关键路径
```
E1 ✅ → E2 ✅ → E4 ✅ → E5 ✅
  ↘ E3 ✅ ───────────→ E6 ✅
                        E7 ✅
```

---

## 二、核心代码修改

### E1 - 运行版本快照（backend）
**文件**：
- `src/types/index.ts` — 新增 `WorkflowSnapshot` / `StepSnapshot` 类型，扩展 `RunState`
- `src/engine/state.ts` — `initRun()` 接受可选 `workflowSnapshot` 参数
- `src/engine/workflow-engine.ts` — `buildWorkflowSnapshot()` 运行时捕获快照

**新增字段**：
```typescript
// RunState
workflowSnapshot: WorkflowSnapshot  // versionHash + steps[]
sourceRunId?: string
recoveryInfo?: RecoveryInfo
```

### E2 - 版本差异视图（backend）
**文件**：
- `src/app/dto.ts` — 新增 `ChangeImpactType` / `NodeConfigDiff` / `WorkflowConfigDiff` 类型
- `src/app/services/run-compare-service.ts` — 新增 `computeWorkflowConfigDiff()` / `computeNodeConfigDiff()` / `isPromptChangeSignificant()`

**核心逻辑**：
- `ChangeImpactType`: `execution_path` / `output_risk` / `both` — 区分差异影响类型
- `computeWorkflowConfigDiff`: 比较 versionHash、节点增删、节点配置变化
- `isPromptChangeSignificant`: 基于长度差异和词汇重叠率判断 prompt 变化显著性

### E3 - 历史趋势分析（frontend）
**文件**：
- `web/src/pages/HomePage.tsx` — 添加 Quality Trends section
- `web/src/pages/WorkflowOverviewPage.tsx` — 添加质量趋势摘要
- `web/src/pages/RunsPage.tsx` — 添加 Quality Trends banner

### E4 - 失败 run 复盘摘要（backend）
**文件**：
- `src/app/dto.ts` — `DiagnosticsSummaryDto` 新增 `failureRecap` / `sourceRunInfo`
- `src/app/services/diagnostics-service.ts` — 新增 `computeFailureRecap()` / `computeSourceRunInfo()`

**新增字段**：
```typescript
failureRecap: {
  summary: string
  primaryErrorType: string
  totalAffectedNodes: number
  blocksExecution: boolean
  insight: string
}
sourceRunInfo: {
  sourceRunId: string
  relationship: 'recover' | 'rerun' | 'rerun_with_edits'
  reusedStepCount: number
  rerunStepCount: number
}
```

### E5 - 复盘链路联动收口（frontend）
**文件**：
- `web/src/pages/RunDetailPage.tsx` — 失败 run 添加 Diagnostics/Compare 入口，Recovery Context 面板
- `web/src/pages/RunComparisonPage.tsx` — run 卡片显示 recoveredFrom 链接
- `web/src/pages/RunExecutionPage.tsx` — 失败 run 显示 Diagnostics/Compare 快捷按钮
- `web/src/api/index.ts` — 前端 `DiagnosticsSummary` 类型补充新字段

### E6 - 测试补强（qa）
**文件**：
- `src/__tests__/recovery-planner.test.ts` — 23 tests
- `src/__tests__/review-chain.integration.test.ts` — 14 tests
- **总计：530 测试通过**

### E7 - 聚合层整理（architect）
**文件**：
- `src/app/dto.ts` — TokenUsage re-export / RecoveryOptions 废弃注释 / DTO 分类标记（Snapshot/Trend/Recap）
- `src/app/services/run-metrics.ts` — 新增 `aggregateTokenUsageOptional()` 统一入口
- `run-compare-service.ts` — 删除冗余 `sumTokenUsage()`
- `run-visual-service.ts` — 删除冗余 `calculateTotalTokenUsage()`
- `run-service.ts` — 删除冗余 `calculateTotalTokenUsage()`
- `DiagnosticsSnapshotDto` / `RunFailureAnalysisDto` 新类型定义

**DTO 分类**：
- Snapshot DTOs: `RunSummaryDto`, `RunDetailDto`, `RunVisualStateDto`, `DiagnosticsSnapshotDto`
- Trend DTOs: `WorkflowQualitySummary`, `QualityRunSummary`, `RunCostSummary`
- Recap DTOs: `RunComparisonDto`, `DiagnosticsSummaryDto`, `RecoveryPreviewDto`, `RunFailureAnalysisDto`

---

## 三、验收标准达成

| 标准 | 状态 |
|------|------|
| 用户可知道 run 来自哪版 workflow 和关键配置 | ✅ |
| 前后端不再各自推断版本来源 | ✅ |
| rerun / recover 版本承接关系清楚 | ✅ |
| compare 可说明变化可能影响的范围 | ✅ |
| 差异结果在页面和 API 中口径一致 | ✅ |
| 用户能看出某个 workflow 最近是变好还是变差 | ✅ |
| 关键指标在不同页面不各算一套 | ✅ |
| 失败复盘摘要基于结构化数据而非无来源文本 | ✅ |
| diagnostics 可直接引导下一步动作 | ✅ |
| 用户不需要自己拼复盘路径 | ✅ |
| 至少一条完整复盘主链路有自动化覆盖 | ✅ |
| 版本差异和趋势口径回归可及时发现 | ✅ |

---

## 四、待处理事项（P2 范围外，不阻塞本期）

| 事项 | 优先级 | 说明 |
|------|--------|------|
| `recoveryScope` 从 `DiagnosticsSummaryDto` 移至 `RecoveryPreviewDto` | P2 | 涉及 API 变化，建议下期 E5 联动时处理 |
| 前后端 TokenUsage 类型共享（当前各自独立维护） | P3 | 需要改构建或引入共享包，超出本期范围 |
| `evalSummary` 占位符（始终返回 undefined） | P2 | 需与 eval runner 集成 |

---

## 五、下期建议起点

根据 `docs/future/THREE-ITERATIONS-ROADMAP.md`，三期的依赖关系：

```
Iteration 1（收口与加固）→ Iteration 2（恢复与观测）→ Iteration 3（复盘与演进）✅
```

本期（Iteration 3）已完成。下期方向建议：
- 巩固本期新增的版本快照、差异、趋势、复盘能力
- 或进入下一组优先级更高的功能

下期任务文档存放于 `docs/future/`，可按需启动新团队继续开发。

---

## 六、团队成员（本期）

| 角色 | 名称 | 贡献 |
|------|------|------|
| 产品经理 | product-manager | 需求分析、任务跟踪 |
| 前端工程师 | frontend-engineer | E3、E5 |
| 后端工程师 | backend-engineer | E1、E2、E4 |
| 测试工程师 | qa-engineer | E6 |
| 技术总监 | architect | E7 架构评审与整理 |
