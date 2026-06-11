// ============================================
// GET  /api/weekly/summary        查本周 + 上周汇总
// POST /api/weekly/summary        手动触发"本周汇总"（写入 weekly_summaries + 可选生成 AI 复盘文案）
//   body?: { week_start?: 'YYYY-MM-DD' }  // 不传 = 本周
// ============================================

import { getUser, json, jsonError, readJson, CrudError, newId } from "../crud-helper"
import { loadWeekData, renderSummaryText, startOfWeek, ymd } from "../../lib/weekly"

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)

    const now = new Date()
    const thisWeek = startOfWeek(now)
    const lastWeek = new Date(thisWeek)
    lastWeek.setDate(lastWeek.getDate() - 7)

    const thisData = await loadWeekData(ctx.env.DB, user.id, thisWeek)
    const lastData = await loadWeekData(ctx.env.DB, user.id, lastWeek)

    // 读 weekly_summaries 表（如果已生成过）
    const cached = await ctx.env.DB.prepare(
      "SELECT * FROM weekly_summaries WHERE user_id = ? AND week_start IN (?, ?) ORDER BY week_start DESC"
    ).bind(user.id, ymd(thisWeek), ymd(lastWeek)).all<{
      id: string; user_id: string; week_start: string; week_end: string;
      posted_count: number; skipped_count: number; pending_count: number;
      type_breakdown: string; slot_breakdown: string;
      summary_text: string | null; generated_at: number;
    }>()

    return json({
      ok: true,
      this_week: thisData,
      last_week: lastData,
      cached: cached.results || [],
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
    const body = await readJson<{ week_start?: string }>(ctx.request).catch(() => ({} as any))

    // 1. 算 week_start
    const start = body.week_start
      ? new Date(body.week_start + "T00:00:00")
      : startOfWeek(new Date())
    if (isNaN(start.getTime())) throw new CrudError("week_start 格式错", 400)

    const data = await loadWeekData(ctx.env.DB, user.id, start)
    const summaryText = renderSummaryText(data)
    const now = Date.now()

    // 2. UPSERT weekly_summaries
    const id = newId()
    await ctx.env.DB.prepare(
      `INSERT INTO weekly_summaries
        (id, user_id, week_start, week_end, posted_count, skipped_count, pending_count,
         type_breakdown, slot_breakdown, summary_text, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, week_start) DO UPDATE SET
         week_end = excluded.week_end,
         posted_count = excluded.posted_count,
         skipped_count = excluded.skipped_count,
         pending_count = excluded.pending_count,
         type_breakdown = excluded.type_breakdown,
         slot_breakdown = excluded.slot_breakdown,
         summary_text = excluded.summary_text,
         generated_at = excluded.generated_at`
    ).bind(
      id, user.id, data.week_start, data.week_end,
      data.posted, data.skipped, data.pending,
      JSON.stringify(data.byType), JSON.stringify(data.bySlot),
      summaryText, now
    ).run()

    // D30: 自动 fill 到本周日早 8 段（如果周日还没排"复盘"）
    const sundayDate = ymd(new Date(data.week_end + "T00:00:00"))  // week_end 就是周日
    const sundaySched = await ctx.env.DB.prepare(
      "SELECT id, post_type, status FROM schedule WHERE user_id = ? AND date = ? AND slot = 'morning'"
    ).bind(user.id, sundayDate).first<{ id: string; post_type: string; status: string }>()
    let autoFilled = false
    if (!sundaySched || sundaySched.post_type !== '复盘') {
      // 没排或不是复盘 → 自动创建/更新 1 条复盘
      if (sundaySched) {
        await ctx.env.DB.prepare(
          "UPDATE schedule SET post_type = '复盘', template_id = 'review', note = ?, updated_at = ? WHERE id = ?"
        ).bind(summaryText.slice(0, 500), now, sundaySched.id).run()
      } else {
        await ctx.env.DB.prepare(
          "INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at) VALUES (?, ?, ?, 'morning', '复盘', 'review', 'pending', ?, 0, ?)"
        ).bind(newId(), user.id, sundayDate, summaryText.slice(0, 500), now).run()
      }
      autoFilled = true
    }

    // D36: 算本周主题 + 本月阶段 + 7 维度覆盖
    const { getWeeklyTheme, getMonthlyPhase, reverseDimensionMap, DIMENSION_TYPE_MAP } = await import("../../lib/schedule-constants")
    const weekTheme = getWeeklyTheme(data.week_start, null)
    const monthPhase = getMonthlyPhase(data.week_start.slice(0, 7), null)
    // 7 维度覆盖度：本周已发 posts → 反查维度
    const dimCounts: Record<string, number> = {}
    for (const dim of Object.keys(DIMENSION_TYPE_MAP)) dimCounts[dim] = 0
    for (const d of data.byDay) {
      if (d.status === 'posted') {
        for (const dim of reverseDimensionMap(d.post_type)) {
          dimCounts[dim] = (dimCounts[dim] || 0) + 1
        }
      }
    }

    // D36: 升级 summary_text（加主题 + 阶段 + 维度）
    const dimLine = Object.entries(dimCounts).filter(([_, n]) => n > 0).map(([k, v]) => k + ' ' + v).join(' / ') || '暂无'
    const upgradedText = summaryText + ' · 📌 本周主题：' + weekTheme.label + '（第 ' + (weekTheme.cycleIndex + 1) + '/4 周循环） · 月阶段：' + monthPhase.label + '（第 ' + monthPhase.cycleIndex + '/3 月） · 7 维度覆盖：' + dimLine

    return json({
      ok: true,
      week_start: data.week_start,
      week_end: data.week_end,
      summary_text: upgradedText,
      auto_filled: autoFilled,
      weekly_theme: { theme: weekTheme.theme, label: weekTheme.label, cycle_index: weekTheme.cycleIndex, locked: weekTheme.locked },
      monthly_phase: { phase: monthPhase.phase, label: monthPhase.label, cycle_index: monthPhase.cycleIndex, locked: monthPhase.locked },
      dimensions: dimCounts,
    })
  } catch (err) {
    return jsonError(err)
  }
}
