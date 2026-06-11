// ============================================
// GET    /api/weekly-theme                    所有周主题
// GET    /api/weekly-theme?week_start=...     单周（含自动算的 theme）
// POST   /api/weekly-theme                    锁定单周 { week_start, theme }
// DELETE /api/weekly-theme?week_start=...     解锁（恢复自动循环）
// D36: 朋友圈 4 周循环主题（立人设/反认知/讲故事/立边界）
// ============================================

import { getUser, json, jsonError, readJson, CrudError, newId } from "./crud-helper"
import { WEEKLY_THEMES, WeeklyThemeId, getWeeklyTheme, ymd } from "../lib/schedule-constants"

function isWeeklyTheme(s: string): s is WeeklyThemeId {
  return s in WEEKLY_THEMES
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
    const weekStart = url.searchParams.get("week_start")

    if (weekStart) {
      // 单周：返数据库锁定 + 自动算的 theme
      const row = await ctx.env.DB.prepare(
        "SELECT * FROM weekly_themes WHERE user_id = ? AND week_start = ?"
      ).bind(user.id, weekStart).first<{ theme: string; locked: number; created_at: number }>()

      if (row) {
        return json({
          ok: true,
          week_start: weekStart,
          theme: row.theme,
          label: WEEKLY_THEMES[row.theme as WeeklyThemeId]?.label || row.theme,
          weights: WEEKLY_THEMES[row.theme as WeeklyThemeId]?.weights || {},
          locked: true,
          cycle_index: null,
        })
      }
      // 没锁 → 自动算（D55-17: 传 user.cycle_start_date）
      const auto = getWeeklyTheme(weekStart, null, (user as any).cycle_start_date)
      return json({ ok: true, week_start: weekStart, ...auto, locked: false })
    }

    // 全部
    const rows = await ctx.env.DB.prepare(
      "SELECT week_start, theme, locked, created_at FROM weekly_themes WHERE user_id = ? ORDER BY week_start DESC"
    ).bind(user.id).all<{ week_start: string; theme: string; locked: number; created_at: number }>()
    return json({
      ok: true,
      themes: (rows.results || []).map(r => ({
        week_start: r.week_start,
        theme: r.theme,
        label: WEEKLY_THEMES[r.theme as WeeklyThemeId]?.label || r.theme,
        locked: r.locked === 1,
      })),
      presets: WEEKLY_THEMES,
    })
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
    const body = await readJson<{ week_start?: string; theme?: string }>(ctx.request)
    const weekStart = String(body.week_start || "")
    const theme = String(body.theme || "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw new CrudError("week_start 必须是 YYYY-MM-DD", 400)
    }
    if (!isWeeklyTheme(theme)) {
      throw new CrudError(`theme 必须是 identity/contrarian/story/boundary`, 400)
    }
    const weights = WEEKLY_THEMES[theme].weights
    const id = newId()
    const now = Date.now()
    await ctx.env.DB.prepare(
      `INSERT INTO weekly_themes (id, user_id, week_start, theme, weights_json, locked, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(user_id, week_start) DO UPDATE SET
         theme = excluded.theme,
         weights_json = excluded.weights_json,
         locked = 1`
    ).bind(id, user.id, weekStart, theme, JSON.stringify(weights), now).run()

    return json({ ok: true, week_start: weekStart, theme, weights, locked: true })
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
    const weekStart = url.searchParams.get("week_start")
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw new CrudError("缺 week_start 参数（?week_start=YYYY-MM-DD）", 400)
    }
    const result = await ctx.env.DB.prepare(
      "DELETE FROM weekly_themes WHERE user_id = ? AND week_start = ?"
    ).bind(user.id, weekStart).run()
    return json({ ok: true, deleted: result.meta?.changes || 0, week_start: weekStart })
  } catch (err) {
    return jsonError(err)
  }
}
