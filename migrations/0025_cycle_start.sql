-- ============================================
-- D55-15: A2 改造 — 账号启用日 = 日排/周排/月排起点
-- 每个用户的 cycle_start_date 独立（注册时填 today()）
-- 周主题 = floor((date - cycle_start) / 7) % 4
-- 月阶段 = floor((date - cycle_start) / 30) % 3
-- ============================================

ALTER TABLE users ADD COLUMN cycle_start_date TEXT;  -- YYYY-MM-DD
