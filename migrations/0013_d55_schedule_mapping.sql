-- ============================================
-- D55-3: schedule 表加 dim + category_id 2 列
-- 兼容旧 7 type（POST_TYPES 保留），调 AI 时按 category_id 查 frames
-- ============================================

ALTER TABLE schedule ADD COLUMN dim TEXT;            -- A/B/C/D/E/F/G
ALTER TABLE schedule ADD COLUMN category_id TEXT;     -- 关联 categories.id

CREATE INDEX IF NOT EXISTS idx_schedule_dim ON schedule(dim);
CREATE INDEX IF NOT EXISTS idx_schedule_category ON schedule(category_id);
CREATE INDEX IF NOT EXISTS idx_schedule_user_date_dim ON schedule(user_id, date, dim);
