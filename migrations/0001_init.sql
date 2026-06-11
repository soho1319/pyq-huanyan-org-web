-- ============================================
-- pyq-huanyan-org-web-saas · 初始 schema
-- 6 张表，所有素材表都带 user_id 强制隔离
-- ============================================

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,         -- pbkdf2$<iter>$<saltB64>$<hashB64>
  display_name TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,  -- 0=普通 1=admin
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- 自我介绍（5 个版本合一表）
CREATE TABLE IF NOT EXISTS intros (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slot TEXT NOT NULL,                    -- 'short3' / '50' / '1min' / '200' / 'addwechat'
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, slot),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 客户案例
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,                             -- 化名
  persona TEXT,                          -- 谁（行业/身份/年龄段）
  pain TEXT,                             -- 痛点
  action TEXT,                           -- 做了什么
  result TEXT,                           -- 结果（具体数字）
  testimonial TEXT,                      -- 原话证言
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 金句库
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT,                         -- '反认知'/'痛点'/'价值观'/'故事开头'/'其他'
  source TEXT,                           -- 来自哪（书/课程/采访/原创）
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 公式填空模板（11 公式 × N 变体）
CREATE TABLE IF NOT EXISTS formula_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  formula_id TEXT NOT NULL,              -- 'contrarian' / 'pain' / 'boundary' ...
  variant_index INTEGER NOT NULL,        -- 1 / 2 / 3
  filled_text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, formula_id, variant_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 一周排期
CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,                    -- '2026-06-15' YYYY-MM-DD
  post_type TEXT NOT NULL,               -- '干货'/'生活'/'客户'/'互动'/'软广'/'复盘'/'休息'
  template_id TEXT,                      -- 推荐的公式
  status TEXT NOT NULL DEFAULT 'pending',-- 'pending'/'posted'/'skipped'
  note TEXT,                             -- 当日加餐
  updated_at INTEGER,
  UNIQUE(user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引（加速按 user_id 查）
CREATE INDEX IF NOT EXISTS idx_intros_user ON intros(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_formulas_user ON formula_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_user_date ON schedule(user_id, date);
