// ============================================
// POST /api/theme-slot-override
// D32: per-day 4 段覆盖
// body: { date: 'YYYY-MM-DD', slot_morning?: '1', slot_noon?: '1', slot_evening?: '1', slot_night?: '1' }
// 写入 user_settings.slot_config_json[date] = ['morning','noon',...]
// ============================================

import { getUser, json, jsonError, readJson, CrudError } from "./crud-helper"
import { SLOT_IDS, SlotId } from "../lib/schedule-constants"

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const form = await ctx.request.formData()
    const date = String(form.get("date") || "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new CrudError("date 必须是 YYYY-MM-DD", 400)
    }

    // 读勾选的 4 段
    const checked: SlotId[] = []
    for (const sid of SLOT_IDS) {
      if (form.get(`slot_${sid}`)) checked.push(sid)
    }
    if (checked.length === 0) {
      // 全不勾 → 用空数组 []（表示"今天不发"）—— 但业务上更友好是给个错误
      throw new CrudError("至少勾 1 个时段", 400)
    }

    // 读 user_settings.slot_config_json（同时取 type_colors，INSERT 必须满足 NOT NULL）
    const row = await ctx.env.DB.prepare(
      "SELECT slot_config_json, type_colors FROM user_settings WHERE user_id = ?"
    ).bind(user.id).first<{ slot_config_json: string | null; type_colors: string | null }>()
    let config: Record<string, SlotId[]> = {}
    if (row?.slot_config_json) {
      try { config = JSON.parse(row.slot_config_json) } catch {}
    }
    config[date] = checked
    // SQLite ON CONFLICT DO UPDATE 仍需 INSERT 字段满足 NOT NULL，所以 type_colors 必须有
    const typeColors = row?.type_colors || JSON.stringify({})

    // 写回
    await ctx.env.DB.prepare(
      `INSERT INTO user_settings (user_id, type_colors, slot_config_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         slot_config_json = excluded.slot_config_json,
         updated_at = excluded.updated_at`
    ).bind(user.id, typeColors, JSON.stringify(config), Date.now()).run()

    // 表单提交 → 重定向回 /calendar
    const url = new URL(ctx.request.url)
    const fwdHost = ctx.request.headers.get("X-Forwarded-Host") || url.host
    const fwdProto = ctx.request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
    return Response.redirect(`${fwdProto}://${fwdHost}/calendar?month=${date.slice(0, 7)}&add=${date}&saved=override`, 302)
  } catch (err) {
    return jsonError(err)
  }
}
