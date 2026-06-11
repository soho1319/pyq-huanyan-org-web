-- ============================================
-- D55-7: 邀请制注册
-- 2 张表：invite_codes（码池）+ invite_redemptions（兑换记录）
-- ============================================

-- 邀请码（admin 生成 / 软删）
CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,             -- 8 位 base36（例 "K7XQ4M2P"）
  created_by TEXT NOT NULL,              -- admin user_id
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,                    -- nullable（ms epoch）
  note TEXT,                             -- admin 备注
  is_active INTEGER NOT NULL DEFAULT 1,  -- 0 = 已撤销
  created_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 兑换记录（哪用户用哪码）
CREATE TABLE IF NOT EXISTS invite_redemptions (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  UNIQUE(code_id, user_id),
  FOREIGN KEY (code_id) REFERENCES invite_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_invite_redemptions_code ON invite_redemptions(code_id);
CREATE INDEX IF NOT EXISTS idx_invite_redemptions_user ON invite_redemptions(user_id);
