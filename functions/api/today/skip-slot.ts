// ============================================
// POST /api/today/skip-slot
// D53: 某天某段标记为"今日不发"（per-date slot_config_json 覆盖）
//
// 输入：{ date: "YYYY-MM-DD", slot: "morning"|"noon"|"evening"|"night" }
// 行为：读 user_settings.slot_config_json → 删除该日期数组里的 slot
//       同时把 schedule 表里那天的对应 slot 标记为 'skipped'（不删，保留历史）
//       重新计算 enabled slots（通过 D29 resolveEnabledSlots）
// 输出：{ ok: true, date, slot, enabled_slots }
// ============================================

import { getUser, json, jsonError, readJson, CrudError } from "../crud-helper"
import { SLOT_IDS, isSlot, resolveEnabledSlots, SlotId } from "../../lib/schedule-constants"

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx)
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)
    const body = await readJson<{ date?: string; slot?: string; restore?: boolean }>(ctx.request)
    const date = String(body.date || "").trim()
    const slot = String(body.slot || "").trim()
    const restore = body.restore === true

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new CrudError("date 必须是 YYYY-MM-DD", 400)
    }
    if (!isSlot(slot)) {
      throw new CrudError(`slot 必须是 ${SLOT_IDS.join('/')}`, 400)
    }

    // 1. 读现有 slot_config_json
    const row = await ctx.env.DB.prepare(
      "SELECT default_slots_per_day, slot_config_json FROM user_settings WHERE user_id = ?"
    ).bind(user.id).first<{ default_slots_per_day: number; null; slot_config_json: string | null }>()
    let config: Record<string, unknown> = {}
    if (row?.slot_config_json) {
      try { config = JSON.parse(row.slot_config_json) } catch {}
    }

    // 2. 修改这天 per-date 数组
    let dayList: SlotId[] = Array.isArray(config[date]) ? [...(config[date] as SlotId[])] : []
    if (restore) {
      // 取消今日不发：把这 slot 加回数组（按 SLOT_IDS 顺序）
      if (!dayList.includes(slot as SlotId)) {
        dayList.push(slot as SlotId)
        dayList.sort((a, b) => SLOT_IDS.indexOf(a) - SLOT_IDS.indexOf(b))
      }
    } else {
      // 标记今日不发：从数组删除
      dayList = dayList.filter(s => s !== slot)
      // 兜底：如果删完空数组，从 _default 拿（避免 resolveEnabledSlots 走兜底 slice(0,N)）
      if (dayList.length === 0) {
        const def = Array.isArray(config._default) ? (config._default as SlotId[]) : []
        // _default 也至少要留 1 个（不能所有段都不发）
        dayList = def.filter(s => s !== slot)
        if (dayList.length === 0) dayList = SLOT_IDS.filter(s => s !== slot).slice(0, 1) as SlotId[]
      }
    }
    config[date] = dayList

    // 3. 写回 slot_config_json
    const newJson = JSON.stringify(config)
    if (row) {
      await ctx.env.DB.prepare(
        "UPDATE user_settings SET slot_config_json = ?, updated_at = ? WHERE user_id = ?"
      ).bind(newJson, Date.now(), user.id).run()
    } else {
      await ctx.env.DB.prepare(
        "INSERT INTO user_settings (user_id, slot_config_json, updated_at) VALUES (?, ?, ?)"
      ).bind(user.id, newJson, Date.now()).run()
    }

    // 4. 同步更新 schedule 表（status='skipped'，保留历史；如 restore 改回 'pending'）
    if (restore) {
      // 恢复：仅当 row 存在且是 'skipped' 时改回 'pending'
      await ctx.env.DB.prepare(
        "UPDATE schedule SET status = 'pending', updated_at = ? WHERE user_id = ? AND date = ? AND slot = ? AND status = 'skipped'"
      ).bind(Date.now(), user.id, date, slot).run()
    } else {
      // 标记今日不发：把 status 改 'skipped'（不影响已发的 posted）
      await ctx.env.DB.prepare(
        "UPDATE schedule SET status = 'skipped', updated_at = ? WHERE user_id = ? AND date = ? AND slot = ? AND status != 'posted'"
      ).bind(Date.now(), user.id, date, slot).run()
    }

    // 5. 算当前这天的 enabled slots
    const enabledSlots = resolveEnabledSlots(
      { default_slots_per_day: row?.default_slots_per_day || 4, slot_config_json: newJson },
      date
    )

    return json({ ok: true, date, slot, restore, enabled_slots, day_list: dayList })
  } catch (err) {
    return jsonError(err)
  }
}
