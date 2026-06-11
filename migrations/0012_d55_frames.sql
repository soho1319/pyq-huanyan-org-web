-- ============================================
-- D55-2: 朋友圈文案库 frames 表（具体写作框架）
-- 全局共享（不带 user_id），每小类下 ~3 框架 = ~420 行
-- ============================================

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY,                       -- 'A1-1-1' / 'A1-1-2' ...
  category_id TEXT NOT NULL,                  -- 关联 categories.id
  code TEXT NOT NULL,                         -- 'A1-1-1'（同 id）
  name TEXT NOT NULL,                         -- 框架名
  structure TEXT,                             -- 结构描述（"讲细节+解释+升华"）
  example TEXT NOT NULL,                      -- 范例短句（必填）
  image_hint TEXT,                            -- 配图建议
  image_source TEXT,                          -- 配图来源（堆糖/小红书/自拍/客户授权）
  slot TEXT NOT NULL,                         -- 主时段
  difficulty TEXT NOT NULL DEFAULT 'beginner',-- beginner/intermediate/advanced
  tags TEXT,                                  -- 关键词标签（JSON array）
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_frames_category ON frames(category_id);
CREATE INDEX IF NOT EXISTS idx_frames_slot ON frames(slot);
CREATE INDEX IF NOT EXISTS idx_frames_difficulty ON frames(difficulty);
CREATE INDEX IF NOT EXISTS idx_frames_active ON frames(is_active);
CREATE INDEX IF NOT EXISTS idx_frames_category_slot ON frames(category_id, slot);
