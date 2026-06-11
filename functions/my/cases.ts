// ============================================
import { loadUserTheme, themeCssVar } from "../lib/theme"
// /my/cases
// 客户案例列表 + 添加 + 编辑 + 删除
//
// GET   渲染列表 + 添加表单 + 编辑表单
// POST  action=create/update/delete
// ============================================

interface User { id: string; username: string; display_name: string | null }
interface CaseRow {
  id: string; name: string | null; persona: string | null; pain: string | null;
  action: string | null; result: string | null; testimonial: string | null;
  sort_order: number;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function renderForm(c: Partial<CaseRow> & { id?: string }, action: string, label: string, user: User, theme: { start: string; end: string; solid: string }, msg?: string): string {
  return `
    <form method="POST" action="/my/cases" class="form">
      <input type="hidden" name="_action" value="${action}">
      ${c.id ? `<input type="hidden" name="id" value="${c.id}">` : ''}
      <div class="field"><label>化名（例：张姐）</label><input name="name" value="${escapeHtml(c.name || '')}" required></div>
      <div class="field"><label>谁（行业/身份/年龄段）</label><input name="persona" value="${escapeHtml(c.persona || '')}"></div>
      <div class="field"><label>痛点</label><textarea name="pain" rows="2">${escapeHtml(c.pain || '')}</textarea></div>
      <div class="field"><label>做了什么</label><textarea name="action" rows="2">${escapeHtml(c.action || '')}</textarea></div>
      <div class="field"><label>结果（带数字）</label><textarea name="result" rows="2">${escapeHtml(c.result || '')}</textarea></div>
      <div class="field"><label>原话证言（ta 说过的话）</label><textarea name="testimonial" rows="2">${escapeHtml(c.testimonial || '')}</textarea></div>
      <div class="actions">
        <button type="submit" class="btn-primary">${label}</button>
        ${c.id ? '<a href="/my/cases" class="btn-link">取消</a>' : ''}
      </div>
    </form>
  `
}

function renderPage(cases: CaseRow[], user: User, editId: string | null, theme: { start: string; end: string; solid: string }, msg?: string): Response {
  const edit = editId ? cases.find(c => c.id === editId) : null
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>客户案例 · pyq</title>
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
      <a href="/my/cases" class="active">👥 客户案例</a>
      <a href="/my/quotes">💎 金句库</a>
      <a href="/my/formulas">✍️ 公式填空</a>
      <a href="/calendar">📅 日历</a>
    </nav>
    ${msg ? `<div class="flash flash-ok">${escapeHtml(msg)}</div>` : ''}
    <h1>👥 客户案例（${cases.length}）</h1>
    <p class="muted">每个案例一条记录。尽量填具体数字结果。</p>

    <div class="cards">
      ${cases.length === 0
        ? '<div class="empty">还没有案例。↓ 在下面添加</div>'
        : cases.map((c, i) => `
        <div class="card-case">
          <div class="case-head">
            <span class="case-idx">#${i + 1}</span>
            <strong>${escapeHtml(c.name || '(未命名)')}</strong>
            <span class="muted">— ${escapeHtml(c.persona || '?')}</span>
          </div>
          ${c.pain ? `<p><span class="lbl">痛点</span>${escapeHtml(c.pain)}</p>` : ''}
          ${c.action ? `<p><span class="lbl">做了</span>${escapeHtml(c.action)}</p>` : ''}
          ${c.result ? `<p><span class="lbl">结果</span>${escapeHtml(c.result)}</p>` : ''}
          ${c.testimonial ? `<blockquote>${escapeHtml(c.testimonial)}</blockquote>` : ''}
          <div class="case-actions">
            <a href="/my/cases?edit=${c.id}" class="btn-sm">✏️ 编辑</a>
            <form method="POST" action="/my/cases" style="display:inline" onsubmit="return confirm('删除这个案例？')">
              <input type="hidden" name="_action" value="delete">
              <input type="hidden" name="id" value="${c.id}">
              <button type="submit" class="btn-sm btn-danger">🗑 删除</button>
            </form>
          </div>
        </div>
      `).join('')}
    </div>

    <h2>${edit ? '✏️ 编辑案例' : '➕ 添加新案例'}</h2>
    ${renderForm(edit || {}, edit ? 'update' : 'create', edit ? '保存修改' : '添加', user)}
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
  const editId = url.searchParams.get("edit")
  const saved = url.searchParams.get("saved")

  const cases = await ctx.env.DB.prepare(
    "SELECT * FROM cases WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC"
  ).bind(user.id).all<CaseRow>()

  let msg: string | undefined
  if (saved === "1") msg = "✓ 已保存"
  if (saved === "deleted") msg = "✓ 已删除"

  const theme = await loadUserTheme(ctx.env, user.id)
  return renderPage(cases.results || [], user, editId, theme, msg)
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
  const action = String(form.get("_action") || "")

  if (action === "delete") {
    const id = String(form.get("id") || "")
    if (!id) return new Response("缺少 id", { status: 400 })
    await ctx.env.DB.prepare("DELETE FROM cases WHERE id = ? AND user_id = ?").bind(id, user.id).run()
    return Response.redirect(getOrigin(ctx.request) + "/my/cases?saved=deleted", 302)
  }

  if (action !== "create" && action !== "update") {
    return new Response("未知 action", { status: 400 })
  }

  const name = String(form.get("name") || "").trim()
  const persona = String(form.get("persona") || "").trim() || null
  const pain = String(form.get("pain") || "").trim() || null
  const actionDesc = String(form.get("action") || "").trim() || null
  const result = String(form.get("result") || "").trim() || null
  const testimonial = String(form.get("testimonial") || "").trim() || null

  if (!name) return new Response("化名不能为空", { status: 400 })

  if (action === "create") {
    const id = crypto.randomUUID()
    const now = Date.now()
    await ctx.env.DB.prepare(
      "INSERT INTO cases (id, user_id, name, persona, pain, action, result, testimonial, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, user.id, name, persona, pain, actionDesc, result, testimonial, now, now).run()
  } else {
    const id = String(form.get("id") || "")
    if (!id) return new Response("缺少 id", { status: 400 })
    await ctx.env.DB.prepare(
      "UPDATE cases SET name=?, persona=?, pain=?, action=?, result=?, testimonial=?, updated_at=? WHERE id=? AND user_id=?"
    ).bind(name, persona, pain, actionDesc, result, testimonial, Date.now(), id, user.id).run()
  }
  return Response.redirect(getOrigin(ctx.request) + "/my/cases?saved=1", 302)
}

function getOrigin(req: Request): string {
  const url = new URL(req.url)
  const fwdHost = req.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = req.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  return `${fwdProto}://${fwdHost}`
}

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; line-height: 1.6; padding-bottom: 60px; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
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
.cards { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.card-case { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.case-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.case-idx { padding: 2px 8px; background: #edf2f7; color: #4a5568; border-radius: 4px; font-size: 12px; font-weight: 600; }
.case-head strong { color: #2d3748; }
.card-case p { font-size: 14px; color: #4a5568; margin-bottom: 4px; }
.card-case .lbl { display: inline-block; min-width: 36px; color: #a0aec0; font-size: 12px; margin-right: 4px; }
.card-case blockquote { border-left: 3px solid #cbd5e0; padding-left: 12px; margin: 8px 0; color: #2d3748; font-style: italic; font-size: 14px; }
.case-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #edf2f7; }
.btn-sm { padding: 6px 10px; background: #edf2f7; color: #4a5568; border-radius: 6px; text-decoration: none; font-size: 13px; border: none; cursor: pointer; }
.btn-sm:hover { background: #e2e8f0; }
.btn-danger { background: #fed7d7; color: #c53030; }
.btn-danger:hover { background: #fc8181; color: #fff; }
.empty { background: #fff; border: 2px dashed #cbd5e0; border-radius: 12px; padding: 40px; text-align: center; color: #a0aec0; }
.form { background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
.field { margin-bottom: 14px; }
.field label { display: block; font-weight: 500; margin-bottom: 4px; color: #4a5568; font-size: 14px; }
.field input, .field textarea { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 15px; font-family: inherit; }
.field textarea { resize: vertical; min-height: 50px; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--t); box-shadow: 0 0 0 3px rgba(var(--ts-rgb), 0.1); }
.actions { display: flex; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #edf2f7; }
.btn-primary { padding: 10px 20px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-primary:hover { opacity: 0.92; }
.btn-link { padding: 10px 20px; color: #4a5568; text-decoration: none; }
@media (max-width: 640px) { .topbar-inner, main { padding: 12px 16px; } .form { padding: 16px; } .case-actions { flex-direction: column; align-items: stretch; } .btn-sm { text-align: center; } }
`
