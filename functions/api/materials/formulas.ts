// ============================================
// /api/materials/formulas
// 公式填空模板 CRUD
//
// GET    /api/materials/formulas                   列出当前用户所有公式模板（按 formula_id 分组）
// GET    /api/materials/formulas?formula_id=xxx    按公式 ID 列出该公式的变体
// POST   /api/materials/formulas                   创建 { formula_id, variant_index, filled_text }
// PUT    /api/materials/formulas?id=xxx            更新
// DELETE /api/materials/formulas?id=xxx            删除
//
// formula_id 候选（公共公式库的 ID）：
//   contrarian  反认知 + 痛点 + 行动
//   pain        痛点具象化
//   boundary    立边界 5 句式
//   story       故事万能模板
//   testimonial 客户证言
//   softad      软广改写
//   hook        金句钩子
//   ask         互动提问
//   review      复盘
//   pro         专业干货
//   lifestyle   生活场景
// ============================================

import { getUser, json, jsonError, newId, readJson, CrudError } from "../crud-helper"

interface FormulaRow {
  id: string
  user_id: string
  formula_id: string
  variant_index: number
  filled_text: string
  updated_at: number
}

const ALLOWED_FIELDS = ["formula_id", "variant_index", "filled_text"] as const

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
    const formulaId = url.searchParams.get("formula_id")

    if (id) {
      const row = await ctx.env.DB.prepare(
        "SELECT * FROM formula_templates WHERE id = ? AND user_id = ?"
      ).bind(id, user.id).first<FormulaRow>()
      if (!row) throw new CrudError("模板不存在", 404)
      return json({ template: row })
    }

    let query = "SELECT * FROM formula_templates WHERE user_id = ?"
    const params: unknown[] = [user.id]
    if (formulaId) {
      query += " AND formula_id = ?"
      params.push(formulaId)
    }
    query += " ORDER BY formula_id ASC, variant_index ASC"

    const rows = await ctx.env.DB.prepare(query).bind(...params).all<FormulaRow>()

    // 按 formula_id 分组
    const grouped: Record<string, FormulaRow[]> = {}
    for (const r of rows.results || []) {
      if (!grouped[r.formula_id]) grouped[r.formula_id] = []
      grouped[r.formula_id].push(r)
    }
    return json({ templates: rows.results || [], grouped })
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

    const formulaId = String(body.formula_id || "").trim()
    const variantIndex = Number(body.variant_index)
    const filledText = String(body.filled_text || "")

    if (!formulaId) throw new CrudError("formula_id 必填", 400)
    if (!Number.isInteger(variantIndex) || variantIndex < 1) {
      throw new CrudError("variant_index 必须是 >= 1 的整数", 400)
    }
    if (!filledText) throw new CrudError("filled_text 必填", 400)

    const id = newId()
    const now = Date.now()
    try {
      await ctx.env.DB.prepare(
        "INSERT INTO formula_templates (id, user_id, formula_id, variant_index, filled_text, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(id, user.id, formulaId, variantIndex, filledText, now).run()
    } catch (err: any) {
      if (String(err?.message || "").includes("UNIQUE")) {
        throw new CrudError(`该公式的第 ${variantIndex} 个变体已存在，改用 PUT 更新`, 409)
      }
      throw err
    }
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
      `UPDATE formula_templates SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run()
    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError("模板不存在或未变更", 404)
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
      "DELETE FROM formula_templates WHERE id = ? AND user_id = ?"
    ).bind(id, user.id).run()
    if (!result.success || result.meta?.changes === 0) {
      throw new CrudError("模板不存在", 404)
    }
    return json({ ok: true })
  } catch (err) {
    return jsonError(err)
  }
}
