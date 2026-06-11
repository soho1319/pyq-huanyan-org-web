// ============================================
// /calendar?month=YYYY-MM
// 月历视图（D29: 1 cell = 4 段：早 8 / 午 12:30 / 晚 20 / 夜 22:30）
// 每天 4 行小色块 + 4 状态点；点 cell → 弹 1 段 form（带 slot）
// ============================================

import { loadUserColors, typeStyle } from "./lib/type-colors"
import { loadUserTheme, themeCssVar } from "./lib/theme"
import { SLOTS, SLOT_IDS, POST_TYPES, TYPE_TO_TEMPLATE, TYPE_TIPS, isSlot, SlotId } from "./lib/schedule-constants"

interface User { id: string; username: string; display_name: string | null }
interface ScheduleRow {
  id: string; date: string; slot: string; post_type: string; template_id: string | null;
  status: string; note: string | null; sort_order: number;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d); x.setMonth(x.getMonth() + n); return x
}
function getOrigin(req: Request): string {
  const url = new URL(req.url)
  const fwdHost = req.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = req.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  return `${fwdProto}://${fwdHost}`
}

function renderCalendar(
  year: number, month: number,
  scheduleMap: Record<string, ScheduleRow[]>,  // D29: 1 date → 多条
  user: User,
  colors: Record<string, { bg: string; fg: string }>,
  theme: { start: string; end: string; solid: string },
  msg?: string,
  addDate?: string,
  addSlot?: SlotId,
  dayEnabledSlots: SlotId[] = ["morning", "noon", "evening", "night"],
  monthStats?: { total: number; posted: number; skipped: number; pending: number; byType: Record<string, number>; bySlot: Record<string, number> },
  monthPhase?: { phase: 1|2|3; label: string; cycleIndex: number; locked: boolean },
  aiComment: string = ""
): Response {
  const firstDay = new Date(year, month - 1, 1)
  const firstWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayStr = ymd(new Date())
  const monthStr = `${year}-${String(month).padStart(2, "0")}`

  const cells: Array<{ date: string; day: number; schedules: ScheduleRow[] } | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${monthStr}-${String(d).padStart(2, "0")}`
    cells.push({ date, day: d, schedules: scheduleMap[date] || [] })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const prev = addMonths(firstDay, -1)
  const next = addMonths(firstDay, 1)
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`

  // add-form：弹哪个 slot 的表单
  const addSchedules = addDate ? (scheduleMap[addDate] || []) : []
  const addSlotMeta = addSlot ? SLOTS.find(s => s.id === addSlot) : null
  const addSchedBySlot: Record<string, ScheduleRow> = {}
  for (const r of addSchedules) addSchedBySlot[r.slot] = r

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>日历 · ${monthStr} · pyq</title>
${themeCssVar(theme)}
<style>${styles}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/today" class="brand">🛠️ 朋友圈工作台</a>
      <div class="user">
        <span class="user-name">${escapeHtml(user.display_name || user.username)}</span>
        <a href="/logout" class="logout-btn">🔓 退出</a>
      </div>
    </div>
  </header>
  <main>
    <nav class="subnav">
      <a href="/today">📅 今日</a>
      <a href="/my/intros">👋 自我介绍</a>
      <a href="/my/cases">👥 客户案例</a>
      <a href="/my/quotes">💎 金句库</a>
      <a href="/my/formulas">✍️ 公式填空</a>
      <a href="/calendar" class="active">🗓 日历</a>
      <a href="/my/types">🎨 颜色</a>
    </nav>

    <div class="cal-head">
      <a href="/calendar?month=${prevMonth}" class="nav-link">‹ ${prevMonth}</a>
      <h1>${monthStr}</h1>
      <a href="/calendar?month=${nextMonth}" class="nav-link">${nextMonth} ›</a>
    </div>

    ${monthStats && monthStats.total > 0 ? `
    <section class="month-stats-card">
      <div class="month-phase-row">
        <span class="phase-badge phase-${monthPhase?.phase || 1}">🎯 ${monthPhase?.label || '破冰'}（第 ${monthPhase?.cycleIndex || 1}/3 月）</span>
        <a href="/my/theme" class="btn-link">查看/锁定 →</a>
      </div>
      <div class="ms-row">
        <div class="ms-stat ms-stat-total"><span class="ms-num">${monthStats.total}</span><span class="ms-label">总排</span></div>
        <div class="ms-stat ms-stat-posted"><span class="ms-num">${monthStats.posted}</span><span class="ms-label">已发</span></div>
        <div class="ms-stat ms-stat-skipped"><span class="ms-num">${monthStats.skipped}</span><span class="ms-label">跳</span></div>
        <div class="ms-stat ms-stat-pending"><span class="ms-num">${monthStats.pending}</span><span class="ms-label">待发</span></div>
      </div>
      <div class="ms-breakdown">
        <div class="ms-slot-bars">
          <span class="muted">4 段分布：</span>
          ${['morning', 'noon', 'evening', 'night'].map(sid => {
            const n = monthStats.bySlot[sid] || 0
            const labelMap: Record<string, string> = { morning: '早 8', noon: '午 12:30', evening: '晚 20', night: '夜 22:30' }
            const maxN = Math.max(1, ...Object.values(monthStats.bySlot))
            const pct = (n / maxN) * 100
            return `<div class="slot-bar"><span class="sb-label">${labelMap[sid]}</span><div class="sb-track"><div class="sb-fill" style="width:${pct}%"></div></div><span class="sb-num">${n}</span></div>`
          }).join('')}
        </div>
        <div class="ms-type-tags">
          <span class="muted">类型：</span>
          ${Object.entries(monthStats.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) =>
            `<span class="type-tag" style="${typeStyle(colors, t)}">${t} ${n}</span>`
          ).join(' ')}
        </div>
      </div>
      ${aiComment ? `<div class="ai-comment">🤖 <strong>AI 点评：</strong>${escapeHtml(aiComment)}</div>` : ''}
    </section>
    ` : ''}

    ${addDate && addSlot ? `
    <div class="add-form-card">
      <h3>➕ 给 ${addDate} · ${addSlotMeta?.label || ''} ${addSlotMeta?.time || ''} 排期</h3>
      <form method="POST" action="/calendar">
        <input type="hidden" name="_action" value="add_or_update_type">
        <input type="hidden" name="date" value="${addDate}">
        <input type="hidden" name="slot" value="${addSlot}">
        <div class="add-form-row">
          <span class="add-date">${addDate} · ${addSlotMeta?.label}</span>
          <select name="post_type" required>
            ${POST_TYPES.map(t => {
              const sel = addSchedBySlot[addSlot]?.post_type === t ? ' selected' : ''
              return `<option value="${t}"${sel}>${t}</option>`
            }).join('')}
          </select>
          <button type="submit" class="btn-primary btn-sm">✓ ${addSchedBySlot[addSlot] ? '更新' : '安排'}</button>
          <a href="/calendar?month=${addDate.slice(0, 7)}" class="btn-link btn-sm">取消</a>
        </div>
        <p class="muted">已有排期会更新类型（不改变状态）；未排则创建新段。修改时段：<a href="/calendar?month=${addDate.slice(0, 7)}&add=${addDate}">选别的时段</a></p>
      </form>
    </div>
    ` : ''}

    ${addDate ? `
    <div class="add-form-card" style="background:#f7fafc">
      <h3>📍 ${addDate} 时段覆盖（D32）</h3>
      <p class="muted">勾要发哪几段（不勾的时段不排期）。改完点 [✓ 保存覆盖]，再点 [+ 排] 给每段安排具体类型。</p>
      <form method="POST" action="/api/theme-slot-override" class="override-form">
        <input type="hidden" name="date" value="${addDate}">
        <div class="slot-picker">
          ${SLOT_IDS.map(sid => {
            const meta = SLOTS.find(s => s.id === sid)!
            const r = addSchedBySlot[sid]
            const isDefault = dayEnabledSlots.includes(sid)
            return `<label class="slot-pick" ${r ? `style="${typeStyle(colors, r.post_type)}"` : ''}>
              <input type="checkbox" name="slot_${sid}" value="1" ${isDefault ? 'checked' : ''}>
              ${meta.label} ${meta.time}${r ? ` · ${r.post_type}` : ''}
            </label>`
          }).join('')}
        </div>
        <div class="override-actions">
          <button type="submit" class="btn-primary btn-sm">✓ 保存覆盖</button>
          <a href="/calendar?month=${addDate.slice(0, 7)}" class="btn-link btn-sm">取消</a>
          <span class="muted">注：当前是 ${dayEnabledSlots.length} 段（来自 /my/types 全局或 per-day 覆盖）</span>
        </div>
      </form>
      <h4 style="margin: 12px 0 6px;font-size:13px">📅 给具体时段安排类型：</h4>
      <div class="slot-picker">
        ${SLOT_IDS.map(sid => {
          const meta = SLOTS.find(s => s.id === sid)!
          const r = addSchedBySlot[sid]
          const enabled = dayEnabledSlots.includes(sid)
          if (!enabled) return `<span class="slot-pick slot-pick-disabled" title="该时段未启用，先勾上上面覆盖">${meta.label}${meta.time} (未启用)</span>`
          return `<a href="/calendar?month=${addDate.slice(0, 7)}&add=${addDate}&slot=${sid}" class="slot-pick" ${r ? `style="${typeStyle(colors, r.post_type)}"` : ''}>
            ${meta.label} ${meta.time}${r ? ` · ${r.post_type}` : ' · 未排'}
          </a>`
        }).join('')}
      </div>
    </div>
    ` : ''}

    <div class="legend">
      ${POST_TYPES.map(t => `<span class="legend-item" style="${typeStyle(colors, t)}">${t}</span>`).join('')}
      <a href="/today" class="btn-link" style="margin-left:auto">→ 今日</a>
    </div>

    ${msg ? `<div class="flash flash-ok">${escapeHtml(msg)}</div>` : ''}

    <div class="cal-grid">
      <div class="cal-weekday">日</div>
      <div class="cal-weekday">一</div>
      <div class="cal-weekday">二</div>
      <div class="cal-weekday">三</div>
      <div class="cal-weekday">四</div>
      <div class="cal-weekday">五</div>
      <div class="cal-weekday">六</div>
      ${cells.map(c => {
        if (!c) return '<div class="cal-cell empty"></div>'
        const isToday = c.date === todayStr
        const sList = c.schedules
        const sMap: Record<string, ScheduleRow> = {}
        for (const r of sList) sMap[r.slot] = r
        // 4 段小色块
        const slotBlocks = SLOT_IDS.map(sid => {
          const meta = SLOTS.find(s => s.id === sid)!
          const r = sMap[sid]
          if (!r) return `<div class="cs cs-empty" title="${meta.label}${meta.time} 未排">${meta.label}</div>`
          const statusClass = `cs-${r.status}`
          return `<div class="cs ${statusClass}" style="${typeStyle(colors, r.post_type)}" title="${meta.label}${meta.time} ${r.post_type} ${r.status}">${meta.label}</div>`
        }).join('')
        return `
        <div class="cal-cell ${isToday ? 'today' : ''} ${sList.length > 0 ? 'has-schedule' : ''}">
          <div class="cell-head">
            <span class="day-num">${c.day}</span>
            ${sList.length > 0 ? `<span class="day-count">${sList.length}</span>` : ''}
          </div>
          <div class="slot-blocks">${slotBlocks}</div>
          <div class="cell-actions">
            <a href="/calendar?month=${monthStr}&add=${c.date}" class="add-link">+ 排</a>
          </div>
        </div>`
      }).join('')}
    </div>
  </main>
</body>
</html>`
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = ctx.data.user as User | undefined
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const url = new URL(ctx.request.url)
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  const monthParam = url.searchParams.get("month")
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    year = parseInt(monthParam.slice(0, 4))
    month = parseInt(monthParam.slice(5, 7))
  }

  const monthStr = `${year}-${String(month).padStart(2, "0")}`
  const rows = await ctx.env.DB.prepare(
    "SELECT * FROM schedule WHERE user_id = ? AND date LIKE ? ORDER BY date, slot"
  ).bind(user.id, `${monthStr}-%`).all<ScheduleRow>()

  // D29: 1 date → 多条
  const map: Record<string, ScheduleRow[]> = {}
  for (const r of rows.results || []) {
    if (!map[r.date]) map[r.date] = []
    map[r.date].push(r)
  }

  // D33: 月统计（按 type / slot 聚合 + 4 段分布）
  const allRows = rows.results || []
  const monthStats = {
    total: allRows.length,
    posted: allRows.filter(r => r.status === 'posted').length,
    skipped: allRows.filter(r => r.status === 'skipped').length,
    pending: allRows.filter(r => r.status === 'pending').length,
    byType: {} as Record<string, number>,
    bySlot: {} as Record<string, number>,
  }

  // D36: 月阶段（3 月循环：破冰/转化/复购）
  const themeMonthRow = await ctx.env.DB.prepare(
    "SELECT theme, cycle_index FROM theme_months WHERE user_id = ? AND year_month = ?"
  ).bind(user.id, monthStr).first<{ theme: string; cycle_index: number }>()
  const { getMonthlyPhase } = await import("./lib/schedule-constants")
  const monthPhase = getMonthlyPhase(monthStr, themeMonthRow?.cycle_index || null)
  for (const r of allRows) {
    monthStats.byType[r.post_type] = (monthStats.byType[r.post_type] || 0) + 1
    monthStats.bySlot[r.slot] = (monthStats.bySlot[r.slot] || 0) + 1
  }

  // D33: AI 1 句点评（用 MiniMax）
  let aiComment = ""
  if (ctx.env.MINIMAX_API_KEY && monthStats.total > 0) {
    try {
      const topType = Object.entries(monthStats.byType).sort((a, b) => b[1] - a[1])[0]
      const prompt = `你是朋友圈内容教练。用户 ${monthStr} 发了 ${monthStats.posted}/${monthStats.total} 条。\n` +
        `类型分布：${JSON.stringify(monthStats.byType)}\n` +
        `时段分布：${JSON.stringify(monthStats.bySlot)}\n` +
        `最多类型：${topType ? topType[0] : "无"}（${topType ? topType[1] : 0} 条）\n` +
        `用 1 句 60-80 字的话点评这个月的朋友圈：风格温暖、具体、有 1 个改进建议。不要客套。`
      const resp = await fetch(`${(ctx.env.MINIMAX_BASE_URL || "https://api.minimax.chat/v1").replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ctx.env.MINIMAX_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ctx.env.MINIMAX_MODEL || "MiniMax-M3",
          max_tokens: 200,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (resp.ok) {
        const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
        let txt = data.choices?.[0]?.message?.content?.trim() || ""
        // 清掉 <think> 思考过程
        txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
        // 限制长度 200 字
        if (txt.length > 200) txt = txt.slice(0, 200) + "…"
        aiComment = txt
      }
    } catch (e) {
      // AI 失败 → 不影响主页面
    }
  }

  const colors = await loadUserColors(ctx.env, user.id)
  const theme = await loadUserTheme(ctx.env, user.id)

  const saved = url.searchParams.get("saved")
  const addDate = url.searchParams.get("add") || undefined
  const addSlotRaw = url.searchParams.get("slot") || undefined
  const addSlot: SlotId | undefined = addSlotRaw && isSlot(addSlotRaw) ? addSlotRaw : undefined

  // D32: 算 addDate 那天的 enabled slots（per-day 覆盖 + 全局默认）
  const { loadEnabledSlots } = await import("./lib/schedule-constants")
  const dayEnabledSlots: SlotId[] = addDate ? await loadEnabledSlots(ctx.env, user.id, addDate) : ["morning", "noon", "evening", "night"]

  let msg: string | undefined
  if (saved === "1") msg = "✓ 已更新"
  if (saved === "added") msg = "✓ 已安排排期"
  if (saved === "type_updated") msg = "✓ 已更新类型"
  if (saved === "override") msg = "✓ 已保存" + addDate + " 时段覆盖"

  return renderCalendar(year, month, map, user, colors, theme, msg, addDate, addSlot, dayEnabledSlots, monthStats, monthPhase, aiComment)
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = ctx.data.user as User | undefined
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const form = await ctx.request.formData()
  const date = String(form.get("date") || "")
  const slotRaw = String(form.get("slot") || "morning")
  const slot: SlotId = isSlot(slotRaw) ? slotRaw : "morning"
  const action = String(form.get("_action") || "toggle_status")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response("date 格式错", { status: 400 })

  const now = Date.now()

  // 动作 1：+排 → 添加或更新某天某段
  if (action === "add_or_update_type") {
    const postType = String(form.get("post_type") || "")
    if (!(POST_TYPES as readonly string[]).includes(postType)) {
      return new Response("post_type 错", { status: 400 })
    }
    const templateId = TYPE_TO_TEMPLATE[postType as keyof typeof TYPE_TO_TEMPLATE] || "lifestyle"
    const existing = await ctx.env.DB.prepare(
      "SELECT id FROM schedule WHERE user_id = ? AND date = ? AND slot = ?"
    ).bind(user.id, date, slot).first<{ id: string }>()
    if (existing) {
      await ctx.env.DB.prepare(
        "UPDATE schedule SET post_type = ?, template_id = ?, updated_at = ? WHERE user_id = ? AND date = ? AND slot = ?"
      ).bind(postType, templateId, now, user.id, date, slot).run()
      return Response.redirect(getOrigin(ctx.request) + `/calendar?month=${date.slice(0, 7)}&saved=type_updated`, 302)
    } else {
      await ctx.env.DB.prepare(
        "INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)"
      ).bind(crypto.randomUUID(), user.id, date, slot, postType, templateId, now).run()
      return Response.redirect(getOrigin(ctx.request) + `/calendar?month=${date.slice(0, 7)}&saved=added`, 302)
    }
  }

  // 动作 2：toggle status（按 (user_id, date, slot) 唯一定位）
  const status = String(form.get("status") || "pending")
  if (!["pending", "posted", "skipped"].includes(status)) return new Response("status 错", { status: 400 })

  const existing = await ctx.env.DB.prepare(
    "SELECT id, post_type, template_id FROM schedule WHERE user_id = ? AND date = ? AND slot = ?"
  ).bind(user.id, date, slot).first<{ id: string; post_type: string; template_id: string | null }>()

  if (existing) {
    await ctx.env.DB.prepare(
      "UPDATE schedule SET status=?, updated_at=? WHERE user_id=? AND date=? AND slot=?"
    ).bind(status, now, user.id, date, slot).run()
  } else {
    // 兜底 INSERT（占位 type='休息'，带 slot）
    await ctx.env.DB.prepare(
      "INSERT INTO schedule (id, user_id, date, slot, post_type, template_id, status, sort_order, updated_at) VALUES (?, ?, ?, ?, '休息', 'lifestyle', ?, 0, ?)"
    ).bind(crypto.randomUUID(), user.id, date, slot, status, now).run()
  }

  return Response.redirect(getOrigin(ctx.request) + `/calendar?month=${date.slice(0, 7)}&saved=1`, 302)
}

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; line-height: 1.6; padding-bottom: 60px; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
.topbar-inner { max-width: 920px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.brand { font-weight: 700; font-size: 16px; text-decoration: none; color: #1a202c; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.user-name { color: #4a5568; }
.logout-btn { padding: 4px 10px; background: #fff; color: #c53030; border: 1px solid #fc8181; border-radius: 16px; text-decoration: none; font-size: 12px; }
main { max-width: 920px; margin: 0 auto; padding: 20px; }
.subnav { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.subnav a { padding: 6px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; text-decoration: none; color: #4a5568; font-size: 13px; }
.subnav a.active, .subnav a:hover { background: var(--t); color: #fff; border-color: var(--t); }
.flash { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.flash-ok { background: #c6f6d5; color: #22543d; }
.cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cal-head h1 { font-size: 24px; color: #2d3748; }
.nav-link { padding: 6px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #4a5568; font-size: 13px; }
.add-form-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
.add-form-card h3 { font-size: 14px; color: #2d3748; margin-bottom: 10px; }
.add-form-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.add-date { font-weight: 600; color: #4a5568; font-size: 14px; }
.add-form-row select { padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; }
.btn-primary { padding: 6px 14px; background: var(--t); color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-primary:hover { opacity: 0.9; }
.btn-link { color: var(--t); text-decoration: none; font-size: 13px; }
.btn-link:hover { text-decoration: underline; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.slot-picker { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.slot-pick { padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; text-decoration: none; color: #4a5568; background: #fff; }
.slot-pick:hover { border-color: var(--t); color: var(--t); }
.slot-pick-cancel { background: #f7fafc; color: #a0aec0; }
.legend { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.legend-item { padding: 3px 10px; border-radius: 12px; font-size: 12px; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-weekday { padding: 6px; text-align: center; font-size: 12px; color: #718096; font-weight: 600; }
.cal-cell { min-height: 90px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.cal-cell.empty { background: transparent; border: none; }
.cal-cell.today { border-color: var(--t); border-width: 2px; }
.cal-cell.has-schedule { background: #fafbfc; }
.cell-head { display: flex; align-items: center; justify-content: space-between; }
.day-num { font-weight: 700; color: #2d3748; font-size: 14px; }
.day-count { background: var(--t); color: #fff; border-radius: 8px; padding: 0 5px; font-size: 10px; font-weight: 600; }
.slot-blocks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; flex: 1; }
.cs { padding: 3px 4px; border-radius: 3px; font-size: 10px; text-align: center; font-weight: 600; line-height: 1.2; }
.cs-empty { background: #f7fafc; color: #cbd5e0; border: 1px dashed #e2e8f0; }
.cs-posted { border: 1px solid #48bb78; }
.cs-pending { opacity: 0.85; }
.cs-skipped { opacity: 0.5; text-decoration: line-through; }
.cell-actions { display: flex; gap: 4px; }
.add-link { display: inline-block; padding: 3px 8px; background: #edf2f7; color: #4a5568; border-radius: 4px; font-size: 11px; text-decoration: none; }
.add-link:hover { background: var(--t); color: #fff; }
.muted { color: #a0aec0; font-size: 12px; }
@media (max-width: 640px) {
  .cal-cell { min-height: 70px; padding: 4px; }
  .slot-blocks { grid-template-columns: repeat(4, 1fr); }
  .cs { font-size: 9px; padding: 2px; }
  .day-num { font-size: 12px; }
}
.override-form { margin-top: 8px; }
.override-form .slot-picker { margin-top: 6px; }
.override-actions { margin-top: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.override-actions .muted { font-size: 11px; }
.slot-pick input[type="checkbox"] { margin-right: 4px; }
.slot-pick-disabled { opacity: 0.4; cursor: not-allowed; background: #f7fafc !important; color: #a0aec0; }
.month-stats-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
.month-stats-card .ms-row { display: flex; gap: 10px; margin-bottom: 12px; }
.month-stats-card .ms-stat { flex: 1; padding: 10px; border-radius: 8px; text-align: center; }
.month-stats-card .ms-num { display: block; font-size: 22px; font-weight: 700; }
.month-stats-card .ms-label { font-size: 12px; opacity: 0.8; }
.month-stats-card .ms-stat-total { background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; }
.month-stats-card .ms-stat-posted { background: #c6f6d5; color: #22543d; }
.month-stats-card .ms-stat-skipped { background: #e2e8f0; color: #4a5568; }
.month-stats-card .ms-stat-pending { background: #fefcbf; color: #744210; }
.month-stats-card .ms-breakdown { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.month-stats-card .ms-slot-bars { display: flex; flex-direction: column; gap: 4px; }
.month-stats-card .slot-bar { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.month-stats-card .sb-label { width: 60px; color: #4a5568; }
.month-stats-card .sb-track { flex: 1; height: 14px; background: #edf2f7; border-radius: 7px; overflow: hidden; }
.month-stats-card .sb-fill { height: 100%; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); transition: width 0.3s; }
.month-stats-card .sb-num { width: 30px; text-align: right; color: #2d3748; font-weight: 600; }
.month-stats-card .ms-type-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 13px; }
.month-stats-card .type-tag { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.month-stats-card .ai-comment { margin-top: 12px; padding: 10px; background: #f7fafc; border-left: 3px solid var(--t); border-radius: 4px; font-size: 13px; line-height: 1.6; }
.month-stats-card .month-phase-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; margin-bottom: 12px; font-size: 13px; }
.month-stats-card .phase-badge { padding: 4px 12px; border-radius: 4px; font-weight: 600; }
.month-stats-card .phase-badge.phase-1 { background: #e6fffa; color: #234e52; }
.month-stats-card .phase-badge.phase-2 { background: #fef5e7; color: #744210; }
.month-stats-card .phase-badge.phase-3 { background: #ebf8ff; color: #2a4365; }
`
