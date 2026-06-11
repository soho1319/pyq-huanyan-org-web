// ============================================
// GET    /api/theme-month                  查所有主题月
// GET    /api/theme-month?month=YYYY-MM    查某月
// POST   /api/theme-month                  设置某月主题 { year_month, theme, custom_label?, weights? }
// DELETE /api/theme-month?month=YYYY-MM    删某月主题
//
// theme: 'trust' | 'pro' | 'sale' | 'recovery' | 'custom'
// weights: { 干货: 0.3, 客户: 0.2, ... }（总和=1），仅 theme='custom' 用
// ============================================

import { getUser, json, jsonError, readJson, CrudError, newId } from "./crud-helper"
import { POST_TYPES } from "../lib/schedule-constants"

// 4 预设主题 → 7 类占比
const PRESET_WEIGHTS: Record<string, Record<string, number>> = {
  // 信任月：客户/互动占比提到 30%
  trust:    { "干货": 0.10, "生活": 0.10, "客户": 0.30, "互动": 0.20, "软广": 0.10, "复盘": 0.15, "休息": 0.05 },
  // 专业月：干货 40%
  pro:      { "干货": 0.40, "生活": 0.10, "客户": 0.10, "互动": 0.10, "软广": 0.10, "复盘": 0.15, "休息": 0.05 },
  // 销售月：软广/复盘 30%
  sale:     { "干货": 0.10, "生活": 0.10, "客户": 0.15, "互动": 0.10, "软广": 0.30, "复盘": 0.20, "休息": 0.05 },
  // 恢复月：生活/休息 30%
  recovery: { "干货": 0.10, "生活": 0.30, "客户": 0.10, "互动": 0.10, "软广": 0.05, "复盘": 0.05, "休息": 0.30 },
}

const THEME_LABELS: Record<string, string> = {
  trust: "信任月",
  pro: "专业月",
  sale: "销售月",
  recovery: "恢复月",
  custom: "自定义",
}

export function getThemeWeights(theme: string, customWeights?: Record<string, number>): Record<string, number> {
  if (theme === 'custom') return customWeights || PRESET_WEIGHTS.trust
  return PRESET_WEIGHTS[theme] || PRESET_WEIGHTS.trust
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const url = new URL(ctx.request.url)
    const month = url.searchParams.get("month")

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) throw new CrudError("month 必须是 YYYY-MM", 400)
      const row = await ctx.env.DB.prepare(
        "SELECT * FROM theme_months WHERE user_id = ? AND year_month = ?"
      ).bind(user.id, month).first<{
        id: string; user_id: string; year_month: string; theme: string;
        weights_json: string; custom_label: string | null; cycle_index: number; created_at: number; updated_at: number;
      }>()
      if (!row) {
        // D36: 没存 → 自动算 phase
        const { getMonthlyPhase } = await import("../lib/schedule-constants")
        const auto = getMonthlyPhase(month, null)
        return json({ ok: true, theme: null, month, auto_phase: auto.phase, auto_label: auto.label, auto_weights: auto.weights })
      }
      const weights = JSON.parse(row.weights_json)
      return json({
        ok: true,
        theme: row.theme,
        label: row.custom_label || THEME_LABELS[row.theme] || row.theme,
        weights,
        month: row.year_month,
        cycle_index: row.cycle_index || 0,
      })
    }

    const rows = await ctx.env.DB.prepare(
      "SELECT * FROM theme_months WHERE user_id = ? ORDER BY year_month DESC"
    ).bind(user.id).all<{
      id: string; user_id: string; year_month: string; theme: string;
      weights_json: string; custom_label: string | null; created_at: number; updated_at: number;
    }>()
    const list = (rows.results || []).map(r => ({
      year_month: r.year_month,
      theme: r.theme,
      label: r.custom_label || THEME_LABELS[r.theme] || r.theme,
      weights: JSON.parse(r.weights_json),
    }))
    return json({ ok: true, themes: list, presets: PRESET_WEIGHTS, labels: THEME_LABELS, post_types: POST_TYPES })
  } catch (err) {
    return jsonError(err)
  }
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const body = await readJson<{ year_month: string; theme: string; custom_label?: string; weights?: Record<string, number>; cycle_index?: number }>(ctx.request)
    const ym = String(body.year_month || "")
    const theme = String(body.theme || "trust")
    if (!/^\d{4}-\d{2}$/.test(ym)) throw new CrudError("year_month 必须是 YYYY-MM", 400)
    if (!['trust', 'pro', 'sale', 'recovery', 'custom'].includes(theme)) {
      throw new CrudError(`theme 必须是 trust/pro/sale/recovery/custom`, 400)
    }
    const weights = getThemeWeights(theme, body.weights)
    // 验证 weights 总和接近 1（容差 0.05）
    const sum = Object.values(weights).reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1) > 0.05) {
      throw new CrudError(`weights 总和应接近 1（当前 ${sum.toFixed(2)}）`, 400)
    }
    // D36: cycle_index（1/2/3 = 3 月循环覆盖；0/缺 = 不参与，按 4 固定主题行为）
    const cycleIndex = body.cycle_index !== undefined && body.cycle_index !== null
      ? Math.max(0, Math.min(3, parseInt(String(body.cycle_index)) || 0))
      : 0
    const customLabel = body.custom_label ? String(body.custom_label).slice(0, 30) : null
    const now = Date.now()
    const id = newId()
    await ctx.env.DB.prepare(
      `INSERT INTO theme_months (id, user_id, year_month, theme, weights_json, custom_label, cycle_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, year_month) DO UPDATE SET
         theme = excluded.theme,
         weights_json = excluded.weights_json,
         custom_label = excluded.custom_label,
         cycle_index = excluded.cycle_index,
         updated_at = excluded.updated_at`
    ).bind(id, user.id, ym, theme, JSON.stringify(weights), customLabel, cycleIndex, now, now).run()
    return json({ ok: true, year_month: ym, theme, label: customLabel || THEME_LABELS[theme], weights, cycle_index: cycleIndex })
  } catch (err) {
    return jsonError(err)
  }
}

export async function onRequestDelete(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const url = new URL(ctx.request.url)
    const month = url.searchParams.get("month")
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new CrudError("缺 month 参数（?month=YYYY-MM）", 400)
    }
    const result = await ctx.env.DB.prepare(
      "DELETE FROM theme_months WHERE user_id = ? AND year_month = ?"
    ).bind(user.id, month).run()
    return json({ ok: true, deleted: result.meta?.changes || 0 })
  } catch (err) {
    return jsonError(err)
  }
}
