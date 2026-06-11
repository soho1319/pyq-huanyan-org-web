// ============================================
// POST /api/schedule/seed
// 一键 seed N 天 × M 段（D55 彻底切到 dim）
// - 读 user_settings.default_slots_per_day（per-date JSON 覆盖优先）
// - 7 天循环：A/B/C/D/E/F/G（7 维度）
// - 5 段固定时段：morning/noon/evening/late/night
// - D31：如果有 theme_months（按 year_month），按权重选 dim
// - 已存在 → 跳过（除非 overwrite=true）
// - 缺槽位 → batch INSERT 一次往返
// ============================================

import { getUser, json, jsonError, readJson, CrudError, newId } from "../crud-helper"
import {
  DIM_IDS, isDim, ymd, ymdInTZ, addDays, type Dim,
  loadEnabledSlots, loadWeekdayWeights, SLOTS, type SlotId,
  getWeekdayPhase, getMonthlyPhase, getWeeklyTheme,
  SLOT_TONAL_WEIGHTS, WEEKEND_TONAL,
} from "../../lib/schedule-constants"
import { getThemeWeights } from "../theme-month"

// 加权随机（D55: 4 段独立 dim 用）
function weightedPick(weights: Record<string, number>): Dim {
  const entries = Object.entries(weights) as [Dim, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return (entries[0]?.[0] || 'F') as Dim
  let r = Math.random() * total
  for (const [d, w] of entries) {
    r -= w
    if (r <= 0) return d
  }
  return entries[entries.length - 1]?.[0] as Dim
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
    // D55-16: 用 CST 算默认起始日
    const startDateStr = body.start_date ? String(body.start_date) : ymdInTZ(new Date(), "Asia/Shanghai")
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

    // D55-17: 读用户排期开关（use_month_theme / use_week_theme / day_rule_weights_json）
    const settingsRow = await ctx.env.DB.prepare(
      "SELECT use_month_theme, use_week_theme, day_rule_weights_json FROM user_settings WHERE user_id = ?"
    ).bind(user.id).first<{ use_month_theme: number; use_week_theme: number; day_rule_weights_json: string | null }>()
    const useMonthTheme = settingsRow?.use_month_theme !== 0   // 默认 1
    const useWeekTheme = settingsRow?.use_week_theme !== 0     // 默认 1
    // 用户自定义 4 层权重（base/month/week/phase）总和 = 1，null = 用默认 50/20/20/10
    const userDayWeights: { base: number; month: number; week: number; phase: number } | null =
      settingsRow?.day_rule_weights_json ? JSON.parse(settingsRow.day_rule_weights_json) : null

    // D55: 直接复用 schedule-constants.ts 的 SLOT_TONAL_WEIGHTS / WEEKEND_TONAL（已严按 5 段 + 7 维度对齐）
    // 5 段口诀（每日.md + D55-3 最终版）：
    //   早 7-9   F 思想 + C 情绪 + E 生活  → 反认知金句/价值观/小确幸
    //   午 12-14 G 关系 + C 情绪 + E 生活  → 互动/钩子/收尾
    //   傍 18-19 B 专业 + A 观赏  → 干货/案例/高级配图
    //   晚 20-22 G 关系 + C 情绪  → 连载/互动/复盘/软广种草
    //   夜 22-23 E 生活 + D 身份  → 感悟/反思/自嘲
    const pickWeightedType = async (slot: SlotId, date: string, isWeekend: boolean, exclude: Set<Dim> = new Set()): Promise<Dim> => {
      // L1: 5 段调性 base（按 dim 7 权重）
      const base = isWeekend ? WEEKEND_TONAL[slot] : SLOT_TONAL_WEIGHTS[slot]
      // L2: 月主题权重（按 dim 7 权重，D55-17: useMonthTheme=0 时全用平均）
      const defaultMonthW: Record<Dim, number> = { A: 0.14, B: 0.14, C: 0.14, D: 0.15, E: 0.14, F: 0.15, G: 0.14 }
      const monthW = (useMonthTheme && themeWeights ? themeWeights : defaultMonthW) as Record<Dim, number>
      // L3: 周主题权重（按 dim 7 权重，D55-17: 传 user.cycle_start_date，useWeekTheme=0 时用平均）
      const defaultWeekW: Record<Dim, number> = { A: 0.14, B: 0.14, C: 0.14, D: 0.15, E: 0.14, F: 0.15, G: 0.14 }
      const weekInfo = getWeeklyTheme(date, null, (user as any).cycle_start_date)
      const weekW = (useWeekTheme ? weekInfo.weights : defaultWeekW) as Record<Dim, number>
      // L4: 周内 dayOfWeek phase 权重（按 dim 7 权重）
      const dayOfWeek = new Date(date + 'T00:00:00').getDay()
      const phase = getWeekdayPhase(dayOfWeek)
      const weekdayWeights = await loadWeekdayWeights(ctx.env, user.id)
      const phaseW = weekdayWeights[phase] || weekdayWeights

      // 加权综合：D55-17 支持用户自定义 4 层权重（默认 50/20/20/10）
      const w = userDayWeights || { base: 0.5, month: 0.2, week: 0.2, phase: 0.1 }
      const combined: Record<string, number> = {}
      for (const d of DIM_IDS) {
        if (exclude.has(d as Dim)) { combined[d] = 0; continue }
        const b = base[d as Dim] || 0
        const m = monthW[d as Dim] || 0
        const wv = weekW[d as Dim] || 0
        const p = phaseW[d as Dim] || 0
        combined[d] = b * w.base + m * w.month + wv * w.week + p * w.phase
      }
      return weightedPick(combined as Record<Dim, number>)
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

      const toInsert: Array<{ slot: SlotId; dim: Dim; category_id: string | null; template_id: string; sort_order: number }> = []
      const toUpdate: Array<{ slot: SlotId; dim: Dim; category_id: string | null; template_id: string; sort_order: number }> = []
      for (const slot of slots) {
        const rowCount = SLOT_DEFAULT_ROWS[slot] || 1
        const usedDims = new Set<Dim>()
        for (let ord = 0; ord < rowCount; ord++) {
          // D55: 每段独立按"调性 + 主题月"选 dim；第 2 条排除第 1 条
          const slotDim = await pickWeightedType(slot, date, isWeekend, usedDims)
          usedDims.add(slotDim)
          // D55: dim 关联的 template_id 简化（用 dim id 作 template_id）
          const slotTpl = slotDim  // D55: 简化，template_id = dim id
          // D55: 查 top1 category（按 dim + slot 排序）作 category_id
          let catId: string | null = null
          try {
            const catRow = await ctx.env.DB.prepare(
              "SELECT id FROM categories WHERE dim = ? AND is_active = 1 AND (slot = ? OR slot_secondary LIKE ?) ORDER BY sort_order ASC LIMIT 1"
            ).bind(slotDim, slot, `%"${slot}"%`).first<{ id: string }>()
            catId = catRow?.id || null
          } catch {}
          const key = `${slot}:${ord}`
          if (existingSlotSet.has(key)) {
            if (overwrite) {
              if (existingStatusMap.get(key) === 'posted') {
                skipped++
              } else {
                toUpdate.push({ slot, dim: slotDim, category_id: catId, template_id: slotTpl, sort_order: ord })
              }
            } else skipped++
          } else {
            toInsert.push({ slot, dim: slotDim, category_id: catId, template_id: slotTpl, sort_order: ord })
          }
        }
      }

      // batch UPDATE（每行 1 条 SQL）
      if (toUpdate.length > 0) {
        for (const r of toUpdate) {
          await ctx.env.DB.prepare(
            "UPDATE schedule SET dim = ?, category_id = ?, template_id = ?, updated_at = ? WHERE user_id = ? AND date = ? AND slot = ? AND sort_order = ?"
          ).bind(r.dim, r.category_id, r.template_id, now, user.id, date, r.slot, r.sort_order).run()
          updated++
        }
      }

      // batch INSERT（一次往返，D55 写 dim + category_id + 同时兼容旧 post_type 字段）
      if (toInsert.length > 0) {
        const placeholders = toInsert.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)").join(",")
        const values: unknown[] = []
        for (const r of toInsert) {
          // post_type 字段保留并填 dim 旧映射（兼容旧 schema）
          const oldTypeFromDim: Record<string, string> = { A: '干货', B: '客户', C: '软广', D: '干货', E: '生活', F: '干货', G: '互动' }
          values.push(newId(), user.id, date, r.slot, r.dim, r.dim, r.category_id, oldTypeFromDim[r.dim] || '干货', r.template_id, r.sort_order, now)
        }
        try {
          await ctx.env.DB.prepare(
            `INSERT INTO schedule (id, user_id, date, slot, dim, category_id, post_type, template_id, status, note, sort_order, updated_at) VALUES ${placeholders}`
          ).bind(...values).run()
        } catch {
          // 兼容旧 schema（无 dim/category_id 列）
          const oldPlaceholders = toInsert.map(() => "(?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)").join(",")
          const oldValues: unknown[] = []
          for (const r of toInsert) {
            const oldTypeFromDim: Record<string, string> = { A: '干货', B: '客户', C: '软广', D: '干货', E: '生活', F: '干货', G: '互动' }
            oldValues.push(newId(), user.id, date, r.slot, oldTypeFromDim[r.dim] || '干货', r.template_id, r.sort_order, now)
          }
          await ctx.env.DB.prepare(
            `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at) VALUES ${oldPlaceholders}`
          ).bind(...oldValues).run()
        }
        inserted += toInsert.length
      }
    }

    return json({ ok: true, inserted, updated, skipped, start_date: startDateStr, days })
  } catch (err) {
    return jsonError(err)
  }
}
