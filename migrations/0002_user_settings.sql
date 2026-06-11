-- ============================================
-- 用户个性化设置
-- key-value 形式，value 是 JSON
-- ============================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  type_colors TEXT NOT NULL,           -- JSON: {"干货": "#ebf4ff", "生活": "#fef5e7", ...}
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
