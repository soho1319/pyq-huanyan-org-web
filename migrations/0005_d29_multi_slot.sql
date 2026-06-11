-- ============================================
-- D29: 一天 1-4 条排期（4 段固定时段）+ 用户 slot 配置 + AI 草稿按 slot 拆
-- 1. schedule 表：加 slot 列，破 UNIQUE → 重建
-- 2. user_settings：加 default_slots_per_day + slot_config_json
-- 3. ai_drafts：加 slot 列 + 改索引
-- ============================================

-- === 1. schedule 表重建（D1 无 ALTER CONSTRAINT）===
CREATE TABLE IF NOT EXISTS schedule_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,                    -- '2026-06-15'
  slot TEXT NOT NULL DEFAULT 'morning',  -- 'morning' | 'noon' | 'evening' | 'night'
  post_type TEXT NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',-- 'pending'/'posted'/'skipped'
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER,
  UNIQUE(user_id, date, slot),           -- 一天一段一条
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 旧数据按 slot='morning' 复制（兜底"主时段"）
INSERT OR IGNORE INTO schedule_new
  (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
SELECT id, user_id, date, 'morning', post_type, template_id, status, note, 0, updated_at
FROM schedule;

DROP TABLE IF EXISTS schedule;
ALTER TABLE schedule_new RENAME TO schedule;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_user_date ON schedule(user_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_user_date_slot ON schedule(user_id, date, slot);

-- === 2. user_settings 加 slot 配置 ===
-- 升级用户保持 default=1（零破坏，1 天 1 条原行为）
ALTER TABLE user_settings ADD COLUMN default_slots_per_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN slot_config_json TEXT;

-- === 3. ai_drafts 加 slot 列 + 改索引 ===
ALTER TABLE ai_drafts ADD COLUMN slot TEXT NOT NULL DEFAULT 'morning';
DROP INDEX IF EXISTS idx_ai_drafts_user_date;
CREATE INDEX IF NOT EXISTS idx_ai_drafts_user_date_slot ON ai_drafts(user_id, date, slot);
