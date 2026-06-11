// ============================================
// /api/materials/cases
// 客户案例 CRUD
//
// GET    /api/materials/cases             列出当前用户所有案例
// GET    /api/materials/cases?id=xxx      获取单个
// POST   /api/materials/cases             创建 { name, persona, pain, action, result, testimonial }
// PUT    /api/materials/cases?id=xxx      更新
// DELETE /api/materials/cases?id=xxx      删除
// ============================================

import { getUser, json, jsonError, newId, readJson, CrudError, requireFields } from "../crud-helper"

interface CaseRow {
  id: string
  user_id: string
  name: string | null
  persona: string | null
  pain: string | null
  action: string | null
  result: string | null
  testimonial: string | null
  sort_order: number
  created_at: number
  updated_at: number | null
}

const ALLOWED_FIELDS = ["name", "persona", "pain", "action", "result", "testimonial", "sort_order"] as const

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const url = new URL(ctx.request.url)
    const id = url.searchParams.get("id")

    if (id) {
      const row = await ctx.env.DB.prepare(
        "SELECT * FROM cases WHERE id = ? AND user_id = ?"
      ).bind(id, user.id).first<CaseRow>()
      if (!row) throw new CrudError("案例不存在", 404)
      return json({ case: row })
    }

    const rows = await ctx.env.DB.prepare(
      "SELECT * FROM cases WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC"
    ).bind(user.id).all<CaseRow>()
    return json({ cases: rows.results || [] })
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
    const body = await readJson<Record<string, unknown>>(ctx.request)

    const id = newId()
    const now = Date.now()
    const sortOrder = typeof body.sort_order === "number" ? body.sort_order : now

    await ctx.env.DB.prepare(
      `INSERT INTO cases (id, user_id, name, persona, pain, action, result, testimonial, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      user.id,
      body.name || null,
      body.persona || null,
      body.pain || null,
      body.action || null,
      body.result || null,
      body.testimonial || null,
      sortOrder,
      now
    ).run()

    return json({ ok: true, id }, 201)
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
    const id = url.searchParams.get("id")
    if (!id) throw new CrudError("缺少 id 参数（?id=...）", 400)

    const body = await readJson<Record<string, unknown>>(ctx.request)
    const updates: string[] = []
    const values: unknown[] = []

    for (const f of ALLOWED_FIELDS) {
      if (f in body) {
        updates.push(`${f} = ?`)
        values.push(body[f] ?? null)
      }
    }
    if (updates.length === 0) throw new CrudError("没有要更新的字段", 400)

    updates.push("updated_at = ?")
    values.push(Date.now())
    values.push(id, user.id)

    const result = await ctx.env.DB.prepare(
      `UPDATE cases SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run()

    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError("案例不存在或未变更", 404)
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
    const id = url.searchParams.get("id")
    if (!id) throw new CrudError("缺少 id 参数（?id=...）", 400)

    const result = await ctx.env.DB.prepare(
      "DELETE FROM cases WHERE id = ? AND user_id = ?"
    ).bind(id, user.id).run()

    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError("案例不存在", 404)
    }
    return json({ ok: true })
  } catch (err) {
    return jsonError(err)
  }
}
