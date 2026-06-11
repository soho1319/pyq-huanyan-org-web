// ============================================
// D55-7: /admin/invites  admin 邀请码管理页
//
// 仅 admin（is_admin=1）可访问
// 顶部「生成新码」表单 + 下面「现有码」表格
// 前端 fetch 调 /api/admin/invites
// ============================================

import { getCurrentUser } from "../lib/auth"

interface Env {
  SESSION_SECRET?: string
  DB?: D1Database
}

interface User {
  id: string
  username: string
  display_name: string | null
  is_admin: number
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  )
}

function formatDate(ms: number | null): string {
  if (!ms) return "—"
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function renderAdminPage(user: User, origin: string): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>邀请码管理 · pyq.huanyan.org</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; }
  .container { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }
  h1 { font-size: 24px; margin-bottom: 8px; color: #2d3748; }
  .subtitle { color: #718096; font-size: 13px; margin-bottom: 24px; }
  .subtitle a { color: #667eea; text-decoration: none; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 24px; margin-bottom: 24px; }
  .card h2 { font-size: 16px; margin-bottom: 16px; color: #2d3748; }
  .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
  .form-field { flex: 1; min-width: 140px; }
  .form-field label { display: block; font-size: 12px; color: #4a5568; margin-bottom: 4px; font-weight: 500; }
  .form-field input { width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; }
  .form-field input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
  button { padding: 9px 18px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; }
  button:hover { opacity: 0.92; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.secondary { background: #e2e8f0; color: #4a5568; }
  button.danger { background: #fc8181; }
  button.danger:hover { background: #f56565; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: #f7fafc; color: #4a5568; font-weight: 500; border-bottom: 1px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #edf2f7; }
  tr.inactive td { opacity: 0.5; }
  .code { font-family: "JetBrains Mono", Menlo, monospace; letter-spacing: 0.05em; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .badge.active { background: #c6f6d5; color: #22543d; }
  .badge.inactive { background: #fed7d7; color: #742a2a; }
  .badge.expired { background: #fefcbf; color: #744210; }
  .msg { padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; }
  .msg.ok { background: #c6f6d5; color: #22543d; }
  .msg.err { background: #fed7d7; color: #c53030; }
  .empty { text-align: center; color: #a0aec0; padding: 40px; }
</style>
</head>
<body>
<div class="container">
  <h1>🎟️ 邀请码管理</h1>
  <div class="subtitle">登录身份：<strong>${escapeHtml(user.username)}</strong>（admin）· <a href="/today">回工作台</a> · <a href="/logout">退出</a></div>

  <div id="msg"></div>

  <div class="card">
    <h2>生成新码</h2>
    <form id="createForm" class="form-row" onsubmit="return createCode(event)">
      <div class="form-field">
        <label>最大使用次数</label>
        <input type="number" name="max_uses" min="1" max="1000" value="1" required>
      </div>
      <div class="form-field">
        <label>过期时间（可选）</label>
        <input type="datetime-local" name="expires_at">
      </div>
      <div class="form-field">
        <label>备注（可选）</label>
        <input type="text" name="note" placeholder="批次/用途" maxlength="200">
      </div>
      <button type="submit">+ 生成</button>
    </form>
  </div>

  <div class="card">
    <h2>现有码</h2>
    <div id="listArea">加载中…</div>
  </div>
</div>

<script>
const ORIGIN = ${JSON.stringify(origin)}
const COOKIE_NAME = "pyq_session"
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(?:^|;\\\\s*)" + name + "=([^;]+)"))
  return m ? decodeURIComponent(m[1]) : null
}

function showMsg(text, type) {
  const el = document.getElementById("msg")
  el.innerHTML = '<div class="msg ' + (type || "ok") + '">' + text + '</div>'
  setTimeout(() => { el.innerHTML = "" }, 5000)
}

async function loadList() {
  const r = await fetch(ORIGIN + "/api/admin/invites?action=list", { credentials: "include" })
  if (!r.ok) {
    document.getElementById("listArea").innerHTML = '<div class="empty">加载失败：HTTP ' + r.status + '</div>'
    return
  }
  const data = await r.json()
  if (!data.ok || !data.codes || data.codes.length === 0) {
    document.getElementById("listArea").innerHTML = '<div class="empty">还没有邀请码</div>'
    return
  }
  const now = Date.now()
  let html = '<table><thead><tr><th>邀请码</th><th>使用</th><th>过期</th><th>备注</th><th>创建者</th><th>创建时间</th><th>状态</th><th></th></tr></thead><tbody>'
  for (const c of data.codes) {
    const expired = c.expires_at && c.expires_at < now
    const status = !c.is_active ? '<span class="badge inactive">已撤销</span>' :
                   expired ? '<span class="badge expired">已过期</span>' :
                   '<span class="badge active">有效</span>'
    html += '<tr class="' + (c.is_active ? "" : "inactive") + '">'
    html += '<td class="code">' + escapeHtml(c.code) + '</td>'
    html += '<td>' + c.used_count + ' / ' + c.max_uses + '</td>'
    html += '<td>' + (c.expires_at ? formatDate(new Date(c.expires_at)) : "—") + '</td>'
    html += '<td>' + (c.note ? escapeHtml(c.note) : "—") + '</td>'
    html += '<td>' + escapeHtml(c.creator_username || "—") + '</td>'
    html += '<td>' + formatDate(new Date(c.created_at)) + '</td>'
    html += '<td>' + status + '</td>'
    html += '<td>' + (c.is_active ? '<button class="danger" onclick="revoke(\\'' + c.id + '\\')">撤销</button>' : '—') + '</td>'
    html += '</tr>'
  }
  html += '</tbody></table>'
  document.getElementById("listArea").innerHTML = html
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

function formatDate(d) {
  const pad = n => String(n).padStart(2, "0")
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes())
}

async function createCode(e) {
  e.preventDefault()
  const form = e.target
  const fd = new FormData(form)
  const expiresLocal = fd.get("expires_at")
  let expires_at = null
  if (expiresLocal) expires_at = new Date(expiresLocal).getTime()
  const body = {
    action: "create",
    max_uses: Number(fd.get("max_uses")),
    expires_at,
    note: fd.get("note") || null,
  }
  const r = await fetch(ORIGIN + "/api/admin/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (r.ok && data.ok) {
    showMsg("已生成：<strong>" + escapeHtml(data.code) + "</strong>（分享给用户到 <code>/register?code=" + escapeHtml(data.code) + "</code>）", "ok")
    form.reset()
    form.querySelector('[name=max_uses]').value = 1
    loadList()
  } else {
    showMsg("生成失败：" + (data.error || "HTTP " + r.status), "err")
  }
  return false
}

async function revoke(id) {
  if (!confirm("确定要撤销这个邀请码吗？撤销后无法恢复。")) return
  const r = await fetch(ORIGIN + "/api/admin/invites?id=" + encodeURIComponent(id), {
    method: "DELETE",
    credentials: "include",
  })
  const data = await r.json()
  if (r.ok && data.ok) {
    showMsg("已撤销", "ok")
    loadList()
  } else {
    showMsg("撤销失败：" + (data.error || "HTTP " + r.status), "err")
  }
}

loadList()
</script>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

export async function onRequest(ctx: {
  request: Request
  env: Env
  data: Record<string, unknown>
}): Promise<Response> {
  const { request, env, data } = ctx
  const url = new URL(request.url)
  const fwdHost = request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  // middleware 已经校验过 auth，这里再查一次 user 用于渲染
  let user = data.user as User | undefined
  if (!user) {
    user = (await getCurrentUser(request, env)) || undefined
  }
  if (!user) {
    return Response.redirect(`${origin}/login?next=/admin/invites`, 302)
  }
  if (user.is_admin !== 1) {
    return new Response("需要 admin 权限", { status: 403 })
  }
  return renderAdminPage(user, origin)
}
