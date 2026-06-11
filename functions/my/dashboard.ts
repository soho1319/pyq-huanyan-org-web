// ============================================
// /my/dashboard
// D38: 7 维度诊断 UI
// - 7 维度本月覆盖度（已发/总排/占比）
// - 7 列进度条
// - 智能推荐"本周多发哪个维度"（最低的 2 个）
// ============================================

import { getCurrentUser } from "../lib/auth"
import { loadUserTheme, themeCssVar } from "../lib/theme"
import { DIM_IDS, getMonthlyPhase, getWeeklyTheme, ymd, addDays, ymdInTZ, type Dim } from "../lib/schedule-constants"
import { startOfWeek } from "../lib/weekly"

const OLD_TYPE_TO_DIM_DASH: Record<string, Dim> = { '干货': 'F', '生活': 'E', '客户': 'B', '互动': 'G', '软广': 'C', '复盘': 'F', '休息': 'E' }

interface User { id: string; username: string; display_name: string | null }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database; SESSION_SECRET?: string }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = await getCurrentUser(ctx.request, ctx.env) as User | null
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const today = new Date()
  // D55-16: Workers 默认 UTC，强制用 CST 算 yearMonth（否则 0-8 点会算到上个月）
  const yearMonth = ymdInTZ(today, "Asia/Shanghai").slice(0, 7)
  const monthStart = yearMonth + '-01'
  const [y, m] = yearMonth.split('-').map(Number)
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`

  // 本月所有 schedule 行（D55: 加 dim 字段）
  const rows = await ctx.env.DB.prepare(
    "SELECT date, post_type, dim, status, slot FROM schedule WHERE user_id = ? AND date >= ? AND date < ?"
  ).bind(user.id, monthStart, nextMonth).all<{ date: string; post_type: string; dim: string | null; status: string; slot: string }>()

  // 7 维度统计（已发/总排，D55 直接按 dim 字段）
  const dimTotal: Record<string, number> = {}
  const dimPosted: Record<string, number> = {}
  for (const dim of DIM_IDS) {
    dimTotal[dim] = 0
    dimPosted[dim] = 0
  }
  for (const r of rows.results || []) {
    // D55: dim 优先 schedule.dim，缺则从 post_type 反查
    const dim = (r.dim as Dim) || OLD_TYPE_TO_DIM_DASH[r.post_type] || 'F'
    dimTotal[dim] = (dimTotal[dim] || 0) + 1
    if (r.status === 'posted') dimPosted[dim] = (dimPosted[dim] || 0) + 1
  }

  // 智能推荐：本月已发数最少的 2 个维度（"本周多发"建议）
  const sortedByPosted = Object.entries(dimPosted).sort((a, b) => a[1] - b[1])
  const recommendations = sortedByPosted.slice(0, 2).map(([dim, n]) => {
    return { dim: dim as Dim, posted: n, types: [] }  // D55: 7 维度无对应 post_type 概念
  })

  // D36 月阶段 + 周主题（D55-17: 传 user.cycle_start_date 闭环）
  const monthPhase = getMonthlyPhase(yearMonth, null, (user as any).cycle_start_date)
  // D55-16: 用 CST 算本周起始日
  const weekStartStr = ymdInTZ(startOfWeek(today), "Asia/Shanghai")
  const weekTheme = getWeeklyTheme(weekStartStr, null, (user as any).cycle_start_date)

  // 总览
  const totalRows = (rows.results || []).length
  const totalPosted = (rows.results || []).filter(r => r.status === 'posted').length

  const theme = await loadUserTheme(ctx.env, user.id)

  return new Response(renderPage(user, {
    yearMonth, dimTotal, dimPosted, recommendations, monthPhase, weekTheme,
    totalRows, totalPosted, theme,
  }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

interface PageData {
  yearMonth: string
  dimTotal: Record<string, number>
  dimPosted: Record<string, number>
  recommendations: Array<{ dim: string; posted: number; types: string[] }>
  monthPhase: { phase: number; label: string; cycleIndex: number }
  weekTheme: { theme: string; label: string; cycleIndex: number }
  totalRows: number
  totalPosted: number
  theme: { start: string; end: string; solid: string }
}

function renderPage(user: User, data: PageData): string {
  const { yearMonth, dimTotal, dimPosted, recommendations, monthPhase, weekTheme, totalRows, totalPosted, theme } = data
  // 7 维度顺序（按 课程文档 重要性）
  const dimOrder = ['身份', '原生', '生活', '专业', '关系', '思想', '链接']
  const maxTotal = Math.max(1, ...Object.values(dimTotal))

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>7 维度诊断 · pyq</title>
${themeCssVar(theme)}
<style>${styles}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/today" class="brand">朋友圈工作台</a>
      <div class="user">
        <span class="user-name">${escapeHtml(user.display_name || user.username)}</span>
        <a href="/logout" class="logout-btn">退出</a>
      </div>
    </div>
  </header>
  <nav class="subnav">
    <a href="/today">今日</a>
    <a href="/my/intros">自我介绍</a>
    <a href="/my/cases">客户案例</a>
    <a href="/my/quotes">金句库</a>
    <a href="/my/formulas">公式填空</a>
    <a href="/calendar">日历</a>
    <a href="/history">草稿历史</a>
    <a href="/my/types">颜色</a>
    <a href="/my/theme">主题月</a>
    <a href="/my/theme-week">主题周</a>
    <a href="/my/dashboard" class="active">维度诊断</a>
  </nav>
  <main>
    <h1>7 维度诊断（D38）</h1>
    <p class="muted">D36: 本月阶段 <strong>${escapeHtml(monthPhase.label)}</strong>（第 ${monthPhase.cycleIndex}/3 月） + 本周主题 <strong>${escapeHtml(weekTheme.label)}</strong>（第 ${weekTheme.cycleIndex + 1}/4 周） · ${yearMonth} 共 ${totalRows} 条 / 已发 ${totalPosted} 条</p>

    ${recommendations.length > 0 && recommendations[0].posted === 0 ? `
    <section class="card alert-card">
      <h2>🎯 本周建议多发</h2>
      <p class="muted">你本月 <strong>${escapeHtml(recommendations[0].dim)}</strong> / <strong>${escapeHtml(recommendations[1]?.dim || '')}</strong> 维度还是 0 条。"${escapeHtml(weekTheme.label)}" 主题下补一发：</p>
      <div class="rec-list">
        ${recommendations.map(r => `
          <div class="rec-item">
            <span class="rec-dim">${escapeHtml(r.dim)}</span>
            <span class="rec-types">→ ${r.types.map(t => `<code>${t}</code>`).join(' / ')}</code></span>
          </div>
        `).join('')}
      </div>
      <a href="/today" class="btn-primary">去今日页 →</a>
    </section>
    ` : ''}

    <section class="card">
      <h2>7 维度本月覆盖度</h2>
      <div class="dim-grid">
        ${dimOrder.map(dim => {
          const total = dimTotal[dim] || 0
          const posted = dimPosted[dim] || 0
          const pct = (total / maxTotal) * 100
          return `
            <div class="dim-cell">
              <div class="dim-label">${escapeHtml(dim)}</div>
              <div class="dim-bar"><div class="dim-fill" style="width:${pct}%"></div></div>
              <div class="dim-stats">
                <span class="dim-total">${total} 条</span>
                <span class="dim-posted">✓ ${posted}</span>
              </div>
            </div>
          `
        }).join('')}
      </div>
    </section>

    <section class="card">
      <h2>维度 ↔ post_type 映射</h2>
      <table class="dim-table">
        <thead><tr><th>维度</th><th>对应 post_type</th><th>含义</th></tr></thead>
        <tbody>
          <tr><td>身份</td><td>干货 / 客户</td><td>明确身份、塑造专家形象</td></tr>
          <tr><td>原生</td><td>生活 / 互动</td><td>展现原生魅力、自嘲/小爱好</td></tr>
          <tr><td>生活</td><td>生活 / 休息</td><td>真实质感、小确幸/至暗</td></tr>
          <tr><td>专业</td><td>干货 / 客户 / 软广</td><td>问题解决、效果对比、权威背书</td></tr>
          <tr><td>关系</td><td>互动 / 软广</td><td>经营人脉、社交六感、社群</td></tr>
          <tr><td>思想</td><td>干货 / 复盘</td><td>反认知、价值观、素理念</td></tr>
          <tr><td>链接</td><td>互动 / 软广</td><td>抛问题、求点赞、引导回应</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`
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
h1 { font-size: 24px; margin-bottom: 12px; color: #2d3748; }
.muted { color: #a0aec0; font-size: 13px; margin-bottom: 16px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.card h2 { font-size: 18px; color: #2d3748; margin-bottom: 12px; }
.alert-card { background: #fffaf0; border-color: #fbd38d; }
.alert-card h2 { color: #744210; }
.rec-list { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.rec-item { padding: 8px 12px; background: #fff; border-radius: 6px; display: flex; gap: 10px; align-items: center; }
.rec-dim { font-weight: 600; color: #553c9a; min-width: 60px; }
.rec-types { font-size: 12px; color: #4a5568; }
.rec-types code { background: #edf2f7; padding: 2px 6px; border-radius: 3px; margin: 0 2px; }
.btn-primary { display: inline-block; padding: 8px 18px; background: var(--t); color: #fff; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; }
.dim-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.dim-cell { padding: 10px 12px; background: #f7fafc; border-radius: 8px; }
.dim-label { font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 4px; }
.dim-bar { height: 10px; background: #edf2f7; border-radius: 5px; overflow: hidden; margin-bottom: 4px; }
.dim-fill { height: 100%; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); transition: width 0.3s; }
.dim-stats { display: flex; justify-content: space-between; font-size: 11px; }
.dim-total { color: #4a5568; }
.dim-posted { color: #22543d; font-weight: 600; }
.dim-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dim-table th, .dim-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
.dim-table th { background: #f7fafc; font-weight: 600; color: #2d3748; }
.dim-table td:first-child { font-weight: 600; color: #553c9a; }
`
