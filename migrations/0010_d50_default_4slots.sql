-- ============================================
-- D50: 老用户 default_slots_per_day 升级到 4
-- 旧 D29 默认 1 段（早），现在默认 4 段全发
-- ============================================

-- 老用户：1/2/3 段都升级到 4
UPDATE user_settings SET default_slots_per_day = 4 WHERE default_slots_per_day < 4;
