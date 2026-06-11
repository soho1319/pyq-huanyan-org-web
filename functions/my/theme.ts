// ============================================
// /my/theme
// D31: 主题月配置（4 预设主题 + 自定义）
// POST: 选/改/删某月主题
// ============================================

import { getCurrentUser } from "../lib/auth"
import { loadUserTheme, themeCssVar } from "../lib/theme"
import { POST_TYPES } from "../lib/schedule-constants"

interface User { id: string; username: string; display_name: string | null }

const PRESETS = {
  trust:    { "干货": 0.10, "生活": 0.10, "客户": 0.30, "互动": 0.20, "软广": 0.10, "复盘": 0.15, "休息": 0.05 },
  pro:      { "干货": 0.40, "生活": 0.10, "客户": 0.10, "互动": 0.10, "软广": 0.10, "复盘": 0.15, "休息": 0.05 },
  sale:     { "干货": 0.10, "生活": 0.10, "客户": 0.15, "互动": 0.10, "软广": 0.30, "复盘": 0.20, "休息": 0.05 },
  recovery: { "干货": 0.10, "生活": 0.30, "客户": 0.10, "互动": 0.10, "软广": 0.05, "复盘": 0.05, "休息": 0.30 },
} as const

const THEME_LABELS: Record<string, string> = {
  trust: "🤝 信任月（客户/互动 30%+）",
  pro: "🎓 专业月（干货 40%）",
  sale: "💰 销售月（软广/复盘 30%+）",
  recovery: "🌱 恢复月（生活/休息 30%）",
  custom: "⚙️ 自定义",
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database; SESSION_SECRET?: string }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = await getCurrentUser(ctx.request, ctx.env) as User | null
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  // 读所有主题月
  const rows = await ctx.env.DB.prepare(
    "SELECT * FROM theme_months WHERE user_id = ? ORDER BY year_month DESC"
  ).bind(user.id).all<{ id: string; year_month: string; theme: string; weights_json: string; custom_label: string | null; cycle_index: number; updated_at: number }>()
  const themes = (rows.results || []).map(r => ({
    year_month: r.year_month,
    theme: r.theme,
    label: r.custom_label || THEME_LABELS[r.theme] || r.theme,
    weights: JSON.parse(r.weights_json),
    cycle_index: r.cycle_index || 0,
  }))

  const theme = await loadUserTheme(ctx.env, user.id)
  const currentMonth = ymd(new Date()).slice(0, 7)

  return new Response(renderPage(user, themes, theme, currentMonth), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database; SESSION_SECRET?: string }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = await getCurrentUser(ctx.request, ctx.env) as User | null
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const form = await ctx.request.formData()
  const action = String(form.get("_action") || "")
  if (action === "delete") {
    const ym = String(form.get("year_month") || "")
    if (!/^\d{4}-\d{2}$/.test(ym)) return new Response("year_month 错", { status: 400 })
    await ctx.env.DB.prepare(
      "DELETE FROM theme_months WHERE user_id = ? AND year_month = ?"
    ).bind(user.id, ym).run()
    return Response.redirect(`/my/theme?saved=deleted`, 302)
  }
  return new Response("未知 action", { status: 400 })
}

function renderPage(user: User, themes: Array<{ year_month: string; theme: string; label: string; weights: Record<string, number>; cycle_index: number }>, theme: { start: string; end: string; solid: string }, currentMonth: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>主题月 · pyq</title>
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
  <nav class="subnav">
    <a href="/today">📅 今日</a>
    <a href="/my/intros">👋 自我介绍</a>
    <a href="/my/cases">👥 客户案例</a>
    <a href="/my/quotes">💎 金句库</a>
    <a href="/my/formulas">✍️ 公式填空</a>
    <a href="/calendar">🗓 日历</a>
    <a href="/history">📜 草稿历史</a>
    <a href="/my/types">🎨 颜色</a>
    <a href="/my/theme" class="active">🎯 主题月</a>
  </nav>
  <main>
    <h1>🎯 主题月（D36）</h1>
    <p class="muted">D36: 3 月循环（破冰 → 转化 → 复购）+ 4 个固定主题（trust/pro/sale/recovery）作为"用户锁定"覆盖。当前月：<strong>${currentMonth}</strong>。D36-7：<a href="/my/theme-week">周主题（4 周循环）</a> 已上线</p>

    ${themes.length > 0 ? `
    <section class="card">
      <h2>已设的主题月</h2>
      ${themes.map(t => `
        <div class="theme-card">
          <div class="theme-head">
            <span class="theme-month">${t.year_month}</span>
            <span class="theme-name">${escapeHtml(t.label)}</span>
            <form method="POST" action="/my/theme" style="margin:0">
              <input type="hidden" name="_action" value="delete">
              <input type="hidden" name="year_month" value="${t.year_month}">
              <button type="submit" class="btn-danger btn-sm">🗑 删</button>
            </form>
          </div>
          <div class="theme-bars">
            ${Object.entries(t.weights).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
              <div class="t-bar">
                <span class="t-label">${k}</span>
                <div class="t-track"><div class="t-fill" style="width:${v * 100}%"></div></div>
                <span class="t-num">${(v * 100).toFixed(0)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </section>
    ` : ''}

    <section class="card">
      <h2>➕ 设置 / 改某月主题</h2>
      <form method="POST" action="/api/theme-month">
        <div class="form-row">
          <label>月份：<input type="text" name="year_month" placeholder="YYYY-MM" value="${currentMonth}" required pattern="\\d{4}-\\d{2}"></label>
        </div>
        <div class="form-row">
          <label>主题：
            <select name="theme" id="themeSelect">
              ${Object.keys(PRESETS).map(t => `<option value="${t}">${THEME_LABELS[t]}</option>`).join('')}
              <option value="custom">⚙️ 自定义</option>
            </select>
          </label>
        </div>
        <div class="form-row">
          <label>自定义主题名（可选）：<input type="text" name="custom_label" maxlength="30" placeholder="如：618 大促月"></label>
        </div>

        <h3 style="margin-top:14px">7 类占比预览（提交时按所选主题）</h3>
        <div class="weight-preview" id="weightPreview">
          ${Object.entries(PRESETS.trust).map(([k, v]) => `
            <div class="t-bar"><span class="t-label">${k}</span><div class="t-track"><div class="t-fill" style="width:${v * 100}%"></div></div><span class="t-num">${(v * 100).toFixed(0)}%</span></div>
          `).join('')}
        </div>
        <p class="muted" id="weightNote">总占比 = 100%</p>

        <button type="submit" class="btn-primary">✓ 设置 / 更新</button>
      </form>
    </section>
  </main>
  <script>
    const PRESETS = ${JSON.stringify(PRESETS)}
    const select = document.getElementById('themeSelect')
    const preview = document.getElementById('weightPreview')
    const note = document.getElementById('weightNote')
    function renderWeights(weights) {
      const max = Math.max(...Object.values(weights))
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      preview.innerHTML = Object.entries(weights).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
        '<div class="t-bar"><span class="t-label">' + k + '</span><div class="t-track"><div class="t-fill" style="width:' + ((v/max)*100) + '%"></div></div><span class="t-num">' + (v * 100).toFixed(0) + '%</span></div>'
      ).join('')
      note.textContent = '总占比 = ' + (sum * 100).toFixed(0) + '%'
    }
    select.addEventListener('change', () => {
      const v = select.value
      if (v === 'custom') {
        // 留空让用户填 weights（暂未实现 UI）
        preview.innerHTML = '<p class="muted">选「自定义」请手动调占比（暂未实现 UI）</p>'
        note.textContent = '总占比 = 0%'
      } else {
        renderWeights(PRESETS[v])
      }
    })
  </script>
</body>
</html>`
}

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; line-height: 1.6; padding-bottom: 60px; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
.topbar-inner { max-width: 760px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.brand { font-weight: 700; font-size: 16px; text-decoration: none; color: #1a202c; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.user-name { color: #4a5568; }
.logout-btn { padding: 4px 10px; background: #fff; color: #c53030; border: 1px solid #fc8181; border-radius: 16px; text-decoration: none; font-size: 12px; }
main { max-width: 760px; margin: 0 auto; padding: 20px; }
.subnav { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.subnav a { padding: 6px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; text-decoration: none; color: #4a5568; font-size: 13px; }
.subnav a.active, .subnav a:hover { background: var(--t); color: #fff; border-color: var(--t); }
h1 { font-size: 24px; margin-bottom: 12px; color: #2d3748; }
.muted { color: #a0aec0; font-size: 13px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.card h2 { font-size: 18px; color: #2d3748; margin-bottom: 12px; }
.theme-card { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.theme-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.theme-month { background: var(--t); color: #fff; padding: 2px 10px; border-radius: 4px; font-weight: 600; font-size: 13px; }
.theme-name { flex: 1; font-weight: 600; }
.theme-bars { display: flex; flex-direction: column; gap: 4px; }
.t-bar { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.t-label { width: 60px; color: #4a5568; }
.t-track { flex: 1; height: 12px; background: #edf2f7; border-radius: 6px; overflow: hidden; }
.t-fill { height: 100%; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); transition: width 0.3s; }
.t-num { width: 36px; text-align: right; color: #2d3748; font-weight: 600; }
.form-row { margin-bottom: 10px; }
.form-row label { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.form-row input, .form-row select { padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; }
.weight-preview { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; padding: 10px; background: #f7fafc; border-radius: 6px; }
.btn-primary { padding: 8px 18px; background: var(--t); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-primary:hover { opacity: 0.9; }
.btn-danger { background: #fff; color: #c53030; border: 1px solid #fc8181; border-radius: 4px; cursor: pointer; }
.btn-danger:hover { background: #fff5f5; }
.btn-sm { padding: 3px 8px; font-size: 12px; }
@media (max-width: 640px) { .topbar-inner, main { padding: 12px 16px; } .card { padding: 14px; } }
`
