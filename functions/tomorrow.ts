// ============================================
// /tomorrow
// D55-18: 看明日的 5 段安排 + 主题（轻量级 read-only 页）
// - 复用 today.ts 的数据查询 + 渲染逻辑
// - 区别：日期 = today + 1，UI 无 AI 草稿/加量按钮（明天还没到）
// - 如果明天还没排 → 提示"🌱 一键排明天"
// - 顶部"← 返回今天" + 跳到日历
// ============================================

import { loadUserColors, typeStyle } from "./lib/type-colors"
import { loadUserTheme, themeCssVar } from "./lib/theme"
import { SLOTS, SLOT_IDS, DIMS, DIM_IDS, HOOK_HINTS, loadEnabledSlots, addDays, SlotId, Dim, computeDaySuggestions, loadWeekdayWeights, loadTopCategoryForDim, pickSubtheme, getWeeklyTheme, getMonthlyPhase, ymdInTZ } from "./lib/schedule-constants"
import { getThemeWeights } from "./api/theme-month"

interface User { id: string; username: string; display_name: string | null; cycle_start_date?: string | null }
interface ScheduleRow {
  id: string; date: string; slot: string; post_type: string | null; dim: string | null;
  category_id: string | null; template_id: string | null;
  status: string; note: string | null; sort_order: number;
}

const OLD_TYPE_TO_DIM: Record<string, Dim> = {
  '干货': 'F', '生活': 'E', '客户': 'B', '互动': 'G', '软广': 'C', '复盘': 'F', '休息': 'E',
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = ctx.data.user as User | undefined
    if (!user) {
      return new Response("未登录", { status: 401 })
    }
    if (!ctx.env.DB) {
      return new Response("D1 未配置", { status: 500 })
    }

    const url = new URL(ctx.request.url)
    const fwdHost = ctx.request.headers.get("X-Forwarded-Host") || url.host
    const fwdProto = ctx.request.headers.get("X-Forwarded-Host") ? ctx.request.headers.get("X-Forwarded-Proto") || "https" : url.protocol.replace(":", "")
    const origin = `${fwdProto}://${fwdHost}`

    // D55-16: 用 CST 算 today
    const today = new Date()
    const todayStr = ymdInTZ(today, "Asia/Shanghai")
    // 明天 = today + 1
    const tomorrowDate = addDays(new Date(todayStr + "T00:00:00"), 1)
    const tomorrowStr = ymdInTZ(tomorrowDate, "Asia/Shanghai")
    const weekday = `周${WEEKDAY[tomorrowDate.getDay()]}`

    // 查明天排期
    const scheduleRows = await ctx.env.DB.prepare(
      "SELECT * FROM schedule WHERE user_id = ? AND date = ? ORDER BY slot ASC, sort_order ASC"
    ).bind(user.id, tomorrowStr).all<ScheduleRow>()
    const scheduleList = scheduleRows.results || []

    const scheduleBySlot: Record<string, ScheduleRow> = {}
    const addonsBySlot: Record<string, ScheduleRow[]> = {}
    for (const r of scheduleList) {
      const so = r.sort_order || 0
      if (so === 0) scheduleBySlot[r.slot] = r
      else {
        if (!addonsBySlot[r.slot]) addonsBySlot[r.slot] = []
        addonsBySlot[r.slot].push(r)
      }
    }

    // 查明天 enabled slots
    const enabledSlots: SlotId[] = await loadEnabledSlots(ctx.env, user.id, tomorrowStr)

    // 查主题（明天也算本周主题 + 本月主题）
    const { startOfWeek } = await import("./lib/weekly")
    const weekStart = startOfWeek(tomorrowDate)
    const weekTheme = getWeeklyTheme(weekStart.toISOString().slice(0, 10), null, user.cycle_start_date)
    const themeMonthRow = await ctx.env.DB.prepare(
      "SELECT theme, custom_label, cycle_index FROM theme_months WHERE user_id = ? AND year_month = ?"
    ).bind(user.id, tomorrowStr.slice(0, 7)).first<{ theme: string; custom_label: string | null; cycle_index: number }>()
    const monthPhase = getMonthlyPhase(tomorrowStr.slice(0, 7), themeMonthRow?.cycle_index || null, user.cycle_start_date)
    const themeMonthLabel = themeMonthRow
      ? (themeMonthRow.custom_label || ({ 'awareness': '认知月', 'trust': '信任月', 'sales': '成交月', 'service': '服务月' } as Record<string, string>)[themeMonthRow.theme] || themeMonthRow.theme)
      : null

    // 查明天建议（每段 top1 dim）
    const weekdayW = await loadWeekdayWeights(ctx.env, user.id)
    const tomorrowThemeW = themeMonthRow ? getThemeWeights(themeMonthRow.theme, null) : null
    let tomorrowSuggestion: import("./lib/schedule-constants").DaySuggestion | null = null
    try {
      tomorrowSuggestion = computeDaySuggestions(
        tomorrowStr,
        tomorrowThemeW ? { theme: themeMonthRow!.theme, weights: tomorrowThemeW } : null,
        weekdayW
      )
    } catch (e) {
      console.error('[tomorrow.ts] computeDaySuggestions failed:', e)
    }

    const colors = await loadUserColors(ctx.env, user.id)
    const theme = await loadUserTheme(ctx.env, user.id)

    // 是否已排？
    const hasSchedule = Object.keys(scheduleBySlot).length > 0

    return new Response(renderTomorrowPage({
      user, todayStr, tomorrowStr, weekday, enabledSlots,
      scheduleBySlot, addonsBySlot, weekTheme, monthPhase,
      themeMonthLabel, tomorrowSuggestion, colors, theme, origin, hasSchedule,
    }), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (err: any) {
    return new Response("明日页加载失败：" + (err?.message || String(err)), { status: 500 })
  }
}

function renderTomorrowPage(args: {
  user: User
  todayStr: string
  tomorrowStr: string
  weekday: string
  enabledSlots: SlotId[]
  scheduleBySlot: Record<string, ScheduleRow>
  addonsBySlot: Record<string, ScheduleRow[]>
  weekTheme: { theme: string; label: string; cycleIndex: number; locked: boolean }
  monthPhase: { phase: number; label: string; cycleIndex: number; locked: boolean }
  themeMonthLabel: string | null
  tomorrowSuggestion: import("./lib/schedule-constants").DaySuggestion | null
  colors: Record<string, { bg: string; fg: string }>
  theme: { start: string; end: string; solid: string }
  origin: string
  hasSchedule: boolean
}): string {
  const { user, todayStr, tomorrowStr, weekday, enabledSlots, scheduleBySlot, addonsBySlot, weekTheme, monthPhase, themeMonthLabel, tomorrowSuggestion, colors, theme, origin, hasSchedule } = args

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>明日 ${tomorrowStr} · 朋友圈助手</title>
  ${themeCssVar(theme)}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7fafc; color: #1a202c; margin: 0; padding: 0; }
    .topbar { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 12px 20px; display: flex; align-items: center; gap: 16px; }
    .topbar h1 { margin: 0; font-size: 18px; color: #553c9a; }
    .topbar a { color: #553c9a; text-decoration: none; font-size: 14px; padding: 4px 10px; border-radius: 6px; }
    .topbar a:hover { background: #f0e8ff; }
    .topbar .spacer { flex: 1; }
    .user-tag { color: #4a5568; font-size: 13px; }
    main { max-width: 920px; margin: 0 auto; padding: 20px; }
    .date-banner { background: linear-gradient(135deg, #553c9a 0%, #805ad5 100%); color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    .date-banner .date { font-size: 28px; font-weight: 700; }
    .date-banner .weekday { font-size: 16px; opacity: 0.9; }
    .theme-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .theme-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
    .theme-card h4 { margin: 0 0 6px; font-size: 13px; color: #718096; font-weight: 500; }
    .theme-card .label { font-size: 18px; font-weight: 600; color: #2d3748; }
    .theme-card .meta { font-size: 12px; color: #a0aec0; margin-top: 4px; }
    .empty-card { background: #fff; border: 2px dashed #cbd5e0; border-radius: 12px; padding: 40px 24px; text-align: center; margin-bottom: 20px; }
    .empty-card h3 { color: #553c9a; margin: 0 0 8px; }
    .empty-card p { color: #718096; margin: 0 0 16px; }
    .empty-card button { padding: 10px 24px; background: #553c9a; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .empty-card button:hover { background: #6b46c1; }
    .empty-card button:disabled { background: #a0aec0; cursor: not-allowed; }
    .slot-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; }
    .slot-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .slot-head h3 { margin: 0; font-size: 16px; color: #2d3748; }
    .dim-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; }
    .addon-list { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
    .addon-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; color: #4a5568; }
    .read-only-tag { background: #f0e8ff; color: #553c9a; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: auto; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>📅 朋友圈助手</h1>
    <a href="/today">← 返回今天</a>
    <a href="/calendar">🗓 日历</a>
    <a href="/my/theme-week">🗓 主题周</a>
    <span class="spacer"></span>
    <span class="user-tag">👤 ${escapeHtml(user.display_name || user.username)}</span>
  </div>
  <main>
    <div class="date-banner">
      <div>
        <div class="date">📅 明天 ${tomorrowStr}</div>
        <div class="weekday">${weekday} · D+1 预览</div>
      </div>
      <div style="text-align:right;font-size:12px;opacity:0.85;">基于 <code>${escapeHtml(user.cycle_start_date || '未设置')}</code> 排期起点</div>
    </div>

    <div class="theme-bar">
      <div class="theme-card">
        <h4>🗓 本周主题（D55-15）</h4>
        <div class="label">${escapeHtml(weekTheme.label)}</div>
        <div class="meta">第 ${weekTheme.cycleIndex + 1}/4 周${weekTheme.locked ? '（锁定）' : ''}</div>
      </div>
      <div class="theme-card">
        <h4>🎯 本月主题</h4>
        <div class="label">${escapeHtml(themeMonthLabel || '未设置')}</div>
        <div class="meta">阶段 ${monthPhase.phase}/4 · ${escapeHtml(monthPhase.label)}</div>
      </div>
    </div>

    ${!hasSchedule ? `
      <div class="empty-card">
        <h3>🌱 明天还没排</h3>
        <p>系统会按你当前的主题月/周主题 + 4 层权重为明天生成 ${enabledSlots.length} 段排期</p>
        <button type="button" id="seedTomorrowBtn">🌱 一键排明天</button>
        <span id="seedStatus" style="margin-left:12px;color:#718096;font-size:12px;"></span>
      </div>
    ` : `
      <div style="margin-bottom:14px;color:#4a5568;font-size:13px;">
        ✓ 已为明天排好 <strong>${Object.keys(scheduleBySlot).length}</strong> 段${Object.values(addonsBySlot).flat().length > 0 ? ` + ${Object.values(addonsBySlot).flat().length} 条加量` : ''}（只读，到明天会自动转到 /today）
      </div>
    `}

    ${enabledSlots.map(sid => {
      const meta = SLOTS.find(s => s.id === sid)!
      const r = scheduleBySlot[sid]
      const addons = addonsBySlot[sid] || []
      const schedType = r?.post_type || "休息"
      const schedDim: Dim = (r?.dim && DIM_IDS.includes(r.dim as Dim)) ? (r.dim as Dim) : (OLD_TYPE_TO_DIM[schedType] || 'F')
      const css = typeStyle(colors, schedDim)
      const dimName = DIMS.find(x => x.id === schedDim)?.name || schedDim
      const subtheme = pickSubtheme(schedDim, tomorrowStr)
      return `
        <div class="slot-card">
          <div class="slot-head">
            <h3>⏰ ${escapeHtml(meta.label)} ${escapeHtml(meta.time)}</h3>
            ${r ? `<span class="dim-badge" style="${css}">${schedDim} ${escapeHtml(dimName)}</span>` : '<span class="dim-badge" style="background:#edf2f7;color:#a0aec0;">未排</span>'}
            <span class="read-only-tag">👀 只读</span>
          </div>
          ${subtheme ? `<div style="font-size:12px;color:#718096;margin-bottom:4px;">📍 ${escapeHtml(subtheme.label)}</div>` : ''}
          ${HOOK_HINTS[schedDim] ? `<p style="font-size:12px;color:#4a5568;margin:4px 0 0;">💡 ${escapeHtml((HOOK_HINTS[schedDim] || '').split('\\n').find(l => l.trim()) || '')}</p>` : ''}
          ${r?.note ? `<div style="margin-top:6px;padding:6px 10px;background:#f0e8ff;border-radius:6px;font-size:12px;color:#553c9a;">📝 备注：${escapeHtml(r.note)}</div>` : ''}
          ${addons.length > 0 ? `<div class="addon-list">${addons.map((a, idx) => {
            const aDim: Dim = (a.dim && DIM_IDS.includes(a.dim as Dim)) ? (a.dim as Dim) : (OLD_TYPE_TO_DIM[a.post_type || '休息'] || 'F')
            const aCss = typeStyle(colors, aDim)
            return `<div class="addon-row"><span class="dim-badge" style="${aCss}font-size:11px;">➕ 加量 ${idx + 1} · ${aDim}</span>${a.note ? `<span style="color:#718096;">${escapeHtml(a.note)}</span>` : ''}</div>`
          }).join('')}</div>` : ''}
          ${!r && tomorrowSuggestion?.slots?.[sid] ? `<div style="margin-top:8px;font-size:12px;color:#a0aec0;">💭 系统建议：<span class="dim-badge" style="${typeStyle(colors, tomorrowSuggestion.slots[sid].dim1)}font-size:11px;">${tomorrowSuggestion.slots[sid].dim1}</span>（top1，权重 ${tomorrowSuggestion.slots[sid].weight1}%）</div>` : ''}
        </div>
      `
    }).join('')}

    <div style="margin-top:20px;padding:12px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#718096;">
      💡 <strong>说明</strong>：明天到 0:00 后会自动转到 <a href="/today" style="color:#553c9a;">/today</a> 页（同样 5 段 + 主题），届时可点 ✓ 标记已发、+ 加量、🤖 AI 帮我写。
      <br>现在这里只是 <strong>预览</strong>，无法编辑或 AI 草稿（明天还没到呢）。
    </div>
  </main>
  <script>
    const seedBtn = document.getElementById('seedTomorrowBtn')
    if (seedBtn) {
      seedBtn.onclick = async () => {
        seedBtn.disabled = true
        const orig = seedBtn.textContent
        seedBtn.textContent = '⏳ 排期中...'
        const status = document.getElementById('seedStatus')
        if (status) status.textContent = '调用 /api/schedule/seed...'
        try {
          const r = await fetch('/api/schedule/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: ${JSON.stringify(tomorrowStr)}, days: 1, overwrite: false }),
          })
          const data = await r.json()
          if (data.ok) {
            if (status) status.textContent = '✓ 排好 ' + data.inserted + ' 条'
            seedBtn.textContent = '✓ 已排好，刷新中...'
            setTimeout(() => location.reload(), 500)
          } else {
            throw new Error(data.error || '排期失败')
          }
        } catch (err) {
          if (status) status.textContent = '✗ ' + err.message
          seedBtn.textContent = orig
          seedBtn.disabled = false
        }
      }
    }
  </script>
</body>
</html>`
}
