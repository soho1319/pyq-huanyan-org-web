-- ============================================
-- D46: schedule 加量多行支持
-- 旧 UNIQUE(user_id, date, slot) 改成 UNIQUE(user_id, date, slot, sort_order)
-- 这样每段可有多条 schedule 行：sort_order=0 是固定 / sort_order=1+ 是加量
-- 注意：D1 自动事务，不能用 BEGIN TRANSACTION
-- ============================================

CREATE TABLE schedule_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,                    -- 'YYYY-MM-DD'
  slot TEXT NOT NULL DEFAULT 'morning',  -- 'morning'|'noon'|'evening'|'night'
  post_type TEXT NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',-- 'pending'/'posted'/'skipped'
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, -- 0=固定排期 / 1+=D46 加量
  updated_at INTEGER,
  UNIQUE(user_id, date, slot, sort_order),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO schedule_new (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
SELECT id, user_id, date, slot, post_type, template_id, status, note,
       COALESCE(sort_order, 0) AS sort_order,
       updated_at
FROM schedule;

DROP TABLE schedule;

ALTER TABLE schedule_new RENAME TO schedule;

CREATE INDEX IF NOT EXISTS idx_schedule_user_date ON schedule(user_id, date);
