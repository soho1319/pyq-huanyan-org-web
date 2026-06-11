// ============================================
// UI 主题色（共享 helper）
// - 加载用户主题
// - 默认：紫色渐变 #667eea → #764ba2
// ============================================

export const DEFAULT_THEME = {
  start: "#667eea",
  end: "#764ba2",
  solid: "#667eea",  // 用于 subnav active 等纯色场景
}

export interface Theme { start: string; end: string; solid: string }

// 注入 CSS 变量到 <head>
// 用法：<head>${themeCssVar(theme)}<style>...</style></head>
// 然后 CSS 里用 var(--ts) var(--te) var(--t) var(--ts-rgb)
export function themeCssVar(theme: Theme): string {
  const sRgb = hexToRgb(theme.start)
  return `<style>:root{--ts:${theme.start};--te:${theme.end};--t:${theme.solid};--ts-rgb:${sRgb};}</style>`
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r},${g},${b}`
}

export async function loadUserTheme(env: { DB?: D1Database }, userId: string): Promise<Theme> {
  if (!env.DB) return DEFAULT_THEME
  const row = await env.DB.prepare(
    "SELECT theme_start, theme_end FROM user_settings WHERE user_id = ?"
  ).bind(userId).first<{ theme_start: string; theme_end: string }>()
  if (!row) return DEFAULT_THEME
  return {
    start: row.theme_start || DEFAULT_THEME.start,
    end: row.theme_end || DEFAULT_THEME.end,
    solid: row.theme_start || DEFAULT_THEME.solid,
  }
}
