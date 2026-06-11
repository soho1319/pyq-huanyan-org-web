// ============================================
// POST /api/schedule/seed
// 一键 seed N 天 × M 段
// - 读 user_settings.default_slots_per_day（per-date JSON 覆盖优先）
// - 7 天循环：干货/生活/客户/互动/软广/复盘/休息
// - 4 段固定时段：morning/noon/evening/night
// - D31：如果有 theme_months（按 year_month），按权重选 type
// - 已存在 → 跳过（除非 overwrite=true）
// - 缺槽位 → batch INSERT 一次往返
// ============================================

import { getUser, json, jsonError, readJson, CrudError, newId } from "../crud-helper"
import {
  POST_TYPES, ROTATION, TYPE_TO_TEMPLATE, isPostType, ymd, addDays,
  loadEnabledSlots, loadWeekdayWeights, SLOTS, SlotId,
  WEEKDAY_PHASE_WEIGHTS, getWeekdayPhase, getMonthlyPhase, getWeeklyTheme,
  reverseDimensionMap, DIMENSION_TYPE_MAP,
  SLOT_TONAL_WEIGHTS, WEEKEND_TONAL, computeDaySuggestions,
} from "../../lib/schedule-constants"
import { getThemeWeights } from "../theme-month"

// 加权随机（D34: 4 段独立 post_type 用）
function weightedPick(weights: Record<string, number>): string {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return entries[0]?.[0] || "休息"
  let r = Math.random() * total
  for (const [type, w] of entries) {
    r -= w
    if (r <= 0) return type
  }
  return entries[entries.length - 1]?.[0] || "休息"
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const body = await readJson<Record<string, unknown>>(ctx.request).catch(() => ({}))
    const startDateStr = body.start_date ? String(body.start_date) : ymd(new Date())
    const days = Math.min(Math.max(parseInt(String(body.days || "30")) || 30, 1), 90)
    const overwrite = body.overwrite === true || body.overwrite === 1
    // 可选：body.slots_per_day 显式覆盖（1-4）
    const explicitSlotsPerDay = body.slots_per_day !== undefined
      ? Math.max(1, Math.min(4, parseInt(String(body.slots_per_day)) || 1))
      : null

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      throw new CrudError("start_date 必须是 YYYY-MM-DD", 400)
    }

    const start = new Date(startDateStr + "T00:00:00")
    const now = Date.now()
    let inserted = 0
    let updated = 0
    let skipped = 0

    // D31: 读该月份的主题月（user 可能在 6 月选了"信任月"）—— 按权重选 dayType
    const startMonth = startDateStr.slice(0, 7)  // 'YYYY-MM'
    const themeRow = await ctx.env.DB.prepare(
      "SELECT theme, weights_json FROM theme_months WHERE user_id = ? AND year_month = ?"
    ).bind(user.id, startMonth).first<{ theme: string; weights_json: string }>()
    const themeWeights = themeRow ? getThemeWeights(themeRow.theme, JSON.parse(themeRow.weights_json)) : null

    // D53: 直接复用 schedule-constants.ts 的 SLOT_TONAL_WEIGHTS / WEEKEND_TONAL（D52 已严按课程日排对齐）
    // 课程口诀（每日.md）：
    //   早 7-9   思想+生活  → 晨间感悟/小确幸/价值观金句
    //   午 12-14 专业+观赏  → 痛点拆解/用户案例/干货结构（建议 1-2 条）
    //   晚 20-22 关系+互动  → 故事/社群互动/报喜/种草（建议 1-2 条）
    //   夜 22:30 反思收尾  → 复盘+互动+休息
    const pickWeightedType = async (slot: SlotId, date: string, isWeekend: boolean, exclude: Set<string> = new Set()): Promise<string> => {
      // L1: 4 段调性 base
      const base = isWeekend ? WEEKEND_TONAL[slot] : SLOT_TONAL_WEIGHTS[slot]
      // L2: 月主题权重
      const monthW = themeWeights || { '干货': 0.15, '生活': 0.15, '客户': 0.14, '互动': 0.14, '软广': 0.14, '复盘': 0.14, '休息': 0.14 }
      // L3: 周主题权重
      const weekInfo = getWeeklyTheme(date, null)
      const weekW = weekInfo.weights
      // L4: 周内 dayOfWeek phase 权重
      const dayOfWeek = new Date(date + 'T00:00:00').getDay()
      const phase = getWeekdayPhase(dayOfWeek)
      const weekdayWeights = await loadWeekdayWeights(ctx.env, user.id)
      const phaseW = weekdayWeights[phase]

      // 加权综合：50/20/20/10
      const combined: Record<string, number> = {}
      for (const t of ROTATION) {
        if (exclude.has(t)) { combined[t] = 0; continue }  // D53 第 2 条排除已选
        const b = base[t] || 0
        const m = monthW[t] || 0
        const w = weekW[t] || 0
        const p = phaseW[t] || 0
        combined[t] = b * 0.5 + m * 0.2 + w * 0.2 + p * 0.1
      }
      return weightedPick(combined)
    }

    for (let i = 0; i < days; i++) {
      const d = addDays(start, i)
      const date = ymd(d)
      const dayOfWeek = d.getDay() // 0=Sun, 6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      // 不再用 dayType：每段独立按"调性权重 + 主题月"选
      // （保留 ROTATION 7 天循环作为兜底：用户未设主题月时按 slot 调性）
      void dayOfWeek  // isWeekend 已用

      // 决定这天的 slot 列表
      let slots: SlotId[]
      if (explicitSlotsPerDay !== null) {
        slots = SLOTS.slice(0, explicitSlotsPerDay).map(s => s.id)
      } else {
        slots = await loadEnabledSlots(ctx.env, user.id, date)
      }

      // 找这天已存在的 (slot, status) — D41: overwrite 时跳过 posted
      const existingRows = await ctx.env.DB.prepare(
        "SELECT slot, status, sort_order FROM schedule WHERE user_id = ? AND date = ?"
      ).bind(user.id, date).all<{ slot: string; status: string; sort_order: number }>()
      // D53: 跟踪已选的 post_type，第 2 条（sort_order=1）排除第 1 条
      const existingSlotSet = new Set((existingRows.results || []).map(r => `${r.slot}:${r.sort_order || 0}`))
      const existingStatusMap = new Map((existingRows.results || []).map(r => [`${r.slot}:${r.sort_order || 0}`, r.status]))

      // D53: 午/晚 默认 2 条（top1 sort_order=0 + top2 sort_order=1），早/夜 1 条
      const SLOT_DEFAULT_ROWS: Record<SlotId, number> = { morning: 1, noon: 2, evening: 2, night: 1 }

      const toInsert: Array<{ slot: SlotId; post_type: string; template_id: string; sort_order: number }> = []
      const toUpdate: Array<{ slot: SlotId; post_type: string; template_id: string; sort_order: number }> = []
      for (const slot of slots) {
        const rowCount = SLOT_DEFAULT_ROWS[slot] || 1
        const usedTypes = new Set<string>()
        for (let ord = 0; ord < rowCount; ord++) {
          // D34: 每段独立按"调性 + 主题月"选 type；第 2 条排除第 1 条
          const slotType = await pickWeightedType(slot, date, isWeekend, usedTypes)
          usedTypes.add(slotType)
          const slotTpl = TYPE_TO_TEMPLATE[slotType]
          const key = `${slot}:${ord}`
          if (existingSlotSet.has(key)) {
            if (overwrite) {
              if (existingStatusMap.get(key) === 'posted') {
                skipped++
              } else {
                toUpdate.push({ slot, post_type: slotType, template_id: slotTpl, sort_order: ord })
              }
            } else skipped++
          } else {
            toInsert.push({ slot, post_type: slotType, template_id: slotTpl, sort_order: ord })
          }
        }
      }

      // batch UPDATE（每行 1 条 SQL）
      if (toUpdate.length > 0) {
        for (const r of toUpdate) {
          await ctx.env.DB.prepare(
            "UPDATE schedule SET post_type = ?, template_id = ?, updated_at = ? WHERE user_id = ? AND date = ? AND slot = ? AND sort_order = ?"
          ).bind(r.post_type, r.template_id, now, user.id, date, r.slot, r.sort_order).run()
          updated++
        }
      }

      // batch INSERT（一次往返）
      if (toInsert.length > 0) {
        const placeholders = toInsert.map(() => "(?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)").join(",")
        const values: unknown[] = []
        for (const r of toInsert) {
          values.push(newId(), user.id, date, r.slot, r.post_type, r.template_id, r.sort_order, now)
        }
        await ctx.env.DB.prepare(
          `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at) VALUES ${placeholders}`
        ).bind(...values).run()
        inserted += toInsert.length
      }
    }

    return json({ ok: true, inserted, updated, skipped, start_date: startDateStr, days })
  } catch (err) {
    return jsonError(err)
  }
}
