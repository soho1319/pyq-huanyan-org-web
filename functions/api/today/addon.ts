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
import { isSlot, isDim, type Dim, type SlotId, loadTopCategoryForDim, ymdInTZ } from "../../lib/schedule-constants"

interface User { id: string }

// D55: 旧 7 type → dim
const OLD_TYPE_TO_DIM_ADDON: Record<string, Dim> = { '干货': 'F', '生活': 'E', '客户': 'B', '互动': 'G', '软广': 'C', '复盘': 'F', '休息': 'E' }

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
    let body: { action?: string; note?: string; draft_id?: string; chosen_index?: number; slot?: string; candidate_type?: string; dims?: string[] } = {}
    if (ct.includes("application/json")) {
      body = await readJson(ctx.request)
    } else {
      const form = await ctx.request.formData()
      // D55-17 E: 多维加量 — dims[] 多次或 dims 逗号分隔
      const dimsRaw = form.getAll("dims").map(String).filter(Boolean)
      body = {
        action: String(form.get("action") || "note"),
        note: form.get("note") ? String(form.get("note")) : undefined,
        draft_id: form.get("draft_id") ? String(form.get("draft_id")) : undefined,
        chosen_index: form.get("chosen_index") ? parseInt(String(form.get("chosen_index"))) : undefined,
        slot: form.get("slot") ? String(form.get("slot")) : undefined,
        candidate_type: form.get("candidate_type") ? String(form.get("candidate_type")) : undefined,
        dims: dimsRaw.length > 0 ? dimsRaw : undefined,
      }
    }

    const action = body.action || "note"
    const slot = body.slot || "morning"
    if (!isSlot(slot)) {
      throw new CrudError(`slot 必须是 morning/noon/evening/night，当前：${slot}`, 400)
    }
    // D55-16: 用 CST 算 today
    const today = ymdInTZ(new Date(), "Asia/Shanghai")
    const now = Date.now()

    // 查今天这 slot 是否已有排期
    const existing = await ctx.env.DB.prepare(
      "SELECT id, post_type, dim, category_id, template_id FROM schedule WHERE user_id = ? AND date = ? AND slot = ?"
    ).bind(user.id, today, slot).first<{ id: string; post_type: string | null; dim: string | null; category_id: string | null; template_id: string | null }>()

    if (action === "posted" || action === "skipped") {
      // 标记状态
      if (existing) {
        await ctx.env.DB.prepare(
          "UPDATE schedule SET status = ?, note = ?, updated_at = ? WHERE user_id = ? AND date = ? AND slot = ?"
        ).bind(action, body.note || null, now, user.id, today, slot).run()
      } else {
        // 没排期也要能标记（创建一条占位，dim 缺省 F）
        try {
          await ctx.env.DB.prepare(
            `INSERT INTO schedule (id, user_id, date, slot, dim, post_type, template_id, status, note, sort_order, updated_at)
             VALUES (?, ?, ?, ?, 'F', '休息', 'lifestyle', ?, ?, 0, ?)`
          ).bind(newId(), user.id, today, slot, action, body.note || null, now).run()
        } catch {
          await ctx.env.DB.prepare(
            `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
             VALUES (?, ?, ?, ?, '休息', 'lifestyle', ?, ?, 0, ?)`
          ).bind(newId(), user.id, today, slot, action, body.note || null, now).run()
        }
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
      // D55: 接受候选加量 → 在该 slot 额外插一条 schedule（sort_order=1 区分固定，dim + category_id 优先）
      const candType = body.candidate_type || ""
      let candDim: Dim = 'F'
      if (isDim(candType)) {
        candDim = candType as Dim
      } else if (candType && OLD_TYPE_TO_DIM_ADDON[candType]) {
        candDim = OLD_TYPE_TO_DIM_ADDON[candType]
      } else {
        candDim = 'F'
      }
      // 查 dim 对应的 top1 category
      const cat = await loadTopCategoryForDim(ctx.env, candDim, slot as SlotId)
      const categoryId = cat?.id || null
      const tplId = candDim
      try {
        await ctx.env.DB.prepare(
          `INSERT INTO schedule (id, user_id, date, slot, dim, category_id, post_type, template_id, status, note, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 1, ?)`
        ).bind(newId(), user.id, today, slot, candDim, categoryId, candDim, tplId, `加量: ${candDim}`, now).run()
      } catch {
        // 兼容旧 schema
        await ctx.env.DB.prepare(
          `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 1, ?)`
        ).bind(newId(), user.id, today, slot, candDim, tplId, `加量: ${candDim}`, now).run()
      }
    } else if (action === "multi_add") {
      // D55-17 E: 多维加量 — 一次提交多个 dim，每个 dim 插一条 sort_order=max+1
      const dimsInput = body.dims || []
      const validDims = dimsInput.filter(d => isDim(d)) as Dim[]
      if (validDims.length === 0) {
        throw new CrudError("multi_add 至少要 1 个有效 dim", 400)
      }
      // 查 max sort_order
      const maxRow = await ctx.env.DB.prepare(
        "SELECT MAX(sort_order) AS max_so FROM schedule WHERE user_id = ? AND date = ? AND slot = ?"
      ).bind(user.id, today, slot).first<{ max_so: number | null }>()
      let nextSo = (maxRow?.max_so ?? 0) + 1
      const noteText = body.note ? `加量: ${body.note}` : `加量`
      for (const d of validDims) {
        const cat = await loadTopCategoryForDim(ctx.env, d, slot as SlotId)
        const categoryId = cat?.id || null
        const tplId = d
        try {
          await ctx.env.DB.prepare(
            `INSERT INTO schedule (id, user_id, date, slot, dim, category_id, post_type, template_id, status, note, sort_order, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
          ).bind(newId(), user.id, today, slot, d, categoryId, d, tplId, noteText, nextSo, now).run()
        } catch {
          // 兼容旧 schema
          await ctx.env.DB.prepare(
            `INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, note, sort_order, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
          ).bind(newId(), user.id, today, slot, d, tplId, noteText, nextSo, now).run()
        }
        nextSo++
      }
    } else {
      throw new CrudError(`action 必须是 note/posted/skipped/accept_candidate/multi_add，当前：${action}`, 400)
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
