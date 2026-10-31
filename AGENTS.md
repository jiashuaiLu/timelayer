# AGENTS.md — TimeLayer

给后续接手的开发 Agent 的硬约束。改代码前先读这一页，再读 `README.md`。

## 不可协商的四条

1. **任何进入地图渲染或卡片导出的坐标，必须已经模糊到街区级。**
   唯一出口是 `src/pipeline/resolve.ts` 的 `anonymize()`。`ResolvedBlockSchema` 里
   **不允许**出现 `houseNumber` / `address` / `postcode` 字段，也不要为了「调试方便」把原始输入塞进去。
   `npm run check:m1` 会扫描输出 JSON 里的敏感关键词，泄漏即失败。

2. **时间轴只能停在真实数据节点。**
   缺口就是缺口。不允许在 `GAP_YEARS`（25 年）以上的区间里插值出「推测帧」。
   拖到缺口中间时，取景框显示「无记录」，地图必须走「降到纸色 → 停 180ms → 浮出新层」这条路径
   （`MapStage.tsx` 的 `gap` 分支），不要为了顺滑把它改成直线交叉淡化。

3. **AI 只润色，不生产事实。**
   事实来源是 `ChangeEvent.facts`。LLM 的输出必须过两道门：
   `narrativeSchema`（Zod）与 `groundingIssues()`（年份接地）。
   任何一道没过就回退到规则模板，且 `polished: false`。
   无 `source` 的事件强制 `provenance: 'inferred'` 并在正文里出现「虚构推演」。

4. **地图切换用 opacity 交叉，不用 setStyle 硬切。**
   两个图层槽 `bld-fill-a/b`、`bld-line-a/b` 交替；旧槽只在新槽就位后归零，
   不要在切换瞬间 `removeLayer`，会闪白。

## 数据与范围

- **只做纽约，两个街区**（`sunnyside-44dr`、`crosby-soho`）。加城市/街区前先确认：
  有配准后的历史地图、有可核对的叙事来源、模板能覆盖新街区的变化类型。
- **街区几何由 `src/data/plans.ts` 编译而来**，用确定性 PRNG（`src/lib/rng.ts`）。
  同一街区的建筑轮廓必须每次完全一致——否则卡片和地图会对不上，测试也会飘。
- **演示数据必须始终可辨识。** UI 上三处声明（首页页脚 / 街区页副标题 / 卡片朱砂印章）不可删除。
  接真实史料时，把 `provenance` 从 `demo` 改成 `archive`，并把来源写进 `source`。

## 验收

```bash
npm run check      # M1 地址模糊化 / M2 切片 / M4 叙事
npm run typecheck
npm run build
```

改动涉及以下任一事项时，必须同时更新对应脚本的断言：

- 地址解析规则 → `scripts/check-m1.ts`
- 切片探测或缺口判定 → `scripts/check-m2.ts`
- 叙事模板、Zod schema、年份校验 → `scripts/check-m4.ts`

## 代码地图（改哪里）

| 想改的东西 | 去哪 |
|---|---|
| 街道、地标、事件、切片 | `src/data/plans.ts`（手写骨架） |
| 建筑肌理生成规则 | `src/data/blocks.ts` 的 `buildFabric` |
| 墨线/填充/痕迹的视觉 | `src/lib/mapPlan.ts` |
| 时间轴手感（惯性、回弹、刻度抽稀） | `src/components/TimeRuler.tsx` |
| 卡片版式与导出 | `src/lib/cardRenderer.ts` |
| 档案纸条文案 | `src/pipeline/narrative.ts` 的 `draftNarrative` |
| 首页与定位呼吸 | `src/components/EntryScreen.tsx` |

## 风格约定

- 中文正文用 Noto Serif SC；年份/编号用 IBM Plex Mono；拉丁标题用 Cormorant Garamond。
  不要引入新的字族，除非同时更新 `scripts/collect-chars.ts` 并重建 OG 字体子集。
- 动效时长参照 GDD：切片交叉 450ms、空白呼吸 200ms（实现为 220/180）、纸条抽出 250ms、
  回弹 200–260ms。新增动效沿用 `cubic-bezier(0.16, 1, 0.3, 1)` 或 `easeOutQuint`。
- 色彩只用 `app/globals.css` 里的 CSS 变量（纸/墨/朱砂/铜绿/缺口灰）。不要临时调色，
  低饱和是这套界面的底线。
