// ============================================
// /api/schedule
// 排期 CRUD（D55 彻底切到 7 维度 A-G，兼容旧 7 type）
//
// GET    /api/schedule                          当前用户所有排期
// GET    /api/schedule?month=YYYY-MM            按月
// GET    /api/schedule?date=YYYY-MM-DD          按日期（返回多条，按 slot 排序）
// POST   /api/schedule                          创建/替换一天某段 { date, slot, dim, ... }
// PUT    /api/schedule?date=YYYY-MM-DD&slot=X   更新某天某段
// DELETE /api/schedule?date=YYYY-MM-DD&slot=X   删除某天某段
//   不带 slot：删除整天所有段
// POST   /api/schedule/seed                     一键 seed 30 天（D55 按 dim 权重 + 查 categories）
//
// dim:   'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'  （D55 替代旧 post_type）
// slot:  'morning' | 'noon' | 'evening' | 'late' | 'night'
// status: 'pending' | 'posted' | 'skipped'
// ============================================

import { getUser, json, jsonError, newId, readJson, CrudError } from "./crud-helper"
import {
  DIM_IDS, isDim, type Dim,
  ymd, addDays, loadEnabledSlots, isSlot, SlotId,
  loadTopCategoryForDim,
} from "../lib/schedule-constants"

interface ScheduleRow {
  id: string
  user_id: string
  date: string
  slot: string
  post_type: string | null      // 兼容旧字段
  dim: string | null            // D55 新字段
  category_id: string | null     // D55 新字段
  template_id: string | null
  status: string
  note: string | null
  sort_order: number
  updated_at: number | null
}

// D55: 旧 7 type → dim 映射
const OLD_TYPE_TO_DIM: Record<string, Dim> = {
  '干货': 'F', '生活': 'E', '客户': 'B', '互动': 'G', '软广': 'C', '复盘': 'F', '休息': 'E',
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
        "SELECT id, user_id, date, slot, post_type, dim, category_id, template_id, status, note, sort_order, updated_at FROM schedule WHERE user_id = ? AND date = ? ORDER BY slot ASC, sort_order ASC"
      ).bind(user.id, date).all<ScheduleRow>()
      return json({ schedules: rows.results || [], date })
    }

    let query = "SELECT id, user_id, date, slot, post_type, dim, category_id, template_id, status, note, sort_order, updated_at FROM schedule WHERE user_id = ?"
    const params: unknown[] = [user.id]
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query += " AND date LIKE ?"
      params.push(`${month}-%`)
    }
    query += " ORDER BY date ASC, slot ASC, sort_order ASC"

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
    // D55: 优先 dim，回退 post_type（旧字段映射到 dim）
    let dim: Dim = 'F'
    if (body.dim && isDim(String(body.dim))) {
      dim = body.dim as Dim
    } else if (body.post_type) {
      dim = OLD_TYPE_TO_DIM[String(body.post_type)] || 'F'
    } else {
      throw new CrudError(`dim 必须是：A/B/C/D/E/F/G（替代旧 post_type）`, 400)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new CrudError("date 必须是 YYYY-MM-DD", 400)
    }
    if (!isSlot(slot)) {
      throw new CrudError(`slot 必须是 morning/noon/evening/late/night`, 400)
    }
    const templateId = body.template_id ? String(body.template_id) : dim
    const note = body.note ? String(body.note) : null
    // D55: 查 dim 对应的 top1 category（按 slot 主时段匹配）
    let categoryId: string | null = null
    const cat = await loadTopCategoryForDim(ctx.env, dim, slot as SlotId)
    if (cat) categoryId = cat.id
    const now = Date.now()
    const oldTypeFromDim: Record<string, string> = { A: '干货', B: '客户', C: '软广', D: '干货', E: '生活', F: '干货', G: '互动' }
    const postType = oldTypeFromDim[dim] || '干货'

    const id = newId()
    try {
      // D55+ 完整 schema（加 dim + category_id）
      await ctx.env.DB.prepare(
        `INSERT INTO schedule (id, user_id, date, slot, dim, category_id, post_type, template_id, status, note, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?)`
      ).bind(id, user.id, date, slot, dim, categoryId, postType, templateId, note, now).run()
    } catch (err: any) {
      if (String(err?.message || "").includes("UNIQUE")) {
        // 已存在 → 改成更新
        try {
          await ctx.env.DB.prepare(
            `UPDATE schedule SET dim = ?, category_id = ?, post_type = ?, template_id = ?, note = ?, updated_at = ?
             WHERE user_id = ? AND date = ? AND slot = ?`
          ).bind(dim, categoryId, postType, templateId, note, now, user.id, date, slot).run()
        } catch {
          // 兼容旧 schema
          await ctx.env.DB.prepare(
            `UPDATE schedule SET post_type = ?, template_id = ?, note = ?, updated_at = ?
             WHERE user_id = ? AND date = ? AND slot = ?`
          ).bind(postType, templateId, note, now, user.id, date, slot).run()
        }
        return json({ ok: true, updated: true, date, slot, dim })
      }
      throw err
    }
    return json({ ok: true, id, date, slot, dim, category_id: categoryId, template_id: templateId }, 201)
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
    if (!slot) throw new CrudError("缺少 slot 参数（?slot=morning|noon|evening|late|night）", 400)
    if (!isSlot(slot)) throw new CrudError(`slot 必须是 morning/noon/evening/late/night`, 400)

    const body = await readJson<Record<string, unknown>>(ctx.request)
    const updates: string[] = []
    const values: unknown[] = []

    if (body.dim !== undefined) {
      if (!isDim(String(body.dim))) {
        throw new CrudError(`dim 必须是：A/B/C/D/E/F/G`, 400)
      }
      updates.push("dim = ?")
      values.push(String(body.dim))
      // 同时更新 post_type 旧字段（兼容）
      const oldTypeFromDim: Record<string, string> = { A: '干货', B: '客户', C: '软广', D: '干货', E: '生活', F: '干货', G: '互动' }
      updates.push("post_type = ?")
      values.push(oldTypeFromDim[String(body.dim)] || '干货')
      // 重新查 category
      const cat = await loadTopCategoryForDim(ctx.env, String(body.dim) as Dim, slot as SlotId)
      if (cat) {
        updates.push("category_id = ?")
        values.push(cat.id)
      }
    }
    if (body.post_type !== undefined) {
      // 兼容旧字段
      const dim = OLD_TYPE_TO_DIM[String(body.post_type)] || 'F'
      updates.push("post_type = ?")
      values.push(String(body.post_type))
      updates.push("dim = ?")
      values.push(dim)
    }
    if (body.category_id !== undefined) {
      updates.push("category_id = ?")
      values.push(body.category_id ? String(body.category_id) : null)
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
      if (!isSlot(slot)) throw new CrudError(`slot 必须是 morning/noon/evening/late/night`, 400)
      result = await ctx.env.DB.prepare(
        "DELETE FROM schedule WHERE user_id = ? AND date = ? AND slot = ?"
      ).bind(user.id, date, slot).run()
    } else {
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
