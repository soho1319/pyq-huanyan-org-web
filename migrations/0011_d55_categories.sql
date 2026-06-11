-- ============================================
-- D55-1: 朋友圈文案库 categories 表（小类索引）
-- 全局共享（不带 user_id），7 维度 × ~4 大类 × ~5 小类 = ~140 行
-- ============================================

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,                    -- 'A1-1' / 'B2-3' / 'C4-5'
  dim TEXT NOT NULL,                       -- A=观赏 / B=专业 / C=情绪 / D=身份 / E=生活 / F=思想 / G=关系
  category TEXT NOT NULL,                  -- 大类名（中文）
  subcategory TEXT NOT NULL,               -- 小类名（中文）
  name TEXT NOT NULL,                      -- 完整名（拼接）
  description TEXT,                        -- 一句话说明
  slot TEXT NOT NULL,                      -- 主时段：morning/noon/evening/late/night
  slot_secondary TEXT,                     -- 副时段（JSON array）
  ai_prompt_id TEXT NOT NULL,              -- P1-P12（对应 [[30 - AI Prompt库（10场景）]]）
  ai_prompt_focus TEXT,                    -- 提示重点
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_categories_dim ON categories(dim);
CREATE INDEX IF NOT EXISTS idx_categories_slot ON categories(slot);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_dim_slot ON categories(dim, slot);
