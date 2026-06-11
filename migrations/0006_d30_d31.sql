-- ============================================
-- D30-D33: 周复盘 + 主题月 + 月历统计
-- 1. weekly_summaries：D30 周复盘（每周生成 1 条）
-- 2. theme_months：D31 主题月（user 给月份定主题）
-- 3. monthly_stats_cache：D33 月报缓存（避免每次 /calendar 重算）
-- ============================================

-- === 1. D30 周复盘 ===
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,             -- '2026-06-08'（周一开始）
  week_end TEXT NOT NULL,               -- '2026-06-14'
  posted_count INTEGER NOT NULL DEFAULT 0,    -- 本周已发数
  skipped_count INTEGER NOT NULL DEFAULT 0,   -- 跳过数
  pending_count INTEGER NOT NULL DEFAULT 0,   -- 待发数
  type_breakdown TEXT NOT NULL DEFAULT '{}',  -- JSON：{干货: 1, 客户: 2, ...}
  slot_breakdown TEXT NOT NULL DEFAULT '{}',  -- JSON：{morning: 2, noon: 1, ...}
  summary_text TEXT,                    -- AI 生成或手动填的复盘文案
  generated_at INTEGER NOT NULL,
  UNIQUE(user_id, week_start),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user ON weekly_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week ON weekly_summaries(user_id, week_start DESC);

-- === 2. D31 主题月 ===
CREATE TABLE IF NOT EXISTS theme_months (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year_month TEXT NOT NULL,             -- '2026-06'
  theme TEXT NOT NULL,                  -- 'trust' | 'pro' | 'sale' | 'recovery' | 'custom'
  weights_json TEXT NOT NULL,           -- JSON: {干货: 0.3, 客户: 0.2, ...}（总和=1）
  custom_label TEXT,                    -- 自定义主题名（可选）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, year_month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_theme_months_user ON theme_months(user_id);
CREATE INDEX IF NOT EXISTS idx_theme_months_user_month ON theme_months(user_id, year_month DESC);
