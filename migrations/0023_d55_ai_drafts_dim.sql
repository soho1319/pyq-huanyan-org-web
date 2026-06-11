-- ============================================
-- D55-13: ai_drafts 表加 today_dim + category_id 列
-- 替代旧 today_type（彻底 dim 切换）
-- 兼容旧数据：today_type 列保留不动
-- ============================================

ALTER TABLE ai_drafts ADD COLUMN today_dim TEXT;       -- A/B/C/D/E/F/G
ALTER TABLE ai_drafts ADD COLUMN category_id TEXT;    -- 关联 categories.id

CREATE INDEX IF NOT EXISTS idx_ai_drafts_today_dim ON ai_drafts(today_dim);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_category ON ai_drafts(category_id);
