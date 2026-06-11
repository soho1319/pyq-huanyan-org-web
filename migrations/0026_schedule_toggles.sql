-- D55-17: 排期开关（让用户能关闭月/周主题，关闭后按纯日排规则）
-- 默认全开 = 1，关闭 = 0
ALTER TABLE user_settings ADD COLUMN use_month_theme INTEGER NOT NULL DEFAULT 1;  -- 月主题开关
ALTER TABLE user_settings ADD COLUMN use_week_theme INTEGER NOT NULL DEFAULT 1;   -- 周主题开关
-- 日排规则权重（用户可调 L1~L4 各占多少，JSON 存）
-- 例：{"base":0.6,"month":0,"week":0,"phase":0.4} → 关闭月周主题后全靠 5 段调性 + weekday
ALTER TABLE user_settings ADD COLUMN day_rule_weights_json TEXT;  -- JSON, null=用默认 50/20/20/10
