# OpenAgents 核心主链路场景矩阵

> 创建日期：2026-03-24
> 适用范围：`N2`、`N3`、`N4`、`N5`、`N6`、后续质检与验收
> 目标：用统一场景矩阵定义“主链路是否真实可用”

---

## 一、文档目的

主链路规划已经明确，但如果没有场景矩阵，模型很容易只完成“正常流”，漏掉刷新、重连、对象不存在、session 失效等真实使用场景。

因此，下一期所有主链路开发和质检，建议都以本文档为准。

---

## 二、核心链路定义

下一期核心链路定义为：

`启动运行 -> 执行观察 -> Gate 处理 -> 结束或失败 -> Diagnostics / Compare / Rerun`

其中：

- `启动运行` 对应配置、校验、预运行摘要
- `执行观察` 对应 visual state、timeline、SSE
- `Gate 处理` 对应等待、提交动作、恢复执行
- `结束或失败` 对应状态落定与反馈
- `Diagnostics / Compare / Rerun` 对应后续操作闭环

---

## 三、场景矩阵

| 编号 | 场景 | 优先级 | 必须支持 |
|------|------|------|------|
| S1 | 正常启动运行并成功完成 | P0 | 是 |
| S2 | 启动运行时输入非法 | P0 | 是 |
| S3 | 执行中进入 Gate waiting | P0 | 是 |
| S4 | Gate 处理后恢复执行并完成 | P0 | 是 |
| S5 | 某 step 执行失败，执行页正确呈现失败状态 | P0 | 是 |
| S6 | 失败后进入 Diagnostics 并看到失败点与影响面 | P1 | 是 |
| S7 | 基于失败 run 触发 rerun | P0 | 是 |
| S8 | 基于历史配置触发 edit-and-rerun | P1 | 是 |
| S9 | 执行页刷新后恢复当前状态 | P0 | 是 |
| S10 | SSE 断线后重连恢复状态 | P0 | 是 |
| S11 | run 不存在时统一反馈 | P0 | 是 |
| S12 | step 不存在时统一反馈 | P0 | 是 |
| S13 | draft 不存在时统一反馈 | P0 | 是 |
| S14 | compare session 失效时统一反馈 | P0 | 是 |
| S15 | compare 结果可读且可支持调优判断 | P1 | 是 |

---

## 四、各场景验收口径

## S1. 正常启动运行并成功完成

预期：

- 能完成输入校验
- 能创建 run
- 执行页能持续更新
- 最终状态落为 completed

需要验证：

- 列表页、详情页、执行页状态一致

## S2. 启动运行时输入非法

预期：

- 用户在启动前或启动时得到明确错误提示
- 不产生语义不清的失败状态

需要验证：

- 错误结构统一
- 前端不靠字符串猜测错误类型

## S3. 执行中进入 Gate waiting

预期：

- 执行页能明确显示 waiting 原因和节点
- timeline / visual state / inspector 一致

## S4. Gate 处理后恢复执行并完成

预期：

- gate action 提交成功
- 执行继续推进
- 状态从 waiting 回到 running 或 completed

## S5. 某 step 执行失败

预期：

- 失败节点清晰
- 失败状态在图、详情、timeline 上一致
- 页面有明确的下一步入口

## S6. 失败后进入 Diagnostics

预期：

- 能看到 failed node
- 能看到 downstream impact
- 能看到推荐动作

## S7. 基于失败 run 触发 rerun

预期：

- 能复用合理的历史输入
- 能创建新的 run
- 用户理解当前 rerun 的来源

## S8. edit-and-rerun

预期：

- 用户能看到关键差异
- 修改后能形成新的 rerun payload

## S9. 执行页刷新恢复

预期：

- 刷新后页面通过 snapshot 或等价机制恢复
- 关键节点状态、timeline、gate 状态不丢失

## S10. SSE 断线重连恢复

预期：

- 能按序恢复
- 不重复关键状态
- 不漏掉关键事件

## S11. run 不存在

预期：

- 返回统一错误结构
- 页面显示统一错误反馈

## S12. step 不存在

预期：

- step 详情或节点定位失败时有统一提示

## S13. draft 不存在

预期：

- rerun / edit-and-rerun 不会进入不可解释状态

## S14. compare session 失效

预期：

- 页面有统一降级提示
- 用户知道如何重新发起 compare

## S15. compare 可支持调优判断

预期：

- 不只是并排展示
- 至少能说明输入、关键节点、输出摘要三类差异

---

## 五、测试映射建议

| 场景 | 推荐测试类型 |
|------|------|
| S1-S5 | integration + route/service test |
| S6 | service test + page behavior test |
| S7-S8 | service test + page flow test |
| S9-S10 | SSE/integration test |
| S11-S14 | route test + smoke test |
| S15 | compare service test + page test |

---

## 六、质检重点

如果某次提交只覆盖以下内容，不能算通过主链路验收：

- 只覆盖正常流
- 只改页面不改契约
- 只补 service 单测不补链路测试
- 刷新恢复和重连恢复未验证
- 异常对象缺失场景未验证

---

## 七、完成标准

当以下条件同时满足时，才可以认为主链路达标：

1. `S1-S5` 全部通过
2. `S7-S10` 全部通过
3. `S11-S14` 至少具备统一错误结构与页面反馈
4. 至少一条链路被自动化测试完整覆盖
