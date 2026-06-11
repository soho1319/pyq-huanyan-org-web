-- ============================================
-- 用户主题色
-- ============================================

ALTER TABLE user_settings ADD COLUMN theme_start TEXT NOT NULL DEFAULT '#667eea';
ALTER TABLE user_settings ADD COLUMN theme_end TEXT NOT NULL DEFAULT '#764ba2';
