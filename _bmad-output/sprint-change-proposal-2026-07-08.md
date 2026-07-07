---
title: Sprint Change Proposal — 词云锁定近 30 天数据窗口
date: 2026-07-08
status: approved
---

# Sprint Change Proposal

## Section 1: Issue Summary

**问题陈述：** 词云当前的数据范围跟随 Discovery 页面的时间筛选器（全部/本周/本月/指定日期）。当用户选择"本周"或"本月"时，词云只统计那几天的日记，导致词频样本不足、关键词偏少且不稳定。用户希望词云**始终基于近 30 天的日记统计**，不受当前筛选器影响。

**发现时间：** 2026-07-08，词云功能体验阶段

**证据：** 用户原文——"词云目前就先统计近30天的关键词吧，无论筛选什么时间，都只显示近30天的"

---

## Section 2: Impact Analysis

### Epic 影响

| Epic | 影响 | 说明 |
|------|------|------|
| Epic 1（精简回顾岛） | ✅ 微调 | Story 1.3 增加验收标准：词云数据窗口锁定近 N 天 |
| Epic 2（更快记录入口） | ❌ 无 | 不相关 |
| Epic 3（双布局双模式） | ❌ 无 | 不相关 |
| Epic 4（语音日记） | ❌ 无 | 不相关 |

### CAP / Story 影响

| Artifact | 变更需求 |
|----------|----------|
| CAP-4（词云主题词） | 补充验收标准：词云数据采样范围为最近 30 天，不受时间筛选器影响 |
| Story 1.3（词云算法优化） | 增加一条验收标准 |

### 技术影响

- **范围：** 仅改 `src/services/database.ts` 一行（`shouldApplyRecentWindow` 条件从"仅全部时间时启用"改为"始终 true"）
- **风险：** 极低
- **向后兼容：** ✅ 完全兼容，不影响现有日记/媒体/标签数据

---

## Section 3: Recommended Approach

**方案：直接调整（Direct Adjustment）**

| 维度 | 评估 |
|------|------|
| 工作量 | **低** — 改 1 行代码 |
| 风险 | **低** — 纯数据过滤逻辑，不影响写入/编辑 |
| 维护性 | ✅ 高 |
| Epic 完整性 | ✅ Epic 1 仍可按时完成 |

**理由：** 改动极小、无副作用、不引入新依赖、不影响其他 epic。

---

## Section 4: Detailed Change Proposals

### Proposal 1: 代码变更

**文件：** `src/services/database.ts` 第 550 行

```diff
- const shouldApplyRecentWindow = timeFilter === 'all' && !selectedDate && !monthFilter;
+ // 词云始终限制近 30 天，不受当前时间筛选器影响（决策 2026-07-08）
+ const shouldApplyRecentWindow = true;
```

**说明：** `months` 参数默认 `1`（从 `useDiscovery.ts` 传入），`startDate` 计算为 `new Date(); startDate.setMonth(month - months)` 得到 30 天前的时间戳。将此条件从条件启用改为始终启用即可。

### Proposal 2: 规划文档变更

**文件：** `_bmad-output/epics.md`

- Story 1.3 增加验收标准：词云始终限制数据范围为近 30 天

**文件：** `_bmad-output/specs/spec-vivido-next/SPEC.md`

- CAP-4 补充"采样窗口"相关成功标准

---

## Section 5: Implementation Handoff

| 分类 | **Minor** |
|------|-----------|
| 执行者 | Developer agent（当前会话） |
| 交付物 | 代码变更 + 规划文档更新 |
| 验收标准 | `npx tsc --noEmit` 通过 + 词云不受时间筛选器影响 |
| 时间线 | 本次会话内完成 |

---

*Proposal generated 2026-07-08 · Sprint: vivido-next*
