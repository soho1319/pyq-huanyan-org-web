-- ============================================
-- 自动生成 · seed 3 个初始用户
-- 生成时间：2026-06-10T10:31:24.605Z
-- ============================================

-- 先清空（可选，要保留注释掉下一行）
DELETE FROM users;

INSERT INTO users (id, username, password_hash, display_name, is_admin, created_at) VALUES
  ('8e7776e3-e0a8-465e-b39a-c083e0c63642','admin','pbkdf2$100000$_cceqRAfenfQaUedrbsTNQ$6RaA-KazzF6rX4Wvn4B4qgXDoHfNP7iL9nSfQE9Uy4s','admin',1,1781087484363),
  ('866080cc-89bb-4d17-8023-64dc5b98c7af','cici','pbkdf2$100000$jiNPuiBlycXTcEl5I2HrfQ$lB9ILClg5oVTwTavBSJXp7SYc5wUIKATZOBGpuP-aKI','cici',0,1781087484363),
  ('ed44710b-78f5-4eab-80f7-f46512ae77f8','cc','pbkdf2$100000$HGyG7ijT_WNfM8uTlRkC4g$i15_NC0RmRKBUlibOdc9A_9EhETv1nhpJd-ZY7cHd9c','cc',0,1781087484363);

SELECT id, username, display_name, is_admin, created_at FROM users ORDER BY created_at;
