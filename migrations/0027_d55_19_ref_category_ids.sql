-- ============================================
-- D55-19: ai_drafts 表加 ref_category_ids_json（多选参考 categories）
-- 用于记录用户勾选哪些 categories 当 AI 草稿参考
-- ============================================

ALTER TABLE ai_drafts ADD COLUMN ref_category_ids_json TEXT;  -- JSON array: ["A1-1","B2-3",...]
