// ============================================
// 7 种 post_type 颜色（共享 helper）
// - 默认颜色（如果用户没设）
// - 读用户自定义颜色
// - 生成 inline style 用于 type badge
// ============================================

import { POST_TYPES } from "./schedule-constants"

export { POST_TYPES as TYPE_ORDER }  // D29 向后兼容：以前叫 TYPE_ORDER 的地方

export const DEFAULT_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  "干货": { bg: "#ebf4ff", fg: "#2c5282" },
  "生活": { bg: "#fef5e7", fg: "#c05621" },
  "客户": { bg: "#e6fffa", fg: "#234e52" },
  "互动": { bg: "#faf5ff", fg: "#553c9a" },
  "软广": { bg: "#fff5f5", fg: "#c53030" },
  "复盘": { bg: "#f0fff4", fg: "#22543d" },
  "休息": { bg: "#edf2f7", fg: "#4a5568" },
}

export async function loadUserColors(env: { DB?: D1Database }, userId: string): Promise<Record<string, { bg: string; fg: string }>> {
  if (!env.DB) return DEFAULT_TYPE_COLORS
  const row = await env.DB.prepare(
    "SELECT type_colors FROM user_settings WHERE user_id = ?"
  ).bind(userId).first<{ type_colors: string }>()
  if (!row) return DEFAULT_TYPE_COLORS
  try {
    const parsed = JSON.parse(row.type_colors)
    // 合并：用户缺省类型用默认
    return { ...DEFAULT_TYPE_COLORS, ...parsed }
  } catch {
    return DEFAULT_TYPE_COLORS
  }
}

// 给 type 生成 inline style（背景 + 文字色）
export function typeStyle(colors: Record<string, { bg: string; fg: string }>, type: string): string {
  const c = colors[type] || DEFAULT_TYPE_COLORS[type] || DEFAULT_TYPE_COLORS["休息"]
  return `background:${c.bg};color:${c.fg}`
}
