---
title: D55 数据库 schema 设计
tags: [内容营销/朋友圈/D55/schema]
created: 2026-06-11
source: 婉音老师课程 7 维度框架 + 现有 pyq-huanyan-org-web schema
status: D55-4 设计稿
---

# 🗄️ D55 数据库 Schema 设计

> 解决"朋友圈能发的所有文案"结构化存储 + AI 调度

## 🎯 设计原则

1. **不懒惰**：不全塞 1 张表 → 维度分类（categories）+ 具体框架（frames）拆开
2. **不冗余**：categories 不带 user_id（全局共享一份），frames 不带 user_id（全局共享）
3. **兼容旧数据**：schedule 表加 `dim` + `category_id` 2 列，旧 7 type 保留
4. **AI 可调**：每个 category 挂 `ai_prompt_id`（P1-P12）+ `slot`（时段）
5. **可扩展**：未来加新课程/新维度，只追加 rows，不动 schema

---

## 📊 表 1：categories（小类索引，全局共享）

> 存"7 维度 × 几大类 × 小类"的索引。约 140 行。

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,                    -- 'A1-1' / 'B2-3' / 'C4-5'
  dim TEXT NOT NULL,                        -- A/B/C/D/E/F/G
  category TEXT NOT NULL,                   -- 大类名（中文）
  subcategory TEXT NOT NULL,                -- 小类名（中文）
  name TEXT NOT NULL,                       -- 完整名（dim+category+subcategory 拼接）
  description TEXT,                         -- 一句话说明
  slot TEXT NOT NULL,                        -- 主时段：morning/noon/evening/late/night
  slot_secondary TEXT,                      -- 副时段（JSON array）
  ai_prompt_id TEXT NOT NULL,               -- P1-P12（对应 [[pyq-helper/30-ai-prompts]]）
  ai_prompt_focus TEXT,                     -- 提示重点（"重点放在故事开头""重点放在对比"）
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,     -- 0/1
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX idx_categories_dim ON categories(dim);
CREATE INDEX idx_categories_slot ON categories(slot);
```

**示例行**：

| id | dim | category | subcategory | name | slot | ai_prompt_id |
|---|---|---|---|---|---|---|
| A1-1 | A | 高清同色系九宫格 | 自拍配同色系 | A1-1 自拍配同色系 | morning | P12 |
| B2-1 | B | 客户证言 | 用户反馈截图 | B2-1 用户反馈截图 | noon | P5 |
| C4-1 | C | 痛点共鸣 | 痛点具象化 | C4-1 痛点具象化 | morning | P4 |
| F1-1 | F | 反认知金句 | 本质/前提型 | F1-1 本质/前提型 | morning | P3 |
| G6-5 | G | 链接互动 | 卖货连载 8 步 | G6-5 卖货连载 8 步 | late | P9 |

---

## 📊 表 2：frames（具体写作框架，全局共享）

> 存"每个小类下的具体框架"。约 420 行（140 小类 × 平均 3 框架）。

```sql
CREATE TABLE frames (
  id TEXT PRIMARY KEY,                      -- 'A1-1-1' / 'A1-1-2' ...
  category_id TEXT NOT NULL,                 -- 关联 categories.id
  code TEXT NOT NULL,                        -- 'A1-1-1'（同 id）
  name TEXT NOT NULL,                         -- 框架名
  structure TEXT,                            -- 结构描述（"讲细节+解释+升华"）
  example TEXT NOT NULL,                      -- 范例短句（必填）
  image_hint TEXT,                            -- 配图建议
  image_source TEXT,                          -- 配图来源（堆糖/小红书/自拍/客户授权）
  slot TEXT NOT NULL,                         -- 主时段
  difficulty TEXT NOT NULL DEFAULT 'beginner', -- beginner/intermediate/advanced
  tags TEXT,                                  -- 关键词标签（JSON array）
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX idx_frames_category ON frames(category_id);
CREATE INDEX idx_frames_slot ON frames(slot);
CREATE INDEX idx_frames_difficulty ON frames(difficulty);
```

**示例行**：

| id | category_id | name | example | image_hint | difficulty |
|---|---|---|---|---|---|
| A1-1-1 | A1-1 | 同色系自拍 | 本周主题色蓝色 → 蓝色西装自拍 + 蓝色背景咖啡馆 | 堆糖/小红书按色系搜 20 张 | beginner |
| A1-1-2 | A1-1 | 一周主题色 | 7 天用 1 种主色（橙/绿/蓝） | 提前批量拍照 | beginner |
| B2-1-1 | B2-1 | 用户反馈+红框标注 | 客户说"皮肤好"截图 + 框出关键词 | 截图带授权 | intermediate |
| C4-1-1 | C4-1 | 5 段式痛点具象化 | 人群画像+场景冲突+隐藏情绪+Why+金句 | 同色系场景图 | advanced |
| F1-1-1 | F1-1 | 本质型 | "不好意思的本质是一种自私" | 黑白/留白图 | beginner |
| G6-5-1 | G6-5 | 卖货连载 8 步 | 写自己需求→体验期→体验结果→求推荐→用户案例→考察→展示→正式出道 | 8 张图 | advanced |

---

## 📊 schedule 表加 2 列（兼容旧 7 type）

```sql
ALTER TABLE schedule ADD COLUMN dim TEXT;                     -- A/B/C/D/E/F/G（对应 7 维度）
ALTER TABLE schedule ADD COLUMN category_id TEXT;              -- 关联 categories.id
CREATE INDEX idx_schedule_dim ON schedule(dim);
CREATE INDEX idx_schedule_category ON schedule(category_id);
```

**新旧字段对照**：

| 旧字段 | 新字段 | 关系 |
|---|---|---|
| post_type = '干货' | dim = 'F' + category_id = 'F1' | 干货 ≈ F 思想（反认知）+ B 专业（方法论） |
| post_type = '生活' | dim = 'E' + category_id = 'E1' | 一一对应 |
| post_type = '客户' | dim = 'B' + category_id = 'B2' | 客户证言 |
| post_type = '互动' | dim = 'G' + category_id = 'G6' | 链接互动 |
| post_type = '软广' | dim = 'C' + category_id = 'C5' | 软广 |
| post_type = '复盘' | dim = 'C' + category_id = 'C3' | 价值观 |
| post_type = '休息' | dim = 'E' + category_id = 'E3' | 小确幸 |

> 后端 `POST_TYPES` 常量保留 7 个旧 type（UI 兼容）；新加 `DIMS` 常量（A-G）；调 AI 时按 `category_id` 查 frames

---

## 🤖 AI Prompt 调度

| Prompt | 名称 | 适用 categories 范围 |
|---|---|---|
| **P1** | 朋友圈自我介绍 | D1（5 要素 + 凡尔赛 20 句） |
| **P2** | 朋友圈卖产品/转化 | B3 业绩 + C5 软广 + G6-5 卖货连载 |
| **P3** | 反认知金句 | F1（11 公式全部） |
| **P4** | 痛点文案 | C4（痛点共鸣全部） |
| **P5** | 用户案例 | B2（客户证言全部） |
| **P6** | 个人故事开头 | E4 生命经历 + E6-1 故事开头 |
| **P7** | 完整故事文 | E6-2/3/4 故事结构 + G6-6 推出产品 10 步 |
| **P8** | 软广 | C1-3 改写故事 + C5 软广 |
| **P9** | 连载故事大纲 | G6-4 至 6-10 全部 |
| **P10** | 朋友圈诊断 | 自查（所有 dim） |
| **P11** | 立边界 | D4 全部 |
| **P12** | 今日 3 条综合 | 综合每日朋友圈 |

---

## 📋 Migration 文件列表

| # | 文件 | 内容 |
|---|---|---|
| 0011 | `0011_d55_categories.sql` | CREATE categories 表 + 索引 |
| 0012 | `0012_d55_frames.sql` | CREATE frames 表 + 索引 |
| 0013 | `0013_d55_schedule_mapping.sql` | schedule 表加 2 列 + 索引 |
| 0014-0020 | `0014_d55_seed_categories_*.sql` | 7 个维度 seed categories（共 ~140 行） |
| 0021 | `0021_d55_seed_frames_sample.sql` | frames 示范 seed（前 50 个框架） |

> 全量 frames seed（~420 行）后续按需追加，不阻塞核心功能

---

## 🎯 跟 AI 调度的代码变更

在 `functions/lib/schedule-constants.ts` 加：

```ts
// 7 维度
export const DIMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type Dim = (typeof DIMS)[number];

// 5 时段
export const SLOT_IDS = ['morning', 'noon', 'evening', 'late', 'night'] as const;

// 维度 → AI prompt 映射
export const DIM_PROMPT: Record<Dim, string> = {
  A: 'P12',  // 观赏价值
  B: 'P5',   // 专业价值
  C: 'P4',   // 情绪价值
  D: 'P1',   // 身份维度
  E: 'P6',   // 生活维度
  F: 'P3',   // 思想维度
  G: 'P9'    // 关系维度
};

// 旧 7 type → 新 dim 映射
export const POST_TYPE_TO_DIM: Record<PostType, Dim> = {
  '干货': 'F',  // 思想（反认知） + B 专业（方法论）
  '生活': 'E',
  '客户': 'B',
  '互动': 'G',
  '软广': 'C',
  '复盘': 'C',
  '休息': 'E',
};
```

---

## 📋 TypeScript 类型（functions/lib/types.d.ts）

```ts
export interface Category {
  id: string;                  // 'A1-1'
  dim: Dim;                    // 'A'
  category: string;            // '高清同色系九宫格'
  subcategory: string;         // '自拍配同色系'
  name: string;                // 完整名
  description: string;
  slot: Slot;                  // 主时段
  slot_secondary: Slot[];      // 副时段
  ai_prompt_id: string;        // 'P3'
  ai_prompt_focus: string;     // '重点放在故事开头'
  sort_order: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface Frame {
  id: string;                  // 'A1-1-1'
  category_id: string;         // 'A1-1'
  code: string;
  name: string;                // 框架名
  structure: string;           // 结构描述
  example: string;             // 范例
  image_hint: string;
  image_source: string;
  slot: Slot;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  sort_order: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}
```

---

## ❓ 待用户最终确认

1. **2 张新表 + 1 张旧表加 2 列**（方案 D）OK 吗？
2. **migration 文件结构**（0011/0012/0013 + 0014-0020 seed）OK 吗？
3. **frames 表 50 条示范 seed**（不全量 420）先验证，后续按需追加 OK 吗？
4. **后端 TypeScript 类型**（Category / Frame 接口）OK 吗？

确认后我立刻写：
- `0011_d55_categories.sql` + `0012_d55_frames.sql` + `0013_d55_schedule_mapping.sql`
- `0014-0020_d55_seed_categories_*.sql` 7 张表（每个维度 1 张）
- `0021_d55_seed_frames_sample.sql` 50 条 frames 示范
- `functions/lib/schedule-constants.ts` + `functions/lib/types.d.ts` 加 DIMS / Category / Frame

---

**Status**: 🟡 设计稿（待用户最终确认）
**Next**: D55-5 写 migration + seed + code 变更
**Owner**: Claudian
