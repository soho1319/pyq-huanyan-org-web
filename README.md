---
title:README · pyq.huanyan.org · 内容营销朋友圈小助手
tags: [web/部署/MOC, saas/d1]
created:2026-06-11
updated:2026-06-11
---

# 🌐 pyq.huanyan.org · 内容营销朋友圈小助手（SaaS）

> 把 [[../内容营销朋友圈助手/朋友圈运营全套循环体系|朋友圈运营循环体系]]（4 周主题 + 3 月阶段 + 7 维度）变成**多用户 SaaS**：每个用户登录后看到自己的 4 段排期、AI 帮写、主题月/周锁定、维度诊断。

**生产域**：[https://pyq.huanyan.org](https://pyq.huanyan.org)
**Pages 部署**：[https://pyq-b4s.pages.dev](https://pyq-b4s.pages.dev)
**Worker 反代**：`pyq-huanyan-reverse`（绑 `pyq.huanyan.org/*` → 转发 Pages）

---

## 🎯 核心循环体系

参考 [[../内容营销朋友圈助手/朋友圈运营全套循环体系]] 的课程原文，系统实现：

### 1. 4 周周主题循环（自动 + 可锁）
| 周 | 主题 | 重点 |
|---|---|---|
| 第 1 周 | **立人设** | 干货 + 生活 + 客户 |
| 第 2 周 | **反认知** | 干货 + 复盘 + 互动 |
| 第 3 周 | **讲故事** | 复盘 + 客户 + 生活 |
| 第 4 周 | **立边界** | 软广 + 客户 + 互动 |

实现：`functions/lib/schedule-constants.ts` 的 `WEEKLY_THEMES` + `getWeeklyTheme(date, locked)`，自动按 4 周 cycle 切。

### 2. 3 月月阶段循环
| 月 | 阶段 | 重点 |
|---|---|---|
| 第 1 月 | **破冰** | 干货 + 互动 |
| 第 2 月 | **转化** | 客户 + 软广 |
| 第 3 月 | **复购** | 互动 + 复盘 + 客户 |

实现：`MONTHLY_PHASES` + `getMonthlyPhase(yearMonth, cycleIndex)`。

### 3. 7 维度内容矩阵
身份 / 原生 / 生活 / 专业 / 关系 / 思想 / 链接 — 7 个 post_type 反查维度，自动诊断"本月某维度缺失"。

实现：`DIMENSION_TYPE_MAP` + `reverseDimensionMap(type)`。

### 4. 4 层权重算法（base 50% + month 20% + week 20% + phase 10%）
- L1 base：4 段（早/午/晚/夜）调性 + 周末特殊
- L2 month：当前月阶段权重
- L3 week：当前周主题权重
- L4 phase：周内 early/mid/weekend 段（user 可自定义）

实现：`functions/api/schedule/seed.ts` 的 `pickWeightedType`（D40 4 层）+ `functions/lib/schedule-constants.ts` 的 `computeDaySuggestions`（D42-E 纯函数）。

---

## 📦 功能里程碑

| ID | 名称 | 描述 | Commit |
|---|---|---|---|
| **D36** | 周主题 + 月阶段 + 7 维度框架 | 数据结构 + 4 层权重算法底座 | `1d1124a` |
| **D37** | 周内比重可调 | user 在 `/my/types` 自定义 early/mid/weekend 权重 | `1d1124a` |
| **D38** | 7 维度诊断页 | `/my/dashboard` 显示 7 维度本月覆盖度 + 推荐补哪个 | `1d1124a` |
| **D39** | /today 显示主题进度 | 本周"干货"已发 N 条 · 软目标 M 条 + 7 维度覆盖卡片 | `1d1124a` |
| **D40** | AI draft 主题注入 | 调 AI 时把周主题/月阶段/7 维度建议注入 prompt | `1d1124a` / `c0f6bf6` |
| **D41** | 重新排今天按钮 | /today 加 🔄 按钮，overwrite=true 但跳过已发 | `86c0b04` |
| **D42-dev** | build.sh 健壮性 | 解决 502 全 404 + Node 20 兼容 | `c71c232` |
| **D42-E** | 明日建议卡片 | /today 顶部加"💡 明日（明天日期）"提前规划 | `dabb0eb` |

---

## 🏗 架构

```
                    ┌────────────────────┐
                    │ Cloudflare DNS     │
                    │ pyq.huanyan.org    │
                    └─────────┬──────────┘
                              │ routes: huanyan.org
                              ▼
                    ┌────────────────────┐
                    │ Worker             │
                    │ pyq-huanyan-reverse│  ← 反代：转发 + 重写 Set-Cookie + Location
                    │ Version b31cb0ba   │
                    └─────────┬──────────┘
                              │ PAGES_ORIGIN = pyq-b4s.pages.dev
                              ▼
                    ┌────────────────────┐
                    │ Cloudflare Pages   │
                    │ pyq-huanyan-org-web│
                    │ 1) Quartz 静态站    │
                    │ 2) Functions: API  │
                    │    /login /logout  │
                    │    /today /my/*    │
                    │    /api/ai/draft   │
                    │    /api/schedule/* │
                    │    /api/auth/*     │
                    └─────────┬──────────┘
                              │ D1 binding
                              ▼
                    ┌────────────────────┐
                    │ D1 SQLite          │
                    │ pyq-db (id:27ede..)│
                    └────────────────────┘
```

**反代为什么需要**：Pages 自带 `*.pages.dev` 域名，但用户用 `pyq.huanyan.org` 自定义域时，Pages function 里 `new URL("/login", request.url)` 会拼成 `pyq-b4s.pages.dev/login`，导致 Set-Cookie 和 302 Location 跳到错误的域。Worker 做 3 件事：
1. 转发请求到 Pages
2. 重写 `Location` 头（302 不带 .pages.dev）
3. 重写 `Set-Cookie` 头（删 `Domain=pyq-b4s.pages.dev`）

代码：[`worker/src/index.js`](worker/src/index.js)

---

## 📂 项目结构

```
pyq-huanyan-org-web/
├── README.md               ← 你在这里
├── 部署指南.md              ← 从 0 到部署的 step-by-step
├── build.sh                ← ⭐ 6 步 build 脚本（Quartz clone + engines strip + functions cp）
├── wrangler.toml           ← CF Pages 配置（D1 binding）
├── worker/
│   ├── wrangler.toml       ← Worker 反代配置
│   └── src/index.js        ← 反代主逻辑（Location / Set-Cookie 重写）
│
├── content/                ← Quartz vault 内容（笔记）
├── quartz.config.ts        ← Quartz 配置覆盖
├── quartz.layout.ts
│
├── functions/              ← ⭐ CF Pages Functions（API + HTML）
│   ├── today.ts            ← /today 主页（D36-D42 都在这）
│   ├── login.ts / logout.ts
│   ├── my/                 ← /my/* 私域页面（intros/cases/quotes/formulas/types/theme/...）
│   ├── api/
│   │   ├── schedule/seed.ts        ← D40 4 层权重排期
│   │   ├── schedule/seed.ts        ← D41 posted 保护
│   │   ├── ai/draft.ts             ← D40 prompt 注入
│   │   ├── theme-month.ts          ← 主题月 CRUD
│   │   ├── weekly-theme.ts         ← 主题周锁定
│   │   ├── today/addon.ts          ← 标记已发/加餐
│   │   ├── auth/me.ts              ← session 验证
│   │   └── ...
│   └── lib/
│       ├── schedule-constants.ts   ← ⭐ D36-D42 全部常量 + computeDaySuggestions
│       ├── weekly.ts               ← startOfWeek / loadWeekData
│       ├── auth.ts                 ← HMAC session cookie
│       ├── type-colors.ts          ← post_type 颜色映射
│       └── theme.ts                ← user 主题色
│
├── migrations/             ← D1 schema
├── components/             ← Quartz 自定义组件
├── edge-functions/         ← EdgeOne 国内镜像（暂未用）
└── scripts/                ← 一键脚本（早期）
```

---

## 🗄 D1 数据模型

| 表 | 关键字段 | 用途 |
|---|---|---|
| `users` | id, username, display_name, password_hash | 多用户 |
| `schedule` | id, user_id, date, slot, post_type, template_id, status | 每日 4 段排期 |
| `theme_months` | user_id, year_month, theme, weights_json, cycle_index | 月阶段（破冰/转化/复购）|
| `weekly_theme_locks` | user_id, week_start, theme | 周主题锁定（默认自动循环）|
| `user_settings` | user_id, default_slots_per_day, slot_config_json, weekday_weights_json, theme | 全局配置 |
| `intros` | user_id, slot, content | 自我介绍 5 版本 |
| `cases` | user_id, name, persona, pain, action, result, testimonial | 客户案例 |
| `quotes` | user_id, text, category | 金句库 |
| `formula_templates` | user_id, formula_id, variant_index, filled_text | 公式填空 |
| `ai_drafts` | user_id, date, slot, draft_1/2/3, chosen_index, chosen_text | AI 草稿历史 |

迁移脚本：`migrations/*.sql`

---

## 🚀 部署流程

### 本地开发 / 部署
```bash
# 1. 跑 build（Quartz + functions 打包到 vendor/quartz/public/）
bash build.sh

# 2. 部署 Pages（含 functions 一起）
npx wrangler pages deploy vendor/quartz/public --project-name pyq

# 3. 部署 Worker 反代（如果改过 worker/src/index.js）
cd worker && npx wrangler deploy
```

### CF Dashboard 必须配的
- **Pages → pyq-huanyan-org-web → Settings → Functions → D1 bindings**
  - Variable name: `DB`
  - D1 database: `pyq-db` (id: `27eded01-6aee-444f-886f-259648d91562`)
- **Workers → pyq-huanyan-reverse → Triggers → Routes**
  - Route: `pyq.huanyan.org/*` (zone: `huanyan.org`)
- **DNS for huanyan.org**
  - `pyq` CNAME → `pyq-huanyan-reverse.workers.dev`（proxied）

---

## 🧪 验证清单

每次改完代码后跑：
1. ✅ TypeScript 编译过（`bash build.sh` 跑到底）
2. ✅ `npx wrangler pages deploy` 返回 deployment URL
3. ✅ Playwright 打开 https://pyq.huanyan.org/today：
   - /today 看到 📌 今日要发（4 段）
   - 看到 📌 本周主题 + 🎯 月阶段
   - 看到 💡 明日建议卡片
   - 看到 🔄 重新排今天按钮
   - 点击按钮 → 4 段重排符合 D36 算法
4. ✅ Worker 反代：`curl -I https://pyq.huanyan.org/` 应返回 `X-Proxy-By: pyq-huanyan-reverse`

---

## ⚠️ 已知坑 / 注意事项

1. **Node 22 强 check** — Quartz v4.5.2 `engines` 字段要 Node ≥22，本地 20 会 EBADENGINE
   - 解决：`build.sh` [4.5/6] 步自动 strip engines
2. **Functions 必须复制到 public/** — 不复制 deploy 后 /api/* 全 404
   - 解决：`build.sh` [6/6] 步 `cp -r functions public/functions`
3. **Cookie Domain 重写** — Pages 默认 Set-Cookie 带 `Domain=*.pages.dev`，反代 Worker 必须 strip
4. **动态 import 在 Functions 里** — `import("...")` 路径在 wrangler 打包时可能解析失败，改用静态 import
5. **template literal 嵌套** — renderToday 返回的大 template literal 里别再用 `${...}`，改字符串拼接
6. **D1 迁移** — `wrangler d1 migrations apply` 在没有 `migrations/` 文件夹时只警告不报错，可跳过

---

## 📊 截图存证

- `d38-dashboard-prod.png` — D38 7 维度诊断页
- `d40-ai-draft-injection.png` — D40 AI prompt 注入验证
- `d41-reseed-today.png` — D41 重新排今天按钮
- `d42-tomorrow-suggestion.png` — D42-E 明日建议卡片

---

## 🔗 链接

- 课程原文：[[../内容营销朋友圈助手/00 - 内容营销朋友圈小助手（MOC入口）]]
- 全套循环体系：[[../内容营销朋友圈助手/朋友圈运营全套循环体系]]
- 部署 step-by-step：[[部署指南]]
- GitHub: https://github.com/soho1319/pyq-huanyan-org-web
- 生产域: https://pyq.huanyan.org
