-- ============================================
-- D37: 周内比重可调（user_settings.weekday_weights_json）
-- 3 段：early (周一-周三) / mid (周四-周五) / weekend (周六-周日)
-- 7 类 post_type 权重 JSON
-- ============================================
ALTER TABLE user_settings ADD COLUMN weekday_weights_json TEXT;
