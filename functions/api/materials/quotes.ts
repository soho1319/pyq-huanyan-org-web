// ============================================
// /api/materials/quotes
// 金句库 CRUD
//
// GET    /api/materials/quotes              列出当前用户所有金句
// GET    /api/materials/quotes?id=xxx       获取单个
// POST   /api/materials/quotes              创建 { text, category?, source? }
// PUT    /api/materials/quotes?id=xxx       更新
// DELETE /api/materials/quotes?id=xxx       删除
// ============================================

import { getUser, json, jsonError, newId, readJson, CrudError } from "../crud-helper"

interface QuoteRow {
  id: string
  user_id: string
  text: string
  category: string | null
  source: string | null
  created_at: number
}

const ALLOWED_FIELDS = ["text", "category", "source"] as const

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
    const category = url.searchParams.get("category")

    if (id) {
      const row = await ctx.env.DB.prepare(
        "SELECT * FROM quotes WHERE id = ? AND user_id = ?"
      ).bind(id, user.id).first<QuoteRow>()
      if (!row) throw new CrudError("金句不存在", 404)
      return json({ quote: row })
    }

    let query = "SELECT * FROM quotes WHERE user_id = ?"
    const params: unknown[] = [user.id]
    if (category) {
      query += " AND category = ?"
      params.push(category)
    }
    query += " ORDER BY created_at DESC"

    const rows = await ctx.env.DB.prepare(query).bind(...params).all<QuoteRow>()
    return json({ quotes: rows.results || [] })
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
    if (!body.text || String(body.text).trim() === "") {
      throw new CrudError("text 不能为空", 400)
    }

    const id = newId()
    const now = Date.now()
    await ctx.env.DB.prepare(
      "INSERT INTO quotes (id, user_id, text, category, source, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      id,
      user.id,
      String(body.text),
      body.category ? String(body.category) : null,
      body.source ? String(body.source) : null,
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

    values.push(id, user.id)
    const result = await ctx.env.DB.prepare(
      `UPDATE quotes SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run()
    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError("金句不存在或未变更", 404)
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
      "DELETE FROM quotes WHERE id = ? AND user_id = ?"
    ).bind(id, user.id).run()
    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError("金句不存在", 404)
    }
    return json({ ok: true })
  } catch (err) {
    return jsonError(err)
  }
}
