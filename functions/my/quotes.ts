// ============================================
import { loadUserTheme, themeCssVar } from "../lib/theme"
// /my/quotes
// 金句库：列表 + 添加 + 删除
// ============================================

interface User { id: string; username: string; display_name: string | null }
interface QuoteRow { id: string; text: string; category: string | null; source: string | null; created_at: number }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function getOrigin(req: Request): string {
  const url = new URL(req.url)
  const fwdHost = req.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = req.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  return `${fwdProto}://${fwdHost}`
}

function renderPage(quotes: QuoteRow[], user: User, theme: { start: string; end: string; solid: string }, msg?: string): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>金句库 · pyq</title>
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
      <a href="/my/intros">👋 自我介绍</a>
      <a href="/my/cases">👥 客户案例</a>
      <a href="/my/quotes" class="active">💎 金句库</a>
      <a href="/my/formulas">✍️ 公式填空</a>
      <a href="/calendar">📅 日历</a>
    </nav>
    ${msg ? `<div class="flash flash-ok">${escapeHtml(msg)}</div>` : ''}
    <h1>💎 金句库（${quotes.length}）</h1>
    <p class="muted">朋友圈开头、视频号 hook、广告语、群分享——都从这里取。</p>

    <h2>➕ 添加金句</h2>
    <form method="POST" action="/my/quotes" class="form">
      <div class="field">
        <label>金句</label>
        <textarea name="text" rows="2" required placeholder="大部分人以为 X，其实 X"></textarea>
      </div>
      <div class="row">
        <div class="field">
          <label>分类（可选）</label>
          <input name="category" placeholder="反认知 / 痛点 / 价值观 / 故事开头 / 其他">
        </div>
        <div class="field">
          <label>来源（可选）</label>
          <input name="source" placeholder="婉音老师课程 / 原创 / 书名">
        </div>
      </div>
      <div class="actions">
        <button type="submit" class="btn-primary">添加</button>
      </div>
    </form>

    <h2>📚 已有金句</h2>
    ${quotes.length === 0
      ? '<div class="empty">还没有金句 ↑</div>'
      : `<ul class="quotes">${quotes.map(q => `
        <li>
          <div class="q-content">
            <div class="q-text">"${escapeHtml(q.text)}"</div>
            <div class="q-meta">
              ${q.category ? `<span class="cat">${escapeHtml(q.category)}</span>` : ''}
              ${q.source ? `<span class="src">${escapeHtml(q.source)}</span>` : ''}
            </div>
          </div>
          <form method="POST" action="/my/quotes" style="display:inline" onsubmit="return confirm('删除？')">
            <input type="hidden" name="_action" value="delete">
            <input type="hidden" name="id" value="${q.id}">
            <button type="submit" class="btn-icon">🗑</button>
          </form>
        </li>
      `).join('')}</ul>`}
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
  const saved = url.searchParams.get("saved")
  let msg: string | undefined
  if (saved === "1") msg = "✓ 已添加"
  if (saved === "deleted") msg = "✓ 已删除"

  const quotes = await ctx.env.DB.prepare(
    "SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all<QuoteRow>()
  const theme = await loadUserTheme(ctx.env, user.id)
  return renderPage(quotes.results || [], user, theme, msg)
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
  const action = String(form.get("_action") || "create")

  if (action === "delete") {
    const id = String(form.get("id") || "")
    if (id) await ctx.env.DB.prepare("DELETE FROM quotes WHERE id = ? AND user_id = ?").bind(id, user.id).run()
    return Response.redirect(getOrigin(ctx.request) + "/my/quotes?saved=deleted", 302)
  }

  const text = String(form.get("text") || "").trim()
  if (!text) return new Response("金句不能为空", { status: 400 })
  const category = String(form.get("category") || "").trim() || null
  const source = String(form.get("source") || "").trim() || null

  await ctx.env.DB.prepare(
    "INSERT INTO quotes (id, user_id, text, category, source, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), user.id, text, category, source, Date.now()).run()
  return Response.redirect(getOrigin(ctx.request) + "/my/quotes?saved=1", 302)
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
.flash { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.flash-ok { background: #c6f6d5; color: #22543d; }
h1 { font-size: 24px; margin-bottom: 6px; color: #2d3748; }
h2 { font-size: 18px; margin: 24px 0 12px; color: #2d3748; }
.muted { color: #a0aec0; font-size: 14px; margin-bottom: 20px; }
.form { background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
.field { margin-bottom: 14px; }
.field label { display: block; font-weight: 500; margin-bottom: 4px; color: #4a5568; font-size: 14px; }
.field input, .field textarea { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 15px; font-family: inherit; }
.field textarea { resize: vertical; min-height: 50px; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--t); box-shadow: 0 0 0 3px rgba(var(--ts-rgb), 0.1); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
.actions { display: flex; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #edf2f7; }
.btn-primary { padding: 10px 20px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-icon { padding: 6px 10px; background: transparent; border: none; cursor: pointer; font-size: 16px; }
.btn-icon:hover { background: #fed7d7; border-radius: 6px; }
.empty { background: #fff; border: 2px dashed #cbd5e0; border-radius: 12px; padding: 40px; text-align: center; color: #a0aec0; }
.quotes { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.quotes li { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; display: flex; align-items: flex-start; gap: 8px; }
.q-content { flex: 1; }
.q-text { color: #2d3748; font-size: 15px; margin-bottom: 4px; line-height: 1.5; }
.q-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.cat { padding: 1px 8px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 11px; font-weight: 600; }
.src { padding: 1px 8px; background: #edf2f7; color: #4a5568; border-radius: 4px; font-size: 11px; }
@media (max-width: 640px) { .topbar-inner, main { padding: 12px 16px; } .form { padding: 16px; } }
`
