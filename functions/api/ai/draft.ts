// ============================================
// POST /api/ai/draft
// AI 帮写：公共公式 + 我的素材 → 3 条候选朋友圈文案
//
// 输入：{ todayType: '干货'|'生活'|... , addon?: '今天想加的内容' }
// 输出：{ drafts: [str, str, str], model: string, used_input_tokens?: number }
//
// 实现：
// 1. 查当前用户的 intros / cases / quotes / formula_templates（D1）
// 2. 拼 prompt（含公共公式简版 + 素材 + 今日类型 + 加量）
// 3. 调 MiniMax API（OpenAI 兼容协议）
// 4. 解析 3 条候选文案（用 --- 分隔）
// ============================================

import { getUser, json, jsonError, readJson, CrudError } from "../crud-helper"
import { isSlot } from "../../lib/schedule-constants"

interface User { id: string; username: string }

interface Env {
  DB?: D1Database
  MINIMAX_API_KEY?: string
  MINIMAX_BASE_URL?: string
  MINIMAX_MODEL?: string
}

// ============================================
// 工具：素材超长截断（防 prompt 爆上下文）
// ============================================
function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "(未填)"
  const t = String(s).trim()
  return t.length > max ? t.slice(0, max) + "…" : t
}

// ============================================
// 公共公式（精简版，AI 参考用）
// 完整版见 `pyq-huanyan-org-web/content/内容营销朋友圈助手/02 -朋友圈公式库.md`
// ============================================
const PUBLIC_FORMULAS = `## 公共公式速查（7 个，简版）
1. 反认知+痛点+行动：「你以为X，实际Y」→ 3痛点场景 → 做Z
2. 痛点具象化：「你有没有场景1？场景2？场景3？」
3. 立边界：不打折/不陪聊/不解释/不接急单/不接无理要求
4. 故事万能：背景+冲突+转折+结果+反思
5. 客户证言：谁+痛点+做了什么+结果+原话
6. 金句钩子：「大部分人以为X，其实X」
7. 互动提问：场景+灵魂提问+引导回应`

// ============================================
// 拼 prompt
// ============================================
async function buildPrompt(
  env: Env,
  userId: string,
  todayType: string,
  addon: string | undefined
): Promise<string> {
  if (!env.DB) throw new CrudError("D1 未配置", 500)

  // 查用户素材
  const intros = await env.DB.prepare(
    "SELECT slot, content FROM intros WHERE user_id = ?"
  ).bind(userId).all<{ slot: string; content: string }>()
  const cases = await env.DB.prepare(
    "SELECT name, persona, pain, action, result, testimonial FROM cases WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 3"
  ).bind(userId).all<{ name: string | null; persona: string | null; pain: string | null; action: string | null; result: string | null; testimonial: string | null }>()
  const quotes = await env.DB.prepare(
    "SELECT text, category FROM quotes WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(userId).all<{ text: string; category: string | null }>()
  const formulas = await env.DB.prepare(
    "SELECT formula_id, variant_index, filled_text FROM formula_templates WHERE user_id = ? ORDER BY formula_id ASC, variant_index ASC"
  ).bind(userId).all<{ formula_id: string; variant_index: number; filled_text: string }>()

  // D40: 本周主题 + 本月阶段 + 7 维度提示
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const { getWeeklyTheme, getMonthlyPhase, DIMENSION_TYPE_MAP, reverseDimensionMap } = await import("../../lib/schedule-constants")
  const startOfWeek = (() => { const d = new Date(today); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d })()
  const weekStartStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`
  const weekTheme = getWeeklyTheme(weekStartStr, null)
  const monthPhase = getMonthlyPhase(todayStr.slice(0, 7), null)

  // 7 维度本周已发统计（找最低的 2 个维度）
  const weekRows = await env.DB.prepare(
    "SELECT post_type FROM schedule WHERE user_id = ? AND date >= ? AND date <= ?"
  ).bind(userId, weekStartStr, todayStr).all<{ post_type: string }>()
  const dimCounts: Record<string, number> = {}
  for (const dim of Object.keys(DIMENSION_TYPE_MAP)) dimCounts[dim] = 0
  for (const r of weekRows.results || []) {
    for (const dim of reverseDimensionMap(r.post_type)) {
      dimCounts[dim] = (dimCounts[dim] || 0) + 1
    }
  }
  const sortedDims = Object.entries(dimCounts).sort((a, b) => a[1] - b[1])
  const lowDims = sortedDims.slice(0, 2).map(([d, n]) => `${d}(${n})`).join('、')
  const weekTypeFocus = Object.entries(weekTheme.weights).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join('+')
  const dimSummary = Object.entries(dimCounts).filter(([_, n]) => n > 0).map(([k, v]) => `${k}${v}`).join('/') || '暂无'

  // 渲染素材区（带 truncate 防超长）
  const introsMap: Record<string, string> = {}
  for (const r of intros.results || []) introsMap[r.slot] = r.content

  const introsBlock = `
### 我的自我介绍
- 3句版：${truncate(introsMap.short3, 80)}
- 50字版：${truncate(introsMap["50"], 60)}
- 1分钟口播：${truncate(introsMap["1min"], 200)}
- 200字介绍：${truncate(introsMap["200"], 250)}
- 加微专版：${truncate(introsMap.addwechat, 80)}`

  const casesBlock = (cases.results && cases.results.length > 0)
    ? `\n### 我的客户案例（前 3 个）\n` + cases.results.map((c, i) =>
        `${i + 1}. ${truncate(c.name, 20)}（${truncate(c.persona, 30)}）\n   痛点：${truncate(c.pain, 60)}\n   做了：${truncate(c.action, 60)}\n   结果：${truncate(c.result, 60)}\n   原话：${truncate(c.testimonial, 80)}`).join("\n")
    : "\n### 我的客户案例\n（暂无）"

  const quotesBlock = (quotes.results && quotes.results.length > 0)
    ? `\n### 我的金句库（前 10 条）\n` + quotes.results.slice(0, 10).map(q =>
        `- ${truncate(q.text, 60)}${q.category ? ` [${q.category}]` : ''}`).join("\n")
    : "\n### 我的金句库\n（暂无）"

  const formulasBlock = (formulas.results && formulas.results.length > 0)
    ? `\n### 我写过的公式填空（前 5 条）\n` + formulas.results.slice(0, 5).map(f =>
        `- [${f.formula_id} v${f.variant_index}] ${truncate(f.filled_text, 100)}`).join("\n")
    : "\n### 我写过的公式填空\n（暂无）"

  const addonBlock = addon ? `\n### 当日加量\n${truncate(addon, 200)}` : ""

  // D40: 本周主题 + 月阶段 + 7 维度提示 合并到任务段
  const prompt = `你是婉音老师课程体系下的"朋友圈文案教练"。根据以下素材，为用户写 3 条今日朋友圈候选文案。

${PUBLIC_FORMULAS}

====================================
用户素材
====================================
${introsBlock}${casesBlock}${quotesBlock}${formulasBlock}${addonBlock}

====================================
今日任务（含 D40: 本周主题 + 月阶段 + 7 维度）
====================================
- 今日类型：**${todayType}**
- 本周主题：${weekTheme.label}（${weekTheme.cycleIndex + 1}/4 周）—— 重点发 ${weekTypeFocus}
- 月阶段：${monthPhase.label}（${monthPhase.cycleIndex}/3 月）
- 7维度本周已发：${dimSummary} → 建议多发：${lowDims}
- 写 3 条候选（80-200字，\`---END---\` 分隔），第一人称、口语化、有"我"有"你"、不强推销
- 优先用"客户案例"和"金句库"具体内容；缺素材可临场编，但语气要像用户本人
- 如有加量（addon），按加量优先；类型与本周主题贴合时优先采用
- 不要编号、不要"以下是"、"选项1"、"第一条"等提示语

====================================
输出
====================================
直接输出 3 条文案，每条以 \`---END---\` 结尾。`

  return prompt
}

// ============================================
// 调 MiniMax API（OpenAI 兼容）
// ============================================
async function callMiniMax(
  prompt: string,
  env: Env
): Promise<string> {
  const apiKey = env.MINIMAX_API_KEY
  if (!apiKey) {
    throw new CrudError("服务端未配置 MINIMAX_API_KEY", 500)
  }
  const baseUrl = (env.MINIMAX_BASE_URL || "https://api.minimax.chat/v1").replace(/\/$/, "")
  const model = env.MINIMAX_MODEL || "MiniMax-M3"

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "你是婉音老师课程体系下的内容营销专家，擅长写朋友圈文案。严格遵守：直接输出 3 条候选文案，不要解释、不要思考过程、不要编号标题，每条用 ---END--- 单独分隔，每条 80-180 字。",
        },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText)
    throw new CrudError(`MiniMax API ${resp.status}: ${errText.slice(0, 200)}`, 502)
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new CrudError("MiniMax API 返回空", 502)
  return text
}

// ============================================
// 解析输出 → 3 条文案
// 清洗策略：
// 1. 去掉 <think>...</think> 块（模型的思考过程）
// 2. 去掉 "**Candidate N: ...**" 之类的标题
// 3. 按 ---END--- 分隔
// 4. 兜底：返回前 3 段非空内容
// ============================================
function parseDrafts(text: string): string[] {
  // 1. 去 <think> 块
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "")

  // 2. 按 ---END--- 切
  const parts = cleaned.split(/---END---/i).map(s => s.trim()).filter(Boolean)

  // 3. 清洗每条：去掉 "**Candidate N: ...**" 标题
  const cleaned2 = parts.map(s => {
    return s
      // 去掉 "Candidate 1: xxx" 之类
      .replace(/^\*\*Candidate\s*\d+[：:]\s*[^*]*\*\*/i, "")
      // 去掉 "**xxx**" 单独行的标题
      .replace(/^\*\*[^*]+\*\*\s*/i, "")
      .trim()
  }).filter(Boolean)

  if (cleaned2.length >= 3) return cleaned2.slice(0, 3)
  if (cleaned2.length > 0) return cleaned2
  return [text.trim()]
}

// ============================================
// 主入口
// ============================================
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export async function onRequestPost(ctx: {
  request: Request
  env: Env
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = getUser(ctx) as User
    const body = await readJson<{ todayType?: string; addon?: string; slot?: string }>(ctx.request)
    const todayType = String(body.todayType || "干货").trim()
    const addon = body.addon ? String(body.addon).trim() : undefined
    const slot = body.slot ? String(body.slot) : "morning"
    if (!isSlot(slot)) {
      throw new CrudError(`slot 必须是 morning/noon/evening/night，当前：${slot}`, 400)
    }

    const prompt = await buildPrompt(ctx.env, user.id, todayType, addon)
    const text = await callMiniMax(prompt, ctx.env)
    const drafts = parseDrafts(text)

    // 兜底：保证有 3 条（不足的用空字符串占位）
    while (drafts.length < 3) drafts.push("")

    // 写入 ai_drafts 历史表
    let draftId: string | null = null
    if (ctx.env.DB) {
      draftId = crypto.randomUUID()
      await ctx.env.DB.prepare(
        `INSERT INTO ai_drafts (id, user_id, date, slot, today_type, addon, draft_1, draft_2, draft_3, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        draftId, user.id, ymd(new Date()), slot, todayType, addon || null,
        drafts[0], drafts[1], drafts[2],
        ctx.env.MINIMAX_MODEL || "MiniMax-M3",
        Date.now()
      ).run()
    }

    return json({
      ok: true,
      draft_id: draftId,
      drafts,
      model: ctx.env.MINIMAX_MODEL || "MiniMax-M3",
      today_type: todayType,
    })
  } catch (err) {
    return jsonError(err)
  }
}

export async function onRequestGet(): Promise<Response> {
  return json({
    name: "pyq AI 帮写",
    usage: "POST /api/ai/draft { todayType, addon? }",
    returns: "{ drafts: [str, str, str], model }",
  })
}
