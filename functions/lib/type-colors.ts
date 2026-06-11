// ============================================
// 7 维度颜色（共享 helper）— D55 彻底切换
// - 默认颜色（如果用户没设）
// - 读用户自定义颜色
// - 生成 inline style 用于 dim badge
// - 兼容旧 7 type：自动按 dim 映射读颜色
// ============================================

import { DIM_IDS, type Dim } from "./schedule-constants"

export { DIM_IDS as TYPE_ORDER }  // D55 向后兼容：以前叫 TYPE_ORDER 的地方

// D55: 7 维度默认色（每维度用课程术语的语义化配色）
export const DEFAULT_TYPE_COLORS: Record<Dim, { bg: string; fg: string }> = {
  A: { bg: "#fef5e7", fg: "#c05621" },   // 观赏价值 → 暖橙
  B: { bg: "#ebf4ff", fg: "#2c5282" },   // 专业价值 → 蓝
  C: { bg: "#faf5ff", fg: "#553c9a" },   // 情绪价值 → 紫
  D: { bg: "#e6fffa", fg: "#234e52" },   // 身份维度 → 青
  E: { bg: "#f0fff4", fg: "#22543d" },   // 生活维度 → 绿
  F: { bg: "#fff5f5", fg: "#c53030" },   // 思想维度 → 红
  G: { bg: "#fdf4ff", fg: "#86198f" },   // 关系维度 → 玫紫
}

// D55: 旧 7 type → dim 映射（读旧 type_colors 时回退用）
const OLD_TYPE_TO_DIM: Record<string, Dim> = {
  '干货': 'F', '生活': 'E', '客户': 'B', '互动': 'G', '软广': 'C', '复盘': 'F', '休息': 'E',
}

// 旧 7 type 默认色（D29 历史遗留，向后兼容）
export const LEGACY_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  "干货": { bg: "#ebf4ff", fg: "#2c5282" },
  "生活": { bg: "#fef5e7", fg: "#c05621" },
  "客户": { bg: "#e6fffa", fg: "#234e52" },
  "互动": { bg: "#faf5ff", fg: "#553c9a" },
  "软广": { bg: "#fff5f5", fg: "#c53030" },
  "复盘": { bg: "#f0fff4", fg: "#22543d" },
  "休息": { bg: "#edf2f7", fg: "#4a5568" },
}

// D55: 合并的 colors（按 dim 7 键 + 兼容按 type 7 键）
export const ALL_COLORS: Record<string, { bg: string; fg: string }> = {
  ...LEGACY_TYPE_COLORS,
  ...DEFAULT_TYPE_COLORS,
}

export async function loadUserColors(env: { DB?: D1Database }, userId: string): Promise<Record<string, { bg: string; fg: string }>> {
  if (!env.DB) return ALL_COLORS
  // D55: 优先读 dim_colors（新字段），回退到 type_colors（旧字段）
  const row = await env.DB.prepare(
    "SELECT dim_colors, type_colors FROM user_settings WHERE user_id = ?"
  ).bind(userId).first<{ dim_colors: string | null; type_colors: string | null }>()
  if (!row) return ALL_COLORS
  let merged: Record<string, { bg: string; fg: string }> = { ...ALL_COLORS }
  if (row.type_colors) {
    try { merged = { ...merged, ...JSON.parse(row.type_colors) } } catch {}
  }
  if (row.dim_colors) {
    try { merged = { ...merged, ...JSON.parse(row.dim_colors) } } catch {}
  }
  return merged
}

// 给 dim/type 生成 inline style（背景 + 文字色）
// 接受 dim 字符 ('A'-'G') 或旧 type ('干货'-'休息')
export function typeStyle(colors: Record<string, { bg: string; fg: string }>, key: string): string {
  // D55 优先按 dim 查
  if (DIM_IDS.includes(key as Dim)) {
    const c = colors[key] || DEFAULT_TYPE_COLORS[key as Dim]
    return `background:${c.bg};color:${c.fg}`
  }
  // 回退按旧 type 查
  const c = colors[key] || LEGACY_TYPE_COLORS[key] || DEFAULT_TYPE_COLORS[OLD_TYPE_TO_DIM[key] || 'F']
  return `background:${c.bg};color:${c.fg}`
}
