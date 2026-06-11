// ============================================
// /api/materials/intros
// 自我介绍（5 个固定 slot）
//
// GET  → 返回当前用户 5 个 slot 的内容
// PUT  → body { short3, "50", "1min", "200", addwechat } 批量更新
//
// slot 取值：
//   short3     3 句话版（~60 字）
//   50         50 字精简版
//   1min       1 分钟口播版（~200 字）
//   200        200 字详细介绍
//   addwechat  加微专版
// ============================================

import { getUser, json, jsonError, readJson, CrudError } from "../crud-helper"

const SLOTS = ["short3", "50", "1min", "200", "addwechat"] as const
type Slot = (typeof SLOTS)[number]

function isSlot(s: string): s is Slot {
  return (SLOTS as readonly string[]).includes(s)
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const rows = await ctx.env.DB.prepare(
      "SELECT slot, content, updated_at FROM intros WHERE user_id = ?"
    ).bind(user.id).all<{ slot: string; content: string; updated_at: number }>()

    const map: Record<string, string> = {}
    for (const s of SLOTS) map[s] = ""
    for (const r of rows.results || []) {
      if (isSlot(r.slot)) map[r.slot] = r.content
    }
    return json({ intros: map })
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
    const body = await readJson<Record<string, string>>(ctx.request)

    const now = Date.now()
    for (const slot of SLOTS) {
      const content = (body[slot] ?? "").toString()
      await ctx.env.DB.prepare(
        `INSERT INTO intros (id, user_id, slot, content, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, slot) DO UPDATE SET
           content = excluded.content,
           updated_at = excluded.updated_at`
      ).bind(crypto.randomUUID(), user.id, slot, content, now).run()
    }
    return json({ ok: true, updated_at: now })
  } catch (err) {
    return jsonError(err)
  }
}
