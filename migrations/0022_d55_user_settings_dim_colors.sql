-- ============================================
-- D55-12: user_settings 表加 dim_colors 列
-- 替代旧 type_colors（彻底 dim 切换：7 type → 7 dim A-G）
-- 兼容老用户：旧 type_colors 保留不动（万一回滚），但新代码全用 dim_colors
-- ============================================

ALTER TABLE user_settings ADD COLUMN dim_colors TEXT;  -- JSON: {A:{bg,fg}, B:{bg,fg}, ...}

-- 跑过 0013 schedule_mapping 后，再用 dim_colors 替代 type_colors
-- 老数据自动 fallback 到 DEFAULT_COLORS（schedule-constants.ts 里的 DEFAULT_COLORS）
