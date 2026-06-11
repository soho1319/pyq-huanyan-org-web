// ============================================
import { loadUserTheme, themeCssVar } from "../lib/theme"
// /my/intros
// 5 个 intros 槽位的编辑表单
//
// GET   渲染表单（5 个 textarea）
// POST  保存（调 PUT /api/materials/intros）
// ============================================

interface User { id: string; username: string; display_name: string | null; is_admin: number }

const SLOT_LABELS: Record<string, { label: string; hint: string }> = {
  short3:    { label: "3 句话版",     hint: "60 字以内 · 朋友圈签名 / 群介绍 / 被动加微" },
  "50":      { label: "50 字精简版",  hint: "50 字 · 群发开场 / 首次私聊" },
  "1min":    { label: "1 分钟口播版", hint: "200 字 · 视频号开场 / 直播 / 活动主持" },
  "200":     { label: "200 字详细介绍", hint: "200 字 · 公众号「关于我」/ 社群欢迎语" },
  addwechat: { label: "加微专版",     hint: "100 字 · 扫我加微时自动回复 / 群引流" },
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function renderPage(intros: Record<string, string>, user: User, theme: { start: string; end: string; solid: string }, msg?: { ok: boolean; text: string }): Response {
  const slots = Object.keys(SLOT_LABELS)
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>我的自我介绍 · pyq</title>
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
      <a href="/my/intros" class="active">👋 自我介绍</a>
      <a href="/my/cases">👥 客户案例</a>
      <a href="/my/quotes">💎 金句库</a>
      <a href="/my/formulas">✍️ 公式填空</a>
      <a href="/calendar">📅 日历</a>
    </nav>

    ${msg ? `<div class="flash ${msg.ok ? 'flash-ok' : 'flash-err'}">${escapeHtml(msg.text)}</div>` : ''}

    <h1>👋 我的自我介绍（5 版本）</h1>
    <p class="muted">每个场景用不同版本。一次填好，到处复用。</p>

    <form method="POST" action="/my/intros" class="form">
      ${slots.map(slot => `
        <div class="field">
          <label for="${slot}">${escapeHtml(SLOT_LABELS[slot].label)} <span class="hint">${escapeHtml(SLOT_LABELS[slot].hint)}</span></label>
          <textarea id="${slot}" name="${slot}" rows="3" placeholder="未填">${escapeHtml(intros[slot] || '')}</textarea>
          <div class="count" data-target="${slot}">${(intros[slot] || '').length} 字</div>
        </div>
      `).join('')}
      <div class="actions">
        <button type="submit" class="btn-primary">保存全部</button>
        <a href="/today" class="btn-link">返回今日</a>
      </div>
    </form>
  </main>
  <script>${script}</script>
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

  const rows = await ctx.env.DB.prepare(
    "SELECT slot, content FROM intros WHERE user_id = ?"
  ).bind(user.id).all<{ slot: string; content: string }>()
  const intros: Record<string, string> = {}
  for (const r of rows.results || []) intros[r.slot] = r.content
  const theme = await loadUserTheme(ctx.env, user.id)
  return renderPage(intros, user, theme)
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database; SESSION_SECRET?: string }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = ctx.data.user as User | undefined
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const form = await ctx.request.formData()
  const slots = Object.keys(SLOT_LABELS)
  const now = Date.now()
  for (const slot of slots) {
    const content = String(form.get(slot) || "").trim()
    await ctx.env.DB.prepare(
      `INSERT INTO intros (id, user_id, slot, content, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, slot) DO UPDATE SET
         content = excluded.content,
         updated_at = excluded.updated_at`
    ).bind(crypto.randomUUID(), user.id, slot, content, now).run()
  }
  // 重定向回 GET 展示成功
  const url = new URL(ctx.request.url)
  const fwdHost = ctx.request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = ctx.request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  return Response.redirect(`${fwdProto}://${fwdHost}/my/intros?saved=1`, 302)
}

const script = `
document.querySelectorAll('textarea').forEach(ta => {
  const update = () => {
    const counter = document.querySelector('[data-target="' + ta.id + '"]')
    if (counter) counter.textContent = ta.value.length + ' 字'
  }
  ta.addEventListener('input', update)
  update()
})
`

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; line-height: 1.6; padding-bottom: 60px; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
.topbar-inner { max-width: 760px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.brand { font-weight: 700; font-size: 16px; text-decoration: none; color: #1a202c; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.user-name { color: #4a5568; }
.logout-btn { padding: 4px 10px; background: #fff; color: #c53030; border: 1px solid #fc8181; border-radius: 16px; text-decoration: none; font-size: 12px; }
.logout-btn:hover { background: #fff5f5; }
main { max-width: 760px; margin: 0 auto; padding: 20px; }
.subnav { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.subnav a { padding: 6px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; text-decoration: none; color: #4a5568; font-size: 13px; }
.subnav a.active, .subnav a:hover { background: var(--t); color: #fff; border-color: var(--t); }
.flash { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.flash-ok { background: #c6f6d5; color: #22543d; }
.flash-err { background: #fed7d7; color: #c53030; }
h1 { font-size: 24px; margin-bottom: 6px; color: #2d3748; }
.muted { color: #a0aec0; font-size: 14px; margin-bottom: 20px; }
.form { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
.field { margin-bottom: 20px; }
.field label { display: block; font-weight: 500; margin-bottom: 4px; color: #2d3748; }
.field .hint { display: block; font-weight: 400; color: #a0aec0; font-size: 12px; margin-top: 2px; }
.field textarea { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 15px; font-family: inherit; resize: vertical; min-height: 60px; }
.field textarea:focus { outline: none; border-color: var(--t); box-shadow: 0 0 0 3px rgba(var(--ts-rgb), 0.1); }
.count { color: #a0aec0; font-size: 12px; margin-top: 4px; text-align: right; }
.actions { display: flex; gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #edf2f7; }
.btn-primary { padding: 10px 20px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-primary:hover { opacity: 0.92; }
.btn-link { padding: 10px 20px; color: #4a5568; text-decoration: none; }
@media (max-width: 640px) { .topbar-inner, main { padding: 12px 16px; } .form { padding: 16px; } }
`
