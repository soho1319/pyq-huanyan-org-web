// ============================================
// D55-7: /api/admin/invites  邀请码管理（仅 admin）
//
// GET    ?action=list             列出所有码
// POST   { action: "create", max_uses, expires_at?, note? }  生成新码
// DELETE ?id=xxx                  软删（is_active=0）
// ============================================

import { getUser, json, jsonError, newId, requireFields, CrudError } from "../crud-helper"

interface InviteRow {
  id: string
  code: string
  created_by: string
  max_uses: number
  used_count: number
  expires_at: number | null
  note: string | null
  is_active: number
  created_at: number
  creator_username?: string
}

function requireAdmin(ctx: { data: Record<string, unknown> }): void {
  const u = getUser(ctx)
  if (u.is_admin !== 1) {
    throw new CrudError("需要 admin 权限", 403)
  }
}

// 8 位 base36 随机码（无歧义字符：去掉 0/O/1/I/L）
function genCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // 30 字符，无 0/1/I/L/O
  const buf = new Uint8Array(8)
  crypto.getRandomValues(buf)
  let s = ""
  for (const b of buf) s += alphabet[b % alphabet.length]
  return s
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    requireAdmin(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)

    const url = new URL(ctx.request.url)
    const action = url.searchParams.get("action") || "list"

    if (action === "list") {
      const rows = await ctx.env.DB.prepare(
        `SELECT i.id, i.code, i.created_by, i.max_uses, i.used_count, i.expires_at,
                i.note, i.is_active, i.created_at, u.username AS creator_username
         FROM invite_codes i
         LEFT JOIN users u ON u.id = i.created_by
         ORDER BY i.created_at DESC
         LIMIT 200`
      ).all<InviteRow>()
      return json({ ok: true, codes: rows.results || [] })
    }

    throw new CrudError(`未知 action: ${action}`, 400)
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
    requireAdmin(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)

    const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>
    if (body.action !== "create") {
      throw new CrudError(`未知 action: ${body.action}`, 400)
    }
    requireFields(body, ["max_uses"])
    const max_uses = Number(body.max_uses)
    if (!Number.isInteger(max_uses) || max_uses < 1 || max_uses > 1000) {
      throw new CrudError("max_uses 必须是 1-1000 的整数", 400)
    }
    const expires_at = body.expires_at ? Number(body.expires_at) : null
    if (expires_at !== null && (!Number.isFinite(expires_at) || expires_at < Date.now())) {
      throw new CrudError("expires_at 必须是未来时间戳（ms）", 400)
    }
    const note = body.note ? String(body.note).slice(0, 200) : null

    const user = getUser(ctx)
    const id = newId()
    // 重试 3 次避免万一冲突（base36 8 位碰撞概率 < 1/30^8）
    let code = ""
    let attempts = 0
    while (attempts < 3) {
      code = genCode()
      const exist = await ctx.env.DB.prepare(
        "SELECT id FROM invite_codes WHERE code = ?"
      ).bind(code).first<{ id: string } | null>()
      if (!exist) break
      attempts++
    }
    if (attempts >= 3) throw new CrudError("生成码失败，请重试", 500)

    await ctx.env.DB.prepare(
      "INSERT INTO invite_codes (id, code, created_by, max_uses, used_count, expires_at, note, is_active, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?)"
    ).bind(id, code, user.id, max_uses, expires_at, note, Date.now()).run()

    return json({ ok: true, id, code })
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
    requireAdmin(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)

    const url = new URL(ctx.request.url)
    const id = url.searchParams.get("id")
    if (!id) throw new CrudError("缺少 id", 400)

    await ctx.env.DB.prepare(
      "UPDATE invite_codes SET is_active = 0 WHERE id = ?"
    ).bind(id).run()

    return json({ ok: true })
  } catch (err) {
    return jsonError(err)
  }
}
