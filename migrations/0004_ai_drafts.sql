-- ============================================
-- D21: AI 草稿历史
-- 方案 A：给 schedule 表加 ai_draft 列（轻量，复用现有排期表）
-- 方案 B：新建 ai_drafts 表（支持多草稿/多模型/未标记）
-- 这里选 B，更通用：1 天可生成多组草稿，每组 3 条
-- ============================================

CREATE TABLE IF NOT EXISTS ai_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,                      -- YYYY-MM-DD（哪天的草稿）
  today_type TEXT NOT NULL,                -- 今天的排期类型（干货/生活...）
  addon TEXT,                              -- 用户的加餐备注
  -- 3 条候选
  draft_1 TEXT NOT NULL,
  draft_2 TEXT NOT NULL,
  draft_3 TEXT NOT NULL,
  chosen_index INTEGER,                    -- 用户选了几（1/2/3），NULL=未选
  chosen_text TEXT,                        -- 选中的那一条完整文本（冗余存方便看）
  model TEXT,                              -- 用了哪个模型
  used_at INTEGER,                         -- 标记已发的时间戳
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_drafts_user_date ON ai_drafts(user_id, date DESC);
