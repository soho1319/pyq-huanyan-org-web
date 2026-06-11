// ============================================
// /today
// 多用户今日页：D29 一天 4 段（早 8 / 午 12:30 / 晚 20 / 夜 22:30）
// 4 张 slot-card 渲染：每张独立 AI + 加量 + 标记已发
// D46: 每段下挂 1 个"可选加量" sub-card（top2 type），3 按钮：✅/🔄/✕
// ============================================

import { loadUserColors, typeStyle } from "./lib/type-colors"
import { loadUserTheme, themeCssVar } from "./lib/theme"
import { SLOTS, SLOT_IDS, TYPE_TIPS, HOOK_HINTS, loadEnabledSlots, SlotId, DIMENSION_TYPE_MAP, computeDaySuggestions, loadWeekdayWeights } from "./lib/schedule-constants"
import { getThemeWeights } from "./api/theme-month"

interface User {
  id: string
  username: string
  display_name: string | null
  is_admin: number
}

interface ScheduleRow {
  id: string
  user_id: string
  date: string
  slot: string
  post_type: string
  template_id: string | null
  status: string
  note: string | null
  sort_order?: number
}

interface AiDraftRow {
  id: string
  draft_1: string
  draft_2: string
  draft_3: string
  chosen_index: number
  chosen_text: string | null
  model: string | null
  slot: string | null
  created_at: number
}

const TEMPLATE_NAMES: Record<string, string> = {
  pro: "专业干货",
  lifestyle: "生活场景",
  testimonial: "客户证言",
  ask: "互动提问",
  softad: "软广改写",
  review: "复盘",
  contrarian: "反认知 + 痛点 + 行动",
  pain: "痛点具象化",
  boundary: "立边界 5 句式",
  story: "故事万能模板",
  hook: "金句钩子",
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  )
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database; SESSION_SECRET?: string }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = ctx.data.user as User | undefined
  if (!user) {
    return new Response("未登录", { status: 401 })
  }
  if (!ctx.env.DB) {
    return new Response("D1 未配置", { status: 500 })
  }

  // 取得 origin
  const url = new URL(ctx.request.url)
  const fwdHost = ctx.request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = ctx.request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  const today = new Date()
  const todayStr = ymd(today)
  const weekday = WEEKDAY[today.getDay()]

  // 查今天排期（D29: 多条，按 slot 排序）
  const scheduleRows = await ctx.env.DB.prepare(
    "SELECT * FROM schedule WHERE user_id = ? AND date = ? ORDER BY slot ASC, sort_order ASC"
  ).bind(user.id, todayStr).all<ScheduleRow>()
  const scheduleList = scheduleRows.results || []

  // D46: 按 slot 分组，区分固定 (sort_order=0) 和加量 (sort_order>=1)
  const scheduleBySlot: Record<string, ScheduleRow> = {}     // 固定：每段 1 条
  const addonsBySlot: Record<string, ScheduleRow[]> = {}     // 加量：每段 0-N 条
  for (const r of scheduleList) {
    const so = r.sort_order || 0
    if (so === 0) {
      scheduleBySlot[r.slot] = r
    } else {
      if (!addonsBySlot[r.slot]) addonsBySlot[r.slot] = []
      addonsBySlot[r.slot].push(r)
    }
  }

  // 查用户 enabled slots（per-date JSON 覆盖 + 默认 N 段）
  const enabledSlots: SlotId[] = await loadEnabledSlots(ctx.env, user.id, todayStr)

  // 查今天 AI 草稿（按 slot 分组，每段最多 1 条已用）
  const todayDraftsRows = await ctx.env.DB.prepare(
    "SELECT id, draft_1, draft_2, draft_3, chosen_index, chosen_text, model, slot, created_at FROM ai_drafts WHERE user_id = ? AND date = ? AND chosen_index IS NOT NULL ORDER BY slot ASC, used_at DESC"
  ).bind(user.id, todayStr).all<AiDraftRow>()
  const draftsBySlot: Record<string, AiDraftRow> = {}
  for (const d of todayDraftsRows.results || []) if (d.slot) draftsBySlot[d.slot] = d

  // scheduleBySlot + 加量分组（D46 已在上面按 sort_order 区分）
  // 兼容旧变量：schedule = 第一条（按 sort_order ASC 的固定行）
  const schedule: ScheduleRow | null = scheduleBySlot[enabledSlots[0] || "morning"] || null
  const postType = schedule?.post_type || "休息"

  // 查我的素材
  const intros = await ctx.env.DB.prepare(
    "SELECT slot, content FROM intros WHERE user_id = ?"
  ).bind(user.id).all<{ slot: string; content: string }>()

  // 查用户自定义颜色 + 主题色
  const colors = await loadUserColors(ctx.env, user.id)
  const theme = await loadUserTheme(ctx.env, user.id)
  const cases = await ctx.env.DB.prepare(
    "SELECT id, name, persona, pain, action, result, testimonial FROM cases WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 5"
  ).bind(user.id).all<{ id: string; name: string | null; persona: string | null; pain: string | null; action: string | null; result: string | null; testimonial: string | null }>()
  const quotes = await ctx.env.DB.prepare(
    "SELECT id, text, category FROM quotes WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(user.id).all<{ id: string; text: string; category: string | null }>()
  const formulas = await ctx.env.DB.prepare(
    "SELECT id, formula_id, variant_index, filled_text FROM formula_templates WHERE user_id = ? ORDER BY formula_id ASC, variant_index ASC"
  ).bind(user.id).all<{ id: string; formula_id: string; variant_index: number; filled_text: string }>()

  // ★ 查当月所有排期（用于本月排期预览）
  const monthStart = todayStr.slice(0, 7) + "-01"  // YYYY-MM-01
  const monthEndRows = await ctx.env.DB.prepare(
    "SELECT date(post_type) as d FROM schedule WHERE user_id = ? AND date >= ? AND date < date(?, '+1 month')"
  ).bind(user.id, monthStart, monthStart).all<{ d: string }>()
  // 简化：D1 不支持 date() 函数嵌套参数拼接，改成 JS 算 monthEnd
  const [y, m] = [parseInt(todayStr.slice(0, 4)), parseInt(todayStr.slice(5, 7))]
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`
  const monthSchedule = await ctx.env.DB.prepare(
    "SELECT date, post_type, status FROM schedule WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date ASC"
  ).bind(user.id, monthStart, nextMonth).all<{ date: string; post_type: string; status: string }>()

  // ★ D30: 查本周汇总（周一开始）
  const { loadWeekData } = await import("./lib/weekly")
  const { startOfWeek } = await import("./lib/weekly")
  const weekStart = startOfWeek(new Date(todayStr + "T00:00:00"))
  const weekData = await loadWeekData(ctx.env.DB, user.id, weekStart)

  // ★ D31: 查本月主题
  const themeMonthRow = await ctx.env.DB.prepare(
    "SELECT theme, custom_label, cycle_index FROM theme_months WHERE user_id = ? AND year_month = ?"
  ).bind(user.id, todayStr.slice(0, 7)).first<{ theme: string; custom_label: string | null; cycle_index: number }>()

  // ★ D36: 算本周主题 + 本月阶段
  const { getWeeklyTheme, getMonthlyPhase, WEEKLY_THEMES, DIMENSION_TYPE_MAP, reverseDimensionMap } = await import("./lib/schedule-constants")
  const weekTheme = getWeeklyTheme(weekStart.toISOString().slice(0, 10), null)

  // ★ D39: 算本周主题"已发数"——取本周主题 top 1 类的已发数 + 总排数
  const themeTopType = (Object.entries(weekTheme.weights) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "干货"
  const weekTopPosted = (weekData.byType as Record<string, number>)[themeTopType] || 0
  const weekTopTotal = weekData.total
  // 本周主题建议覆盖率：按主题 top 1 类的 7 类总和推算（粗略）
  const themeTypeSum = Object.values(weekTheme.weights).reduce((a, b) => a + b, 0)
  const weekTopSuggested = Math.round(weekTopTotal * (weekTheme.weights[themeTopType] / themeTypeSum) * 0.6)  // 60% 系数软目标
  const monthPhase = getMonthlyPhase(todayStr.slice(0, 7), themeMonthRow?.cycle_index || null)

  // ★ D42-E: 算"明天"建议（用同 D36 4 层权重 + 主题月 + weekday weights）
  let daySuggestion: import("./lib/schedule-constants").DaySuggestion | null = null
  let daySuggestionError: string | null = null
  // D46: 算"今天"建议（用于每段 top2 候选加量 sub-card）
  let todaySuggestion: import("./lib/schedule-constants").DaySuggestion | null = null
  let todaySuggestionError: string | null = null
  try {
    const weekdayW = await loadWeekdayWeights(ctx.env, user.id)
    // 今日
    const todayMonthRow = await ctx.env.DB.prepare(
      "SELECT theme, custom_label, cycle_index FROM theme_months WHERE user_id = ? AND year_month = ?"
    ).bind(user.id, todayStr.slice(0, 7)).first<{ theme: string; custom_label: string | null; cycle_index: number }>()
    const todayThemeW = todayMonthRow ? getThemeWeights(todayMonthRow.theme, null) : null
    todaySuggestion = computeDaySuggestions(
      todayStr,
      todayThemeW ? { theme: todayMonthRow!.theme, weights: todayThemeW } : null,
      weekdayW
    )
    // 明天
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = ymd(tomorrow)
    const tomorrowMonth = await ctx.env.DB.prepare(
      "SELECT theme, custom_label, cycle_index FROM theme_months WHERE user_id = ? AND year_month = ?"
    ).bind(user.id, tomorrowStr.slice(0, 7)).first<{ theme: string; custom_label: string | null; cycle_index: number }>()
    const tomorrowThemeW = tomorrowMonth ? getThemeWeights(tomorrowMonth.theme, null) : null
    daySuggestion = computeDaySuggestions(
      tomorrowStr,
      tomorrowThemeW ? { theme: tomorrowMonth!.theme, weights: tomorrowThemeW } : null,
      weekdayW
    )
  } catch (err) {
    daySuggestionError = err instanceof Error ? err.message : String(err)
    todaySuggestionError = err instanceof Error ? err.message : String(err)
    console.error('[D42-E/D46] computeDaySuggestions failed:', err)
  }

  // ★ D40: 算本周 7 维度覆盖（用 post_type 反查人设维度）
  const dimCounts: Record<string, number> = {}
  for (const dim of Object.keys(DIMENSION_TYPE_MAP)) dimCounts[dim] = 0
  for (const r of weekData.byType ? Object.entries(weekData.byType) : []) {
    const dims = reverseDimensionMap(r[0])
    for (const d of dims) dimCounts[d] = (dimCounts[d] || 0) + r[1]
  }
  const sortedDims = Object.entries(dimCounts).sort((a, b) => a[1] - b[1])
  const lowDims = sortedDims.slice(0, 2).map(([d]) => d)
  const dimMax = Math.max(1, ...Object.values(dimCounts))  // 进度条分母

  const introsMap: Record<string, string> = {}
  for (const r of intros.results || []) introsMap[r.slot] = r.content
  const casesList = cases.results || []
  const quotesList = quotes.results || []
  const formulasList = formulas.results || []

  // 渲染 HTML
  const html = renderToday({
    user,
    todayStr,
    weekday,
    scheduleBySlot,
    addonsBySlot,        // D46
    draftsBySlot,
    enabledSlots,
    introsMap,
    casesList,
    quotesList,
    formulasList,
    monthSchedule: monthSchedule.results || [],
    weekData,
    themeMonth: themeMonthRow,
    weekTheme,
    monthPhase,
    themeTopType,
    weekTopPosted,
    weekTopSuggested,
    dimCounts,
    lowDims,
    dimMax,
    daySuggestion: daySuggestion!,
    daySuggestionError,
    todaySuggestion,     // D46
    todaySuggestionError,// D46
    origin,
    colors,
    theme,
  })

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

function renderDaySuggestion(
  s: import("./lib/schedule-constants").DaySuggestion,
  colors: Record<string, { bg: string; fg: string }>
): string {
  const slotOrder: SlotId[] = ['morning', 'noon', 'evening', 'night']
  const slotMeta = SLOTS.find(sl => sl.id === 'morning')! // 用 SLOTS 标签
  const slotLabelMap: Record<SlotId, string> = { morning: '早 8', noon: '午 12:30', evening: '晚 20', night: '夜 22:30' }
  const topTypeStyle = (t: string) => `background:${colors[t]?.bg || '#e2e8f0'};color:${colors[t]?.fg || '#1a202c'};`

  return `
  <section class="card day-suggestion-card">
    <div class="card-head">
      <h2>💡 明日建议（${s.date} · ${s.weekdayLabel}${s.isWeekend ? ' · 周末' : ''}）</h2>
      <span class="muted">提前 1 天规划，按 D36 4 层权重算</span>
    </div>
    <div class="ds-theme-row">
      <span class="theme-week-badge">📌 周主题：<strong>${escapeHtml(s.weekTheme.label)}</strong>（第 ${s.weekTheme.cycleIndex + 1}/4 周）</span>
      <span class="theme-phase-badge phase-${s.monthPhase.phase}">🎯 月阶段：${escapeHtml(s.monthPhase.label)}（第 ${s.monthPhase.cycleIndex}/3 月）</span>
      <span class="muted ds-phase">周内比重：<strong>${s.weekdayPhase === 'early' ? '周初' : s.weekdayPhase === 'mid' ? '周中' : '周末'}</strong></span>
    </div>
    <div class="ds-day-top">
      <span class="muted">明日 4 段联合最推 →</span>
      <span class="ds-day-top-type" style="${topTypeStyle(s.dayTopType)}">${s.dayTopType}</span>
      <span class="muted">${escapeHtml(s.dayTopHint)}</span>
    </div>
    <div class="ds-slots">
      ${slotOrder.map(sid => {
        const slot = s.slots[sid]
        return `
        <div class="ds-slot">
          <div class="ds-slot-time">${slotLabelMap[sid]}</div>
          <div class="ds-slot-type" style="${topTypeStyle(slot.type)}">${slot.type}<span class="ds-weight">${slot.weight1}%</span></div>
          <div class="ds-slot-alt">备选 <span class="ds-alt-type" style="${topTypeStyle(slot.type2)}">${slot.type2}</span> ${slot.weight2}%</div>
          <div class="ds-slot-hint">${escapeHtml(slot.hookHint)}</div>
          <div class="ds-slot-dims">${slot.topDims.map(d => `<span class="ds-dim">${d}</span>`).join(' ')}</div>
        </div>
        `
      }).join('')}
    </div>
  </section>
  `
}

function renderMonthStrip(
  monthSchedule: Array<{ date: string; post_type: string; status: string }>,
  todayStr: string,
  colors: Record<string, { bg: string; fg: string }>,
  monthLabel: string
): string {
  // 把排期 map 化
  const map: Record<string, { post_type: string; status: string }> = {}
  for (const r of monthSchedule) map[r.date] = { post_type: r.post_type, status: r.status }

  // 当月天数
  const [y, m] = [parseInt(monthLabel.slice(0, 4)), parseInt(monthLabel.slice(5, 7))]
  const daysInMonth = new Date(y, m, 0).getDate()
  // 当月 1 号是星期几（0=日, 1=一 ...）
  const firstWd = new Date(y, m - 1, 1).getDay()

  // 统计
  const posted = monthSchedule.filter(r => r.status === 'posted').length
  const skipped = monthSchedule.filter(r => r.status === 'skipped').length
  const pending = monthSchedule.filter(r => r.status === 'pending').length

  // 渲染 30 天网格
  const cells: string[] = []
  // 补空格
  for (let i = 0; i < firstWd; i++) cells.push('<div class="day-cell empty"></div>')
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${monthLabel}-${String(d).padStart(2, "0")}`
    const r = map[ds]
    const isToday = ds === todayStr
    const isPast = ds < todayStr
    let cellClass = 'day-cell'
    let cellStyle = ''
    let mark = ''
    if (r) {
      cellClass += ' has'
      const cs = colors[r.post_type] || { bg: '#e2e8f0', fg: '#1a202c' }
      cellStyle = `background:${cs.bg};color:${cs.fg};`
      if (r.status === 'posted') mark = '<span class="day-mark">✓</span>'
      else if (r.status === 'skipped') mark = '<span class="day-mark skip">—</span>'
    } else {
      cellClass += ' none'
    }
    if (isToday) cellClass += ' today'
    if (isPast && !r) cellClass += ' past'
    cells.push(
      `<div class="${cellClass}" style="${cellStyle}" title="${ds} ${r ? r.post_type + ' ' + r.status : '未排期'}">` +
        `<span class="day-num">${d}</span>${mark}` +
      `</div>`
    )
  }

  return `
  <section class="card month-strip-card">
    <div class="card-head">
      <h2>📅 ${monthLabel} 排期（${monthSchedule.length}/${daysInMonth}）</h2>
      <a href="/calendar" class="btn-link">看完整月历 →</a>
    </div>
    <div class="month-stats">
      <span class="ms ms-posted">✓ ${posted} 已发</span>
      <span class="ms ms-pending">○ ${pending} 待发</span>
      <span class="ms ms-skipped">— ${skipped} 跳过</span>
      <span class="ms ms-none">· ${daysInMonth - monthSchedule.length} 未排</span>
    </div>
    <div class="day-grid">
      <div class="day-weekday">日</div>
      <div class="day-weekday">一</div>
      <div class="day-weekday">二</div>
      <div class="day-weekday">三</div>
      <div class="day-weekday">四</div>
      <div class="day-weekday">五</div>
      <div class="day-weekday">六</div>
      ${cells.join('')}
    </div>
    <div class="month-actions">
      <button type="button" id="seedBtn" class="btn-seed">🌱 一键生成 30 天排期（空缺补上，已排的不动）</button>
      <span class="muted" id="seedStatus"></span>
    </div>
  </section>
  `
}

function renderToday(args: {
  user: User
  todayStr: string
  weekday: string
  scheduleBySlot: Record<string, ScheduleRow>
  draftsBySlot: Record<string, AiDraftRow>
  enabledSlots: SlotId[]
  introsMap: Record<string, string>
  casesList: Array<{ id: string; name: string | null; persona: string | null; pain: string | null; action: string | null; result: string | null; testimonial: string | null }>
  quotesList: Array<{ id: string; text: string; category: string | null }>
  formulasList: Array<{ id: string; formula_id: string; variant_index: number; filled_text: string }>
  monthSchedule: Array<{ date: string; post_type: string; status: string }>
  weekData: { week_start: string; week_end: string; posted: number; skipped: number; pending: number; total: number; byType: Record<string, number>; bySlot: Record<string, number> }
  themeMonth: { theme: string; custom_label: string | null } | null
  weekTheme: { theme: string; label: string; cycleIndex: number; locked: boolean }
  monthPhase: { phase: number; label: string; cycleIndex: number; locked: boolean }
  themeTopType: string
  weekTopPosted: number
  weekTopSuggested: number
  dimCounts: Record<string, number>
  lowDims: string[]
  dimMax: number
  daySuggestion: import("./lib/schedule-constants").DaySuggestion | null
  daySuggestionError: string | null
  todaySuggestion: import("./lib/schedule-constants").DaySuggestion | null  // D46
  todaySuggestionError: string | null                                       // D46
  addonsBySlot: Record<string, ScheduleRow[]>                               // D46
  origin: string
  colors: Record<string, { bg: string; fg: string }>
  theme: { start: string; end: string; solid: string }
}): string {
  const { user, todayStr, weekday, scheduleBySlot, addonsBySlot, draftsBySlot, enabledSlots, introsMap, casesList, quotesList, formulasList, monthSchedule, weekData, themeMonth, weekTheme, monthPhase, themeTopType, weekTopPosted, weekTopSuggested, dimCounts, lowDims, dimMax, daySuggestion, daySuggestionError, todaySuggestion, todaySuggestionError, origin, colors, theme } = args
  // 向后兼容：保留 postType / templateId / templateName / typeTip（AI 帮写区还引用）
  const firstSlot = enabledSlots[0] || "morning"
  const firstSched = scheduleBySlot[firstSlot] || scheduleBySlot["morning"] || null
  const postType = firstSched?.post_type || "休息"
  const templateId = firstSched?.template_id || "lifestyle"
  const templateName = TEMPLATE_NAMES[templateId] || templateId
  const typeTip = TYPE_TIPS[postType] || ""
  const typeCss = typeStyle(colors, postType)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>今日 · ${escapeHtml(user.display_name || user.username)} · pyq</title>
${themeCssVar(theme)}
<style>${styles}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/today" class="brand">🛠️ 朋友圈工作台</a>
      <div class="user">
        <span class="user-name">${escapeHtml(user.display_name || user.username)}${user.is_admin ? ' <span class="badge">admin</span>' : ''}</span>
        <a href="${escapeHtml(origin)}/logout" class="logout-btn">🔓 退出</a>
      </div>
    </div>
  </header>

  <nav class="subnav">
    <a href="/today" class="active">📅 今日</a>
    <a href="/my/intros">👋 自我介绍</a>
    <a href="/my/cases">👥 客户案例</a>
    <a href="/my/quotes">💎 金句库</a>
    <a href="/my/formulas">✍️ 公式填空</a>
    <a href="/calendar">🗓 日历</a>
    <a href="/history">📜 草稿历史</a>
    <a href="/my/types">🎨 颜色</a>
    <a href="/my/theme">🎯 主题月</a>
    <a href="/my/theme-week">🗓 主题周</a>
  </nav>

  <main>
    <div class="date-banner">
      <div class="date">${todayStr}</div>
      <div class="weekday">${weekday}</div>
    </div>

    ${daySuggestion ? renderDaySuggestion(daySuggestion, colors) : ''}
    ${daySuggestionError ? `<div style="background:#fed7d7;color:#c53030;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:13px;">[D42-E] 明日建议计算失败：${escapeHtml(daySuggestionError)}</div>` : ''}

    <section class="slot-cards-area">
      <div class="card-head-area">
        <h2>📌 今日要发（${enabledSlots.length} 段固定 + <span id="addonTotalCount">0</span> 加量 = 共发 <span id="totalPostCount">${enabledSlots.length}</span> 条）</h2>
        <span class="muted">4 段固定：早 8 / 午 12:30 / 晚 20 / 夜 22:30。要几条去 <a href="/my/types">🎨 颜色</a> 配</span>
      </div>
      <div class="reseed-today-bar">
        <button type="button" id="reseedTodayBtn" class="btn-reseed-today">🔄 重新排今天（按当前主题月/周主题）</button>
        <span class="muted" id="reseedTodayStatus"></span>
        <span class="muted reseed-hint">已发的不动 · 仅改 pending / skipped</span>
      </div>
      ${enabledSlots.map(sid => {
        const meta = SLOTS.find(s => s.id === sid)!
        const r = scheduleBySlot[sid] || scheduleBySlot["morning"] // 兼容旧 slot='main' 兜底（migration 已统一为 'morning'）
        const draft = draftsBySlot[sid]
        const schedType = r?.post_type || "休息"
        const schedTypeCss = typeStyle(colors, schedType)
        const statusText = r ? (r.status === 'posted' ? '✓ 已发' : r.status === 'skipped' ? '— 跳' : '○ 待发') : '○ 待发'
        // D46: 已有加量（DB 里 sort_order>=1 的行）
        const slotAddons = addonsBySlot[sid] || []
        // D46: 候选 = todaySuggestion 的 top2（如果已有加量就不显示候选卡）
        const slotSug = todaySuggestion?.slots?.[sid]
        const hasCandidate = !!r && slotAddons.length === 0 && slotSug && slotSug.type2 && slotSug.type2 !== schedType
        const candidateFirstHook = slotSug ? (HOOK_HINTS[slotSug.type2] || '').split('\n').find(l => l.trim()) || '' : ''
        const topNJson = slotSug ? JSON.stringify(slotSug.topN.map(x => ({ type: x.type, weight: x.weight }))) : '[]'
        return `
        <section class="card slot-card slot-${sid}">
          <div class="card-head">
            <h3>⏰ ${meta.label} ${meta.time}</h3>
            <span class="status status-${r?.status || 'pending'}">${statusText}</span>
          </div>
          <div class="type-badge" style="${schedTypeCss}">${schedType}</div>
          <p class="type-tip">${escapeHtml(TYPE_TIPS[schedType] || '')}</p>
          ${r?.note ? `<div class="note-box">📝 加量：${escapeHtml(r.note)}</div>` : ''}
          ${slotAddons.length > 0 ? `<div class="addon-list">
            ${slotAddons.map((a, idx) => `
              <div class="addon-row">
                <span class="addon-badge" style="${typeStyle(colors, a.post_type)}">➕ 加量 ${idx + 1} · ${a.post_type}</span>
                ${a.status === 'posted' ? '<span class="status status-posted">✓ 已发</span>' : a.status === 'skipped' ? '<span class="status status-skipped">— 跳</span>' : '<span class="status status-pending">○ 待发</span>'}
              </div>
            `).join('')}
          </div>` : ''}
          ${hasCandidate ? `<div class="candidate-card" data-slot="${sid}" data-fixed="${escapeHtml(schedType)}" data-topn='${escapeHtml(topNJson)}' data-idx="1">
            <div class="candidate-head">➕ 可选加量（D46 top2）</div>
            <div class="candidate-body">
              <span class="candidate-type-badge" data-cand-type style="${typeStyle(colors, slotSug.type2)}">${slotSug.type2}</span>
              <span class="candidate-weight" data-cand-weight>${slotSug.weight2}%</span>
              <span class="candidate-hook muted" data-cand-hook>${escapeHtml(candidateFirstHook)}</span>
            </div>
            <div class="candidate-actions">
              <button type="button" class="btn-cand-accept" data-slot="${sid}">✅ 用这条</button>
              <button type="button" class="btn-cand-swap" data-slot="${sid}">🔄 换</button>
              <button type="button" class="btn-cand-skip" data-slot="${sid}">✕ 跳</button>
            </div>
          </div>` : ''}
          <form class="addon-form" method="POST" action="${escapeHtml(origin)}/api/today/addon">
            <input type="hidden" name="slot" value="${sid}">
            <textarea name="note" rows="2" placeholder="本时段想说点啥（可选）">${escapeHtml(r?.note || '')}</textarea>
            <div class="form-actions">
              <button type="submit" name="action" value="note" class="btn-primary">💾 保存加量</button>
              ${r ? `<button type="submit" name="action" value="posted" class="btn-success">✓ 标记已发</button><button type="submit" name="action" value="skipped" class="btn-muted">— 跳</button>` : `<button type="submit" name="action" value="note" class="btn-secondary">+ 加 1 条加量</button>`}
            </div>
          </form>
          <div class="ai-zone" data-slot="${sid}">
            ${draft ? `
              <div class="posted-mini">
                <span class="posted-tag">✓ AI 草稿 ${draft.chosen_index} 已发</span>
                <pre class="posted-text-mini" id="posted_${sid}">${escapeHtml(draft.chosen_text || '')}</pre>
                <button type="button" class="btn-copy" data-target="posted_${sid}">📋 复制</button>
              </div>
            ` : ''}
            <button type="button" class="btn-ai btn-ai-slot" data-type="${schedType}" data-slot="${sid}" data-addon="${escapeHtml(r?.note || '')}">🤖 AI 帮我写 3 条候选</button>
            <span class="ai-status muted" id="aiStatus_${sid}"></span>
            <div class="ai-drafts" id="aiDrafts_${sid}" style="display:none"></div>
          </div>
        </section>
        `
      }).join('')}
    </section>

    <section class="card week-summary-card">
      <div class="card-head">
        <h2>📊 本周（${weekData.week_start} - ${weekData.week_end}）</h2>
        <button type="button" id="weeklySummaryBtn" class="btn-link">📝 生成复盘文案</button>
      </div>
      <div class="theme-week-row">
        <span class="theme-week-badge">📌 本周主题：<strong>${escapeHtml(weekTheme.label)}</strong>（第 ${weekTheme.cycleIndex + 1}/4 周循环）</span>
        <span class="theme-phase-badge phase-${monthPhase.phase}">🎯 月阶段：${escapeHtml(monthPhase.label)}（第 ${monthPhase.cycleIndex}/3 月）</span>
        <a href="/my/theme-week" class="btn-link">查看/锁定 →</a>
      </div>
      <div class="theme-progress-row">
        <span class="muted">本周"<strong>${escapeHtml(themeTopType)}</strong>"已发 <strong>${weekTopPosted}</strong> 条${weekTopSuggested > 0 ? ' · 软目标 ' + weekTopSuggested + ' 条' : ''}</span>
        ${weekTopSuggested > 0 ? `
        <div class="theme-progress-bar">
          <div class="theme-progress-fill" style="width:${Math.min(100, (weekTopPosted / weekTopSuggested) * 100)}%"></div>
        </div>
        <span class="muted">${weekTopPosted >= weekTopSuggested ? '✅ 主题达成' : '还差 ' + (weekTopSuggested - weekTopPosted) + ' 条到主题建议'}</span>
        ` : ''}
      </div>
      <div class="week-stats">
        <span class="ws ws-posted">✓ ${weekData.posted} 已发</span>
        <span class="ws ws-skipped">— ${weekData.skipped} 跳</span>
        <span class="ws ws-pending">○ ${weekData.pending} 待发</span>
        <span class="ws ws-total">· ${weekData.total} 总排</span>
      </div>
      ${Object.keys(weekData.byType).length > 0 ? `
      <div class="week-types">
        <span class="muted">类型：</span>
        ${Object.entries(weekData.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) =>
          `<span class="type-tag" style="${typeStyle(colors, t)}">${t} ${n}</span>`
        ).join(' ')}
      </div>
      ` : ''}
      ${Object.keys(weekData.bySlot).length > 0 ? `
      <div class="week-slots">
        <span class="muted">时段：</span>
        ${['morning', 'noon', 'evening', 'night'].map(sid => {
          const n = weekData.bySlot[sid] || 0
          const labelMap: Record<string, string> = { morning: '早 8', noon: '午 12:30', evening: '晚 20', night: '夜 22:30' }
          return n > 0 ? `<span class="slot-tag">${labelMap[sid]} ${n}</span>` : ''
        }).join(' ')}
      </div>
      ` : ''}
      <div id="weeklySummaryText" class="weekly-summary-text" style="display:none"></div>
    </section>

    <section class="card dim-coverage-card">
      <div class="card-head">
        <h2>🎯 本周 7 维度覆盖</h2>
        ${lowDims.length > 0 && lowDims[0] ? `<span class="muted">建议多发：<strong>${lowDims.map(d => `<span class="dim-low">${d}</span>`).join('、')}</strong></span>` : '<span class="muted">本周 7 维度全覆盖 ✓</span>'}
      </div>
      <p class="muted" style="font-size:12px;margin-bottom:12px;">人设 7 维度由 post_type 反查：身份=干货+客户 / 原生=生活+互动 / 专业=干货+客户+软广 / 关系=互动+软广 / 思想=干货+复盘 / 链接=互动+软广 / 生活=生活+休息</p>
      <div class="dim-grid">
        ${Object.entries(DIMENSION_TYPE_MAP).map(([dim, types]) => {
          const n = dimCounts[dim] || 0
          const pct = Math.round((n / dimMax) * 100)
          const isLow = lowDims.includes(dim) && n === 0
          const tip = types.map(t => colors[t]?.bg ? `<span class="dim-tip-type" style="background:${colors[t].bg};color:${colors[t].fg}">${t}</span>` : t).join('')
          return `
          <div class="dim-cell ${isLow ? 'low' : ''}">
            <div class="dim-head">
              <span class="dim-name">${escapeHtml(dim)}</span>
              <span class="dim-num">${n}</span>
            </div>
            <div class="dim-bar"><div class="dim-bar-fill" style="width:${pct}%"></div></div>
            <div class="dim-types">${tip}</div>
          </div>`
        }).join('')}
      </div>
    </section>

    ${themeMonth ? `
    <section class="card theme-month-card">
      <h2>🎯 ${todayStr.slice(0, 7)} 主题：${escapeHtml(themeMonth.custom_label || themeMonth.theme)}</h2>
      <p class="muted">本月按这个主题占比生成排期。修改：<a href="/my/theme">/my/theme</a></p>
    </section>
    ` : ''}

    ${renderMonthStrip(monthSchedule, todayStr, colors, todayStr.slice(0, 7))}

    <section class="card">
      <h2>👋 我的自我介绍（5 版本）</h2>
      <div class="intros">
        ${renderIntroSlot("short3", "3 句话版（~60 字）", introsMap.short3)}
        ${renderIntroSlot("50", "50 字精简版", introsMap["50"])}
        ${renderIntroSlot("1min", "1 分钟口播版", introsMap["1min"])}
        ${renderIntroSlot("200", "200 字详细介绍", introsMap["200"])}
        ${renderIntroSlot("addwechat", "加微专版", introsMap.addwechat)}
      </div>
      <p class="muted">还没填？ <a href="/my/intros" class="btn-link">去填写 →</a></p>
    </section>

    <section class="card">
      <h2>👥 客户案例（${casesList.length}）</h2>
      ${casesList.length === 0
        ? '<p class="muted">还没有案例。 <a href="/my/cases" class="btn-link">去添加 →</a></p>'
        : casesList.map((c, i) => `
        <details class="case" ${i === 0 ? "open" : ""}>
          <summary>${i + 1}. ${escapeHtml(c.name || '(未命名)')} <span class="muted">— ${escapeHtml(c.persona || '谁')}</span></summary>
          <div class="case-body">
            <p><strong>痛点：</strong>${escapeHtml(c.pain || '-')}</p>
            <p><strong>做了：</strong>${escapeHtml(c.action || '-')}</p>
            <p><strong>结果：</strong>${escapeHtml(c.result || '-')}</p>
            ${c.testimonial ? `<blockquote>${escapeHtml(c.testimonial)}</blockquote>` : ''}
          </div>
        </details>
      `).join("")}
    </section>

    <section class="card">
      <h2>💎 金句库（${quotesList.length}）</h2>
      ${quotesList.length === 0
        ? '<p class="muted">还没金句。 <a href="/my/quotes" class="btn-link">去添加 →</a></p>'
        : `<ul class="quotes">${quotesList.map(q => `<li>${escapeHtml(q.text)} ${q.category ? `<span class="cat">${escapeHtml(q.category)}</span>` : ''}</li>`).join('')}</ul>`}
    </section>

    <section class="card">
      <h2>✍️ 公式填空模板（${formulasList.length}）</h2>
      ${formulasList.length === 0
        ? '<p class="muted">还没填公式。 <a href="/my/formulas" class="btn-link">去填公式 →</a></p>'
        : formulasList.map(f => `
        <details class="formula">
          <summary>${escapeHtml(TEMPLATE_NAMES[f.formula_id] || f.formula_id)} · 第 ${f.variant_index} 变体</summary>
          <pre>${escapeHtml(f.filled_text)}</pre>
        </details>
      `).join("")}
    </section>

    <section class="card public">
      <h2>🌍 公共公式速查</h2>
      <p class="muted">这些公式是公共的（所有用户共享），AI 帮写会参考它们 + 你的素材</p>
      <ul class="formulas-public">
        <li><strong>反认知 + 痛点 + 行动</strong>：[你以为的 X] = [实际是 Y] → [痛点场景] → [所以应该先做 Z]</li>
        <li><strong>痛点具象化</strong>：用 3 个具体场景让读者"对号入座"</li>
        <li><strong>立边界 5 句式</strong>：不打折 / 不陪聊 / 不解释 / 不接急单 / 不接无理要求</li>
        <li><strong>故事万能</strong>：背景 + 冲突 + 转折 + 结果 + 反思</li>
        <li><strong>客户证言</strong>：谁 + 痛点 + 做了什么 + 结果 + 原话</li>
      </ul>
    </section>
  </main>
  <script>
    // D29: per-slot AI 帮写
    document.querySelectorAll('.btn-ai-slot').forEach(btn => {
      btn.onclick = async () => {
        const slot = btn.dataset.slot
        const todayType = btn.dataset.type
        const addon = btn.dataset.addon || ''
        const status = document.getElementById('aiStatus_' + slot)
        const draftsBox = document.getElementById('aiDrafts_' + slot)
        btn.disabled = true
        const origText = btn.textContent
        btn.textContent = '⏳ 生成中...'
        if (status) status.textContent = '调用中'
        if (draftsBox) draftsBox.style.display = 'none'

        try {
          const resp = await fetch('/api/ai/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ todayType, addon, slot }),
          })
          const data = await resp.json()
          if (!data.ok || !data.drafts || data.drafts.length === 0) {
            throw new Error(data.error || '生成失败：返回为空')
          }
          if (status) status.textContent = '✓ ' + data.drafts.length + ' 条候选已生成'
          renderDrafts(slot, data.drafts, data.draft_id)
        } catch (err) {
          if (status) status.textContent = '✗ 出错：' + err.message
          if (draftsBox) {
            draftsBox.innerHTML = '<p style="color:#c53030;background:#fed7d7;padding:10px;border-radius:6px;">生成失败：' + err.message + '</p>'
            draftsBox.style.display = 'block'
          }
        } finally {
          btn.disabled = false
          btn.textContent = origText === '🤖 AI 帮我写 3 条候选' ? '🤖 再来 3 条' : origText
        }
      }
    })

    function renderDrafts(slot, drafts, draftId) {
      const aiDrafts = document.getElementById('aiDrafts_' + slot)
      if (!aiDrafts) return
      aiDrafts.innerHTML = drafts.map((d, i) => {
        const esc = d.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return '<div class="draft-card">' +
          '<div class="draft-head">' +
          '<span class="draft-num">候选 ' + (i + 1) + '</span>' +
          '<span class="draft-len">' + d.length + ' 字</span>' +
          '</div>' +
          '<pre class="draft-text" id="draftText_' + slot + '_' + i + '">' + esc + '</pre>' +
          '<div class="draft-actions">' +
          '<button type="button" class="btn-copy" data-target="draftText_' + slot + '_' + i + '">📋 复制</button>' +
          '<button type="button" class="btn-mark" data-idx="' + (i + 1) + '" data-slot="' + slot + '">✓ 用这条 + 标记已发</button>' +
          '</div>' +
          '</div>'
      }).join('')
      aiDrafts.style.display = 'block'

      // 绑定复制按钮
      aiDrafts.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', async () => {
          const targetId = btn.dataset.target
          const text = document.getElementById(targetId)?.textContent || ''
          try {
            await navigator.clipboard.writeText(text)
            const orig = btn.textContent
            btn.textContent = '✓ 已复制'
            btn.style.background = '#48bb78'
            btn.style.color = '#fff'
            setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = '' }, 1500)
          } catch (e) {
            const range = document.createRange()
            range.selectNodeContents(document.getElementById(targetId))
            const sel = window.getSelection()
            sel.removeAllRanges()
            sel.addRange(range)
            alert('已选中文字，Ctrl+C 复制')
          }
        })
      })

      // 绑定"标记已发"按钮（带 draft_id + chosen_index + slot）
      aiDrafts.querySelectorAll('.btn-mark').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.idx)
          const slot = btn.dataset.slot
          try {
            const resp = await fetch('/api/today/addon', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'posted', draft_id: draftId, chosen_index: idx, slot }),
            })
            const data = await resp.json().catch(() => ({}))
            if (resp.ok) {
              alert('✓ 已标记本时段为已发，文案已存到历史（/history）')
              location.reload()
            } else {
              alert('标记失败：' + (data.error || resp.status))
            }
          } catch (e) {
            alert('网络错误：' + e.message)
          }
        })
      })
    }

    // 全局复制按钮（已发 mini 卡片里）
    document.querySelectorAll('.btn-copy').forEach(btn => {
      if (btn.dataset.bound) return
      btn.dataset.bound = '1'
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.target
        const text = document.getElementById(targetId)?.textContent || ''
        try {
          await navigator.clipboard.writeText(text)
          const orig = btn.textContent
          btn.textContent = '✓ 已复制'
          btn.style.background = '#48bb78'
          btn.style.color = '#fff'
          setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = '' }, 1500)
        } catch (e) {
          const range = document.createRange()
          range.selectNodeContents(document.getElementById(targetId))
          const sel = window.getSelection()
          sel.removeAllRanges()
          sel.addRange(range)
          alert('已选中文字，Ctrl+C 复制')
        }
      })
    })

    // 绑定"一键 seed 30 天"按钮（D34 DEBUG: 完全简化）
    const seedBtn = document.getElementById('seedBtn')
    if (seedBtn) {
      seedBtn.onclick = () => {
        if (!confirm('从今天起生成 30 天排期？')) return
        seedBtn.textContent = '生成中...'
        seedBtn.disabled = true
        fetch('/api/schedule/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 30, overwrite: false }) })
          .then(r => r.json()).then(data => {
            if (data.inserted || data.updated) location.reload()
            else { seedBtn.textContent = '完成'; seedBtn.disabled = false }
          }).catch(() => { seedBtn.textContent = '重试'; seedBtn.disabled = false })
      }
    }

    // D41: "重新排今天" 按钮 — overwrite=true 仅 1 天，posted 不动
    const reseedBtn = document.getElementById('reseedTodayBtn')
    if (reseedBtn) {
      reseedBtn.onclick = () => {
        if (!confirm('按当前主题月/周主题/周内比重重新排今天 4 段？\\n\\n已发（✓）的不动，仅改 待发/跳过的。')) return
        const status = document.getElementById('reseedTodayStatus')
        const origText = reseedBtn.textContent
        reseedBtn.textContent = '⏳ 重排中...'
        reseedBtn.disabled = true
        if (status) status.textContent = '调用中'
        const today = new Date()
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
        fetch('/api/schedule/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: todayStr, days: 1, overwrite: true }),
        })
          .then(r => r.json())
          .then(data => {
            const updated = data.updated || 0
            const skipped = data.skipped || 0
            if (status) status.textContent = '✅ 已重排（' + updated + ' 段更新 · ' + skipped + ' 段跳过：已发保留）'
            reseedBtn.textContent = '✓ 已重排'
            setTimeout(() => location.reload(), 600)
          })
          .catch(err => {
            if (status) status.textContent = '✗ 出错：' + err.message
            reseedBtn.textContent = origText
            reseedBtn.disabled = false
          })
      }
    }

    // D46: 候选加量按钮（✅ / 🔄 / ✕）— 每段 1 个候选 sub-card
    const HOOK_FIRST_LINE = ${JSON.stringify(
      Object.fromEntries(
        Object.entries(HOOK_HINTS).map(([k, v]) => [k, (v || '').split('\n').find(l => l.trim()) || ''])
      )
    )}
    const TYPE_COLORS = ${JSON.stringify(colors)}
    function typeBadgeStyle(t) {
      const c = TYPE_COLORS[t] || { bg: '#e2e8f0', fg: '#1a202c' }
      return 'background:' + c.bg + ';color:' + c.fg + ';'
    }
    function recalcTotal() {
      const addons = document.querySelectorAll('.addon-row').length
      const total = ${enabledSlots.length} + addons
      const a = document.getElementById('addonTotalCount')
      const t = document.getElementById('totalPostCount')
      if (a) a.textContent = String(addons)
      if (t) t.textContent = String(total)
    }
    document.querySelectorAll('.candidate-card').forEach(card => {
      const slot = card.getAttribute('data-slot')
      const fixed = card.getAttribute('data-fixed')
      let topN = []
      try { topN = JSON.parse(card.getAttribute('data-topn') || '[]') } catch(e) {}
      const pool = topN.filter(x => x.type !== fixed)
      let curIdx = 0
      const badge = card.querySelector('[data-cand-type]')
      const weightEl = card.querySelector('[data-cand-weight]')
      const hookEl = card.querySelector('[data-cand-hook]')
      const swapBtn = card.querySelector('.btn-cand-swap')
      const acceptBtn = card.querySelector('.btn-cand-accept')
      const skipBtn = card.querySelector('.btn-cand-skip')
      function render() {
        if (pool.length === 0) { card.style.display = 'none'; return }
        const cur = pool[curIdx]
        if (badge) { badge.textContent = cur.type; badge.setAttribute('style', typeBadgeStyle(cur.type)) }
        if (weightEl) weightEl.textContent = cur.weight + '%'
        if (hookEl) hookEl.textContent = HOOK_FIRST_LINE[cur.type] || ''
      }
      if (swapBtn) swapBtn.onclick = () => { curIdx = (curIdx + 1) % pool.length; render() }
      if (acceptBtn) acceptBtn.onclick = () => {
        const cur = pool[curIdx]
        if (!cur) return
        acceptBtn.disabled = true
        acceptBtn.textContent = '⏳ 落库...'
        fetch('/api/today/addon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'accept_candidate', slot: slot, candidate_type: cur.type }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              const parent = card.parentElement
              let list = parent.querySelector('.addon-list')
              if (!list) {
                list = document.createElement('div')
                list.className = 'addon-list'
                parent.insertBefore(list, card)
              }
              const row = document.createElement('div')
              row.className = 'addon-row'
              row.innerHTML = '<span class="addon-badge" style="' + typeBadgeStyle(cur.type) + '">➕ 加量 1 · ' + cur.type + '</span><span class="status status-pending">○ 待发</span>'
              list.appendChild(row)
              card.style.display = 'none'
              recalcTotal()
            } else {
              acceptBtn.disabled = false
              acceptBtn.textContent = '✅ 用这条'
              alert('落库失败：' + (data.error || '未知错误'))
            }
          })
          .catch(err => {
            acceptBtn.disabled = false
            acceptBtn.textContent = '✅ 用这条'
            alert('出错：' + err.message)
          })
      }
      if (skipBtn) skipBtn.onclick = () => { card.style.display = 'none' }
    })
    recalcTotal()
  </script>
</body>
</html>`
}

function renderIntroSlot(slot: string, label: string, content: string | undefined): string {
  if (!content) {
    return `<div class="intro empty"><span class="intro-label">${escapeHtml(label)}</span><span class="muted">未填</span></div>`
  }
  return `<details class="intro"><summary><span class="intro-label">${escapeHtml(label)}</span></summary><div class="intro-body">${escapeHtml(content)}</div></details>`
}

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #f7fafc;
  color: #1a202c;
  line-height: 1.6;
  padding-bottom: 60px;
}
.topbar {
  position: sticky; top: 0; z-index: 10;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid #e2e8f0;
}
.topbar-inner {
  max-width: 760px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
}
.brand { font-weight: 700; font-size: 16px; text-decoration: none; color: #1a202c; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.user-name { color: #4a5568; }
.badge { display: inline-block; padding: 1px 6px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 11px; font-weight: 600; }
.logout-btn {
  padding: 4px 10px; background: #fff; color: #c53030;
  border: 1px solid #fc8181; border-radius: 16px; text-decoration: none; font-size: 12px;
}
.logout-btn:hover { background: #fff5f5; }
.subnav {
  max-width: 760px; margin: 0 auto;
  display: flex; gap: 8px; flex-wrap: wrap;
  padding: 12px 20px 0;
}
.subnav a {
  padding: 6px 12px; background: #fff; border: 1px solid #e2e8f0;
  border-radius: 16px; text-decoration: none; color: #4a5568; font-size: 13px;
}
.subnav a.active, .subnav a:hover { background: var(--t); color: #fff; border-color: var(--t); }
main { max-width: 760px; margin: 0 auto; padding: 20px; }
.date-banner {
  background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%);
  color: #fff; padding: 24px; border-radius: 16px;
  display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(var(--ts-rgb), 0.3);
}
.date-banner .date { font-size: 28px; font-weight: 700; }
.date-banner .weekday { font-size: 16px; opacity: 0.9; }
.card {
  background: #fff; border-radius: 12px; padding: 20px 24px;
  margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border: 1px solid #e2e8f0;
}
.card h2 { font-size: 18px; margin-bottom: 14px; color: #2d3748; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.status { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.status-pending { background: #fef3c7; color: #92400e; }
.status-posted { background: #c6f6d5; color: #22543d; }
.status-skipped { background: #e2e8f0; color: #4a5568; }
.type-badge {
  display: inline-block; padding: 6px 16px; border-radius: 20px;
  font-weight: 700; font-size: 16px; margin: 8px 0;
}
.type-干货 { background: #ebf4ff; color: #2c5282; }
.type-生活 { background: #fef5e7; color: #c05621; }
.type-客户 { background: #e6fffa; color: #234e52; }
.type-互动 { background: #faf5ff; color: #553c9a; }
.type-软广 { background: #fff5f5; color: #c53030; }
.type-复盘 { background: #f0fff4; color: #22543d; }
.type-休息 { background: #edf2f7; color: #4a5568; }
.type-tip { color: #4a5568; font-size: 14px; margin: 4px 0 12px; white-space: pre-line; line-height: 1.65; }
.type-tip::first-line { font-weight: 600; color: #2d3748; }
.template { color: #4a5568; font-size: 14px; margin-bottom: 12px; }
.template code { background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.note-box {
  background: #fefcbf; border-left: 3px solid #ecc94b;
  padding: 8px 12px; border-radius: 4px; margin: 12px 0;
  color: #744210; font-size: 14px;
}
.addon-list { margin: 8px 0; display: flex; flex-direction: column; gap: 6px; }
.addon-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f0fff4; border-left: 3px solid #48bb78; border-radius: 4px; }
.addon-badge { padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; }
.candidate-card { margin: 10px 0 12px; padding: 10px 12px; background: #f7fafc; border: 1px dashed #cbd5e0; border-radius: 6px; }
.candidate-head { font-size: 12px; color: #718096; margin-bottom: 6px; font-weight: 600; }
.candidate-body { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.candidate-type-badge { padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; }
.candidate-weight { font-size: 12px; color: #4a5568; font-weight: 600; }
.candidate-hook { font-size: 12px; flex: 1; min-width: 200px; }
.candidate-actions { display: flex; gap: 6px; }
.btn-cand-accept, .btn-cand-skip, .btn-cand-swap { padding: 5px 12px; font-size: 13px; border: 0; border-radius: 4px; cursor: pointer; }
.btn-cand-accept { background: #48bb78; color: white; }
.btn-cand-skip { background: #e2e8f0; color: #4a5568; }
.btn-cand-swap { background: #edf2f7; color: #2d3748; }
.btn-cand-accept:hover { background: #38a169; }
.btn-cand-skip:hover { background: #cbd5e0; }
}
.month-strip-card .month-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; font-size: 12px; }
.month-strip-card .ms { padding: 2px 8px; border-radius: 4px; background: #f7fafc; }
.month-strip-card .ms-posted { background: #c6f6d5; color: #22543d; }
.month-strip-card .ms-pending { background: #fefcbf; color: #744210; }
.month-strip-card .ms-skipped { background: #e2e8f0; color: #4a5568; }
.month-strip-card .ms-none { background: #fff; color: #a0aec0; border: 1px dashed #cbd5e0; }
.month-strip-card .day-grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
}
.month-strip-card .day-weekday {
  text-align: center; font-size: 11px; color: #a0aec0; padding: 4px 0; font-weight: 600;
}
.month-strip-card .day-cell {
  aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 6px; font-size: 13px; position: relative; border: 1px solid transparent;
  background: #fff; color: #4a5568;
}
.month-strip-card .day-cell.empty { background: transparent; border: none; }
.month-strip-card .day-cell.none { background: #fff; color: #cbd5e0; border: 1px dashed #edf2f7; }
.month-strip-card .day-cell.past { opacity: 0.5; }
.month-strip-card .day-cell.today { border: 2px solid var(--t); box-shadow: 0 0 0 3px rgba(102,126,234,0.15); font-weight: 700; }
.month-strip-card .day-num { line-height: 1; }
.month-strip-card .day-mark { font-size: 9px; line-height: 1; margin-top: 1px; }
.month-strip-card .day-mark.skip { opacity: 0.5; }
.month-strip-card .month-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0; }
.month-strip-card .btn-seed { padding: 8px 14px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.month-strip-card .btn-seed:hover { opacity: 0.92; }
.month-strip-card .btn-seed:disabled { opacity: 0.6; cursor: not-allowed; }
@media (max-width: 640px) { .month-strip-card .day-cell { font-size: 11px; } .month-strip-card .day-mark { font-size: 8px; } }
.week-summary-card .week-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; font-size: 12px; }
.week-summary-card .theme-week-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; margin-bottom: 10px; font-size: 13px; }
.week-summary-card .theme-week-badge { padding: 3px 10px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border-radius: 4px; font-weight: 600; }
.week-summary-card .theme-phase-badge { padding: 3px 10px; border-radius: 4px; font-weight: 600; }
.week-summary-card .theme-phase-badge.phase-1 { background: #e6fffa; color: #234e52; }
.week-summary-card .theme-phase-badge.phase-2 { background: #fef5e7; color: #744210; }
.week-summary-card .theme-phase-badge.phase-3 { background: #ebf8ff; color: #2a4365; }
.week-summary-card .theme-progress-row { display: flex; flex-direction: column; gap: 4px; padding: 8px 0 10px; border-bottom: 1px dashed #e2e8f0; margin-bottom: 10px; font-size: 12px; }
.week-summary-card .theme-progress-bar { height: 8px; background: #edf2f7; border-radius: 4px; overflow: hidden; }
.week-summary-card .theme-progress-fill { height: 100%; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); transition: width 0.3s; }
.week-summary-card .ws { padding: 3px 8px; border-radius: 4px; }
.week-summary-card .ws-posted { background: #c6f6d5; color: #22543d; }
.week-summary-card .ws-skipped { background: #e2e8f0; color: #4a5568; }
.week-summary-card .ws-pending { background: #fefcbf; color: #744210; }
.week-summary-card .ws-total { background: #edf2f7; color: #2d3748; }
.week-summary-card .week-types, .week-summary-card .week-slots { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; margin: 6px 0; }
.week-summary-card .type-tag { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.week-summary-card .slot-tag { padding: 2px 8px; background: #edf2f7; border-radius: 4px; font-size: 11px; color: #2d3748; }
.week-summary-card .weekly-summary-text { margin-top: 10px; padding: 10px; background: #f7fafc; border-radius: 6px; }
.week-summary-card .weekly-summary-text pre { font-family: inherit; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }

/* D40: 7 维度覆盖卡片 */
.dim-coverage-card { background: linear-gradient(135deg, rgba(102,126,234,0.03) 0%, rgba(118,75,162,0.01) 100%); border-color: rgba(102,126,234,0.2); }
.dim-coverage-card .card-head { flex-wrap: wrap; gap: 8px; }
.dim-coverage-card .dim-low { padding: 1px 8px; background: #fed7d7; color: #c53030; border-radius: 10px; font-size: 12px; font-weight: 600; }
.dim-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.dim-cell { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; transition: all 0.2s; }
.dim-cell.low { border-color: #fc8181; background: #fff5f5; }
.dim-cell:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.dim-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.dim-name { font-size: 14px; font-weight: 600; color: #2d3748; }
.dim-num { font-size: 18px; font-weight: 700; color: var(--t); }
.dim-cell.low .dim-num { color: #c53030; }
.dim-bar { height: 6px; background: #edf2f7; border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
.dim-bar-fill { height: 100%; background: linear-gradient(90deg, var(--ts) 0%, var(--te) 100%); transition: width 0.3s; }
.dim-cell.low .dim-bar-fill { background: linear-gradient(90deg, #fc8181 0%, #f56565 100%); }
.dim-types { display: flex; flex-wrap: wrap; gap: 3px; }
.dim-tip-type { font-size: 10px; padding: 1px 5px; border-radius: 3px; opacity: 0.85; }
@media (max-width: 640px) { .dim-grid { grid-template-columns: repeat(2, 1fr); } }
.theme-month-card h2 { color: #553c9a; }
.theme-month-card a { color: var(--t); }
.reseed-today-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; padding: 8px 12px; background: linear-gradient(135deg, rgba(102,126,234,0.06) 0%, rgba(118,75,162,0.02) 100%); border: 1px dashed rgba(102,126,234,0.3); border-radius: 8px; }
.btn-reseed-today { padding: 6px 14px; background: #fff; color: var(--t); border: 1px solid var(--t); border-radius: 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-reseed-today:hover { background: var(--t); color: #fff; }
.btn-reseed-today:disabled { opacity: 0.6; cursor: not-allowed; }
.reseed-hint { font-size: 11px; }
/* D42-E: 明日建议卡片 */
.day-suggestion-card { background: linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.08) 100%); border-color: rgba(102,126,234,0.25); }
.ds-theme-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; font-size: 13px; }
.ds-phase { font-size: 12px; }
.ds-day-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 12px; background: #fff; border: 1px dashed rgba(102,126,234,0.3); border-radius: 8px; font-size: 13px; }
.ds-day-top-type { padding: 3px 14px; border-radius: 16px; font-weight: 700; font-size: 14px; }
.ds-slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.ds-slot { padding: 10px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
.ds-slot-time { font-size: 12px; color: #718096; font-weight: 600; margin-bottom: 6px; }
.ds-slot-type { display: inline-block; padding: 4px 12px; border-radius: 14px; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
.ds-weight { font-size: 11px; font-weight: 500; opacity: 0.85; margin-left: 4px; }
.ds-slot-alt { font-size: 11px; color: #718096; margin-bottom: 6px; }
.ds-alt-type { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 11px; margin: 0 2px; }
.ds-slot-hint { font-size: 11px; color: #4a5568; line-height: 1.5; margin-bottom: 6px; padding: 4px 0; border-top: 1px dashed #edf2f7; }
.ds-slot-dims { display: flex; gap: 4px; flex-wrap: wrap; }
.ds-dim { font-size: 10px; padding: 1px 6px; background: #edf2f7; color: #4a5568; border-radius: 8px; }
@media (max-width: 640px) { .ds-slots { grid-template-columns: 1fr; } }
.addon-form { margin-top: 12px; }
.addon-form label { display: block; font-size: 13px; color: #4a5568; margin-bottom: 6px; font-weight: 500; }
.addon-form textarea {
  width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0;
  border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical;
}
.addon-form textarea:focus { outline: none; border-color: var(--t); box-shadow: 0 0 0 3px rgba(var(--ts-rgb), 0.1); }
.form-actions { display: flex; gap: 8px; margin-top: 10px; }
.btn-primary, .btn-success {
  padding: 8px 16px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-primary { background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; }
.btn-primary:hover { opacity: 0.92; }
.btn-success { background: #48bb78; color: #fff; }
.btn-success:hover { background: #38a169; }
.intros { display: flex; flex-direction: column; gap: 8px; }
.intro {
  border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;
}
.intro.empty { background: #f7fafc; }
.intro-label { font-weight: 500; color: #2d3748; }
.intro-body { margin-top: 8px; color: #4a5568; font-size: 14px; white-space: pre-wrap; }
.case { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
.case summary { cursor: pointer; font-weight: 500; }
.case-body { margin-top: 8px; font-size: 14px; color: #4a5568; }
.case-body p { margin-bottom: 4px; }
.case-body blockquote { border-left: 3px solid #cbd5e0; padding-left: 12px; margin: 8px 0; color: #2d3748; font-style: italic; }
.quotes { list-style: none; padding: 0; }
.quotes li { padding: 6px 0; border-bottom: 1px dashed #edf2f7; font-size: 14px; }
.quotes li:last-child { border-bottom: none; }
.cat { display: inline-block; padding: 1px 6px; background: #edf2f7; color: #4a5568; border-radius: 4px; font-size: 11px; margin-left: 6px; }
.formula { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
.formula summary { cursor: pointer; font-weight: 500; }
.formula pre { white-space: pre-wrap; font-size: 13px; color: #4a5568; margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 4px; }
.public { background: #fefcbf1a; border-color: #f6e05e; }
.formulas-public { padding-left: 20px; }
.formulas-public li { margin-bottom: 6px; font-size: 14px; color: #4a5568; }
.formulas-public strong { color: #2d3748; }
.muted { color: #a0aec0; font-size: 13px; }
.admin-only { margin-top: 12px; }

/* AI 帮写区块 */
.ai-card { background: linear-gradient(135deg, rgba(var(--ts-rgb), 0.04) 0%, rgba(var(--ts-rgb), 0.01) 100%); border-color: var(--t); }
.ai-tag { padding: 2px 8px; background: var(--t); color: #fff; border-radius: 4px; font-size: 12px; font-weight: 600; }
.ai-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.btn-ai {
  padding: 10px 20px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%);
  color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
  box-shadow: 0 2px 8px rgba(var(--ts-rgb), 0.3);
}
.btn-ai:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--ts-rgb), 0.4); }
.btn-ai:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.ai-drafts { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.draft-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.draft-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.draft-num { padding: 2px 8px; background: var(--t); color: #fff; border-radius: 4px; font-size: 12px; font-weight: 600; }
.draft-len { color: #a0aec0; font-size: 12px; }
.draft-text { font-family: inherit; font-size: 14px; color: #2d3748; line-height: 1.6; white-space: pre-wrap; word-break: break-word; background: #f7fafc; padding: 10px 12px; border-radius: 6px; margin-bottom: 10px; max-height: 200px; overflow-y: auto; }
.draft-actions { display: flex; gap: 8px; }
.btn-copy { flex: 1; padding: 8px 12px; background: var(--t); color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-copy:hover { opacity: 0.92; }
.btn-mark { flex: 1; padding: 8px 12px; background: #48bb78; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-mark:hover { background: #38a169; }
@media (max-width: 640px) {
  .draft-text { max-height: 150px; }
  .draft-actions { flex-direction: column; }
}
.admin-only details { background: #f7fafc; padding: 8px 12px; border-radius: 6px; }
.admin-only code { background: #edf2f7; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
`
