// ============================================
// /api/schedule
// 排期 CRUD（slot 维度：每用户每天最多 4 段 × 7 种类型）
//
// GET    /api/schedule                          当前用户所有排期
// GET    /api/schedule?month=YYYY-MM            按月
// GET    /api/schedule?date=YYYY-MM-DD          按日期（返回多条，按 slot 排序）
// POST   /api/schedule                          创建/替换一天某段 { date, slot, post_type, ... }
// PUT    /api/schedule?date=YYYY-MM-DD&slot=X   更新某天某段
// DELETE /api/schedule?date=YYYY-MM-DD&slot=X   删除某天某段
//   不带 slot：删除整天所有段
// POST   /api/schedule/seed                     一键 seed 30 天（按 user_settings.default_slots_per_day + per-date 覆盖）
//   7 天循环：干货/生活/客户/互动/软广/复盘/休息
//
// post_type: '干货' | '生活' | '客户' | '互动' | '软广' | '复盘' | '休息'
// slot:      'morning' | 'noon' | 'evening' | 'night'
// status:    'pending' | 'posted' | 'skipped'
// ============================================

import { getUser, json, jsonError, newId, readJson, CrudError } from "./crud-helper"
import {
  POST_TYPES, ROTATION, TYPE_TO_TEMPLATE, isPostType, isSlot,
  ymd, addDays, loadEnabledSlots, SlotId,
} from "../lib/schedule-constants"

interface ScheduleRow {
  id: string
  user_id: string
  date: string
  slot: string
  post_type: string
  template_id: string | null
  status: string
  note: string | null
  sort_order: number
  updated_at: number | null
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
    const date = url.searchParams.get("date")
    const month = url.searchParams.get("month")

    if (date) {
      // 单天 → 返回多条（按 slot 排序）
      const rows = await ctx.env.DB.prepare(
        "SELECT * FROM schedule WHERE user_id = ? AND date = ? ORDER BY slot ASC"
      ).bind(user.id, date).all<ScheduleRow>()
      return json({ schedules: rows.results || [], date })
    }

    let query = "SELECT * FROM schedule WHERE user_id = ?"
    const params: unknown[] = [user.id]
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query += " AND date LIKE ?"
      params.push(`${month}-%`)
    }
    query += " ORDER BY date ASC, slot ASC"

    const rows = await ctx.env.DB.prepare(query).bind(...params).all<ScheduleRow>()
    return json({ schedule: rows.results || [] })
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
    // 注：/api/schedule/seed 子端点由 functions/api/schedule/seed.ts 单独处理

    const body = await readJson<Record<string, unknown>>(ctx.request)
    const date = String(body.date || "").trim()
    const slot = body.slot ? String(body.slot) : "morning"
    const postType = String(body.post_type || "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new CrudError("date 必须是 YYYY-MM-DD", 400)
    }
    if (!isSlot(slot)) {
      throw new CrudError(`slot 必须是 morning/noon/evening/night`, 400)
    }
    if (!isPostType(postType)) {
      throw new CrudError(`post_type 必须是：${POST_TYPES.join("/")}`, 400)
    }
    const templateId = body.template_id ? String(body.template_id) : TYPE_TO_TEMPLATE[postType]
    const note = body.note ? String(body.note) : null
    const now = Date.now()

    const id = newId()
    try {
      await ctx.env.DB.prepare(
        `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?)`
      ).bind(id, user.id, date, slot, postType, templateId, note, now).run()
    } catch (err: any) {
      if (String(err?.message || "").includes("UNIQUE")) {
        // 已存在 → 改成更新
        await ctx.env.DB.prepare(
          `UPDATE schedule SET post_type = ?, template_id = ?, note = ?, updated_at = ?
           WHERE user_id = ? AND date = ? AND slot = ?`
        ).bind(postType, templateId, note, now, user.id, date, slot).run()
        return json({ ok: true, updated: true, date, slot })
      }
      throw err
    }
    return json({ ok: true, id, date, slot, post_type: postType, template_id: templateId }, 201)
  } catch (err) {
    return jsonError(err)
  }
}

export async function onRequestPut(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const url = new URL(ctx.request.url)
    const date = url.searchParams.get("date")
    const slot = url.searchParams.get("slot")
    if (!date) throw new CrudError("缺少 date 参数（?date=YYYY-MM-DD）", 400)
    if (!slot) throw new CrudError("缺少 slot 参数（?slot=morning|noon|evening|night）", 400)
    if (!isSlot(slot)) throw new CrudError(`slot 必须是 morning/noon/evening/night`, 400)

    const body = await readJson<Record<string, unknown>>(ctx.request)
    const updates: string[] = []
    const values: unknown[] = []

    if (body.post_type !== undefined) {
      if (!isPostType(String(body.post_type))) {
        throw new CrudError(`post_type 必须是：${POST_TYPES.join("/")}`, 400)
      }
      updates.push("post_type = ?")
      values.push(String(body.post_type))
    }
    if (body.template_id !== undefined) {
      updates.push("template_id = ?")
      values.push(body.template_id ? String(body.template_id) : null)
    }
    if (body.status !== undefined) {
      if (!["pending", "posted", "skipped"].includes(String(body.status))) {
        throw new CrudError("status 必须是 pending/posted/skipped", 400)
      }
      updates.push("status = ?")
      values.push(String(body.status))
    }
    if (body.note !== undefined) {
      updates.push("note = ?")
      values.push(body.note ? String(body.note) : null)
    }
    if (updates.length === 0) throw new CrudError("没有要更新的字段", 400)

    updates.push("updated_at = ?")
    values.push(Date.now())
    values.push(user.id, date, slot)

    const result = await ctx.env.DB.prepare(
      `UPDATE schedule SET ${updates.join(", ")} WHERE user_id = ? AND date = ? AND slot = ?`
    ).bind(...values).run()
    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError("该日期+时段没有排期（先 POST 创建）", 404)
    }
    return json({ ok: true })
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
    const date = url.searchParams.get("date")
    const slot = url.searchParams.get("slot")
    if (!date) throw new CrudError("缺少 date 参数（?date=YYYY-MM-DD）", 400)

    let result
    if (slot) {
      // 删某天某段
      if (!isSlot(slot)) throw new CrudError(`slot 必须是 morning/noon/evening/night`, 400)
      result = await ctx.env.DB.prepare(
        "DELETE FROM schedule WHERE user_id = ? AND date = ? AND slot = ?"
      ).bind(user.id, date, slot).run()
    } else {
      // 删整天
      result = await ctx.env.DB.prepare(
        "DELETE FROM schedule WHERE user_id = ? AND date = ?"
      ).bind(user.id, date).run()
    }
    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError(slot ? "该日期+时段没有排期" : "该日期没有排期", 404)
    }
    return json({ ok: true, deleted: result.meta?.changes })
  } catch (err) {
    return jsonError(err)
  }
}

// 注：/api/schedule/seed 子端点由 functions/api/schedule/seed.ts 单独处理
