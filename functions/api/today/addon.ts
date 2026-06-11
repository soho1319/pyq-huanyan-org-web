// ============================================
// POST /api/today/addon
// 今日加量 / 标记已发 / 标记跳过 / 接受候选加量 / 记录 AI 草稿已用
// 接受 form-urlencoded 或 JSON
// body: { action: 'note'|'posted'|'skipped'|'accept_candidate', note?: string, draft_id?: string, chosen_index?: 1|2|3, slot?: 'morning'|'noon'|'evening'|'night', candidate_type?: string }
//   - action=note     → 更新 note（不改变 status）
//   - action=posted   → status=posted（如带 draft_id + chosen_index → 同步标记 ai_drafts 已用）
//   - action=skipped  → status=skipped
//   - action=accept_candidate → 在该 slot 额外插一条排期（status=pending, sort_order=1, note='加量: type'）
// slot 默认 'morning'，D29 之前数据兜底为 morning
// ============================================

import { getUser, json, jsonError, readJson, CrudError, newId } from "../crud-helper"
import { isSlot, isPostType, TYPE_TO_TEMPLATE } from "../../lib/schedule-constants"

interface User { id: string }

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx) as User
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)

    // 解析 body（form 或 JSON）
    const ct = (ctx.request.headers.get("Content-Type") || "").toLowerCase()
    let body: { action?: string; note?: string; draft_id?: string; chosen_index?: number; slot?: string; candidate_type?: string } = {}
    if (ct.includes("application/json")) {
      body = await readJson(ctx.request)
    } else {
      const form = await ctx.request.formData()
      body = {
        action: String(form.get("action") || "note"),
        note: form.get("note") ? String(form.get("note")) : undefined,
        draft_id: form.get("draft_id") ? String(form.get("draft_id")) : undefined,
        chosen_index: form.get("chosen_index") ? parseInt(String(form.get("chosen_index"))) : undefined,
        slot: form.get("slot") ? String(form.get("slot")) : undefined,
        candidate_type: form.get("candidate_type") ? String(form.get("candidate_type")) : undefined,
      }
    }

    const action = body.action || "note"
    const slot = body.slot || "morning"
    if (!isSlot(slot)) {
      throw new CrudError(`slot 必须是 morning/noon/evening/night，当前：${slot}`, 400)
    }
    const today = ymd(new Date())
    const now = Date.now()

    // 查今天这 slot 是否已有排期
    const existing = await ctx.env.DB.prepare(
      "SELECT id, post_type, template_id FROM schedule WHERE user_id = ? AND date = ? AND slot = ?"
    ).bind(user.id, today, slot).first<{ id: string; post_type: string; template_id: string | null }>()

    if (action === "posted" || action === "skipped") {
      // 标记状态
      if (existing) {
        await ctx.env.DB.prepare(
          "UPDATE schedule SET status = ?, note = ?, updated_at = ? WHERE user_id = ? AND date = ? AND slot = ?"
        ).bind(action, body.note || null, now, user.id, today, slot).run()
      } else {
        // 没排期也要能标记（创建一条占位）
        await ctx.env.DB.prepare(
          `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
           VALUES (?, ?, ?, ?, '休息', 'lifestyle', ?, ?, 0, ?)`
        ).bind(newId(), user.id, today, slot, action, body.note || null, now).run()
      }

      // ★ 同步：标记 ai_drafts 已用
      if (action === "posted" && body.draft_id && body.chosen_index) {
        const idx = body.chosen_index
        // 先查 chosen_text（D1 不支持列名占位符 → switch）
        let chosenText: string | null = null
        if (idx === 1) {
          const row = await ctx.env.DB.prepare(
            "SELECT draft_1 AS txt FROM ai_drafts WHERE id = ? AND user_id = ?"
          ).bind(body.draft_id, user.id).first<{ txt: string | null }>()
          chosenText = row?.txt || null
        } else if (idx === 2) {
          const row = await ctx.env.DB.prepare(
            "SELECT draft_2 AS txt FROM ai_drafts WHERE id = ? AND user_id = ?"
          ).bind(body.draft_id, user.id).first<{ txt: string | null }>()
          chosenText = row?.txt || null
        } else if (idx === 3) {
          const row = await ctx.env.DB.prepare(
            "SELECT draft_3 AS txt FROM ai_drafts WHERE id = ? AND user_id = ?"
          ).bind(body.draft_id, user.id).first<{ txt: string | null }>()
          chosenText = row?.txt || null
        }
        if (chosenText !== null) {
          // slot = COALESCE(slot, ?) → 旧 ai_drafts 没有 slot 时用当前 slot 兜底
          await ctx.env.DB.prepare(
            "UPDATE ai_drafts SET chosen_index = ?, chosen_text = ?, used_at = ?, slot = COALESCE(slot, ?) WHERE id = ? AND user_id = ?"
          ).bind(idx, chosenText, now, slot, body.draft_id, user.id).run()
        } else {
          await ctx.env.DB.prepare(
            "UPDATE ai_drafts SET chosen_index = ?, used_at = ?, slot = COALESCE(slot, ?) WHERE id = ? AND user_id = ?"
          ).bind(idx, now, slot, body.draft_id, user.id).run()
        }
      }
    } else if (action === "note") {
      // 仅更新 note
      if (existing) {
        await ctx.env.DB.prepare(
          "UPDATE schedule SET note = ?, updated_at = ? WHERE user_id = ? AND date = ? AND slot = ?"
        ).bind(body.note || null, now, user.id, today, slot).run()
      } else {
        // 没排期 → 创建一条带 note 的"加量"记录
        await ctx.env.DB.prepare(
          `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
           VALUES (?, ?, ?, ?, '休息', 'lifestyle', 'pending', ?, 0, ?)`
        ).bind(newId(), user.id, today, slot, body.note || null, now).run()
      }
    } else if (action === "accept_candidate") {
      // D46: 接受候选加量 → 在该 slot 额外插一条 schedule（sort_order=1 区分固定）
      const candType = body.candidate_type || ""
      if (!isPostType(candType)) {
        throw new CrudError(`candidate_type 必须是 7 种 post_type 之一，当前：${candType}`, 400)
      }
      const tplId = TYPE_TO_TEMPLATE[candType as keyof typeof TYPE_TO_TEMPLATE] || 'lifestyle'
      await ctx.env.DB.prepare(
        `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 1, ?)`
      ).bind(newId(), user.id, today, slot, candType, tplId, `加量: ${candType}`, now).run()
    } else {
      throw new CrudError(`action 必须是 note/posted/skipped/accept_candidate，当前：${action}`, 400)
    }

    // 表单提交 → 重定向回 /today
    if (!ct.includes("application/json")) {
      const url = new URL(ctx.request.url)
      const fwdHost = ctx.request.headers.get("X-Forwarded-Host") || url.host
      const fwdProto = ctx.request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
      return Response.redirect(`${fwdProto}://${fwdHost}/today`, 302)
    }
    return json({ ok: true, date: today, slot, action })
  } catch (err) {
    return jsonError(err)
  }
}
