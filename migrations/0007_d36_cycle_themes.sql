-- ============================================
-- D36: 朋友圈运营循环体系（4 周 + 3 月循环）
-- 1. 新表 weekly_themes（4 周循环：立人设/反认知/讲故事/立边界）
-- 2. theme_months 加 cycle_index 列（3 月循环：破冰/转化/复购）
-- ============================================

-- 1. 新表 weekly_themes
CREATE TABLE IF NOT EXISTS weekly_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  theme TEXT NOT NULL,
  weights_json TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, week_start),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_weekly_themes_user ON weekly_themes(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_themes_user_week ON weekly_themes(user_id, week_start DESC);

-- 2. theme_months 加 cycle_index 列
ALTER TABLE theme_months ADD COLUMN cycle_index INTEGER NOT NULL DEFAULT 0;
