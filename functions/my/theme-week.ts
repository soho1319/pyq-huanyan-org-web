// ============================================
// /my/theme-week
// D36: 周主题 4 周循环（立人设/反认知/讲故事/立边界）
// - 顶部"4 周循环"指示器
// - 列出本周 + 未来 4 周主题
// - 锁定/解锁按钮
// ============================================

import { getCurrentUser } from "../lib/auth"
import { loadUserTheme, themeCssVar } from "../lib/theme"
import {
  WEEKLY_THEMES, getWeeklyTheme, addDays, ymd, WeeklyThemeId,
} from "../lib/schedule-constants"
import { startOfWeek } from "../lib/weekly"

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

  // 查所有锁定
  const rows = await ctx.env.DB.prepare(
    "SELECT week_start, theme, locked FROM weekly_themes WHERE user_id = ?"
  ).bind(user.id).all<{ week_start: string; theme: string; locked: number }>()
  const lockedMap: Record<string, string> = {}
  for (const r of rows.results || []) lockedMap[r.week_start] = r.theme

  const theme = await loadUserTheme(ctx.env, user.id)
  const thisWeekStart = startOfWeek(new Date())
  const thisWeekStr = ymd(thisWeekStart)
  const thisWeek = getWeeklyTheme(thisWeekStr, null)

  return new Response(renderPage(user, thisWeekStr, thisWeek, lockedMap, theme), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

function renderPage(
  user: User,
  thisWeekStr: string,
  thisWeek: { theme: WeeklyThemeId; label: string; cycleIndex: number; locked: boolean },
  lockedMap: Record<string, string>,
  theme: { start: string; end: string; solid: string }
): string {
  // 算未来 4 周
  const weekRows: Array<{ weekStart: string; theme: WeeklyThemeId; label: string; cycleIndex: number; locked: boolean; lockedTheme?: string }> = []
  let cur = new Date(thisWeekStr + 'T00:00:00')
  for (let i = 0; i < 4; i++) {
    const ws = ymd(cur)
    const locked = lockedMap[ws]
    const info = getWeeklyTheme(ws, locked ? { theme: locked as WeeklyThemeId } : null)
    weekRows.push({ weekStart: ws, ...info, lockedTheme: locked })
    cur = addDays(cur, 7)
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>周主题 · pyq</title>
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
    <a href="/my/theme" class="active">主题月</a>
    <a href="/my/theme-week">主题周</a>
  </nav>
  <main>
    <h1>主题周（D36）</h1>
    <p class="muted">4 周循环：立人设 → 反认知 → 讲故事 → 立边界。本周：<strong>${thisWeek.label}</strong>（第 ${thisWeek.cycleIndex + 1}/4 周）。锁定后单周不参与自动循环。</p>

    <section class="card">
      <h2>未来 4 周</h2>
      ${weekRows.map((r, i) => `
        <div class="week-row ${r.locked ? 'locked' : ''}">
          <span class="week-num">第 ${i + 1} 周</span>
          <span class="week-date">${r.weekStart} - ${ymd(addDays(new Date(r.weekStart + 'T00:00:00'), 6))}</span>
          <span class="week-theme theme-${r.theme}">${r.label}</span>
          <span class="week-cycle">第 ${r.cycleIndex + 1}/4 周</span>
          ${r.locked
            ? `<span class="week-locked">已锁定（${r.label}）</span>
               <form method="POST" action="/api/weekly-theme" style="display:inline">
                 <input type="hidden" name="week_start" value="${r.weekStart}">
                 <input type="hidden" name="_action" value="unlock">
               </form>
               <a href="?unlock=${r.weekStart}" class="btn-link" data-action="unlock">解锁</a>`
            : `<form method="POST" action="/api/weekly-theme" style="display:inline">
                 <input type="hidden" name="week_start" value="${r.weekStart}">
                 <select name="theme">
                   ${Object.entries(WEEKLY_THEMES).map(([id, w]) => `<option value="${id}">${w.label}</option>`).join('')}
                 </select>
                 <button type="submit" class="btn-primary btn-sm">锁定</button>
               </form>`}
        </div>
      `).join('')}
    </section>

    <section class="card">
      <h2>4 个周主题一览</h2>
      ${Object.entries(WEEKLY_THEMES).map(([id, w]) => `
        <div class="preset-row">
          <strong>${w.label}</strong>
          <div class="preset-bars">
            ${Object.entries(w.weights).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
              <div class="t-bar"><span class="t-label">${k}</span><div class="t-track"><div class="t-fill" style="width:${v * 100}%"></div></div><span class="t-num">${(v * 100).toFixed(0)}%</span></div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  </main>
  <script>
    // 解锁按钮 GET 触发 DELETE
    document.querySelectorAll('a[data-action="unlock"]').forEach(a => {
      a.addEventListener('click', async e => {
        e.preventDefault()
        if (!confirm('解锁本周并恢复自动循环？')) return
        const url = new URL(a.href)
        const weekStart = url.searchParams.get('unlock')
        await fetch('/api/weekly-theme?week_start=' + weekStart, { method: 'DELETE' })
        location.reload()
      })
    })
  </script>
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
.week-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; }
.week-row.locked { background: #fffaf0; }
.week-num { background: var(--t); color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 13px; }
.week-date { color: #4a5568; font-size: 13px; min-width: 200px; }
.week-theme { padding: 3px 10px; border-radius: 4px; background: #edf2f7; color: #2d3748; font-weight: 600; font-size: 13px; }
.week-cycle { color: #a0aec0; font-size: 12px; }
.week-locked { background: #fef5e7; color: #744210; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.week-row select { padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 13px; }
.btn-primary { padding: 4px 12px; background: var(--t); color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-sm { padding: 3px 10px; font-size: 12px; }
.btn-link { color: var(--t); text-decoration: none; font-size: 13px; }
.preset-row { background: #f7fafc; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.preset-row strong { display: block; margin-bottom: 6px; color: #2d3748; }
.preset-bars { display: flex; flex-direction: column; gap: 4px; }
.t-bar { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.t-label { width: 60px; color: #4a5568; }
.t-track { flex: 1; height: 12px; background: #edf2f7; border-radius: 6px; overflow: hidden; }
.t-fill { height: 100%; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); }
.t-num { width: 36px; text-align: right; color: #2d3748; font-weight: 600; }
`
