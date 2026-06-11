// ============================================
// D55-7: /register  公开注册页（邀请制）
//
// GET  → 渲染注册表单（邀请码 + 账号 + 显示名 + 密码）
//        支持 ?code=K7XQ4M2P 预填
//        支持 ?error=xxx&username=yyy 回显
//
// POST → 302 → /api/register（避免重复实现 form 解析）
// ============================================

import { getCurrentUser } from "./lib/auth"

interface Env {
  SESSION_SECRET?: string
  DB?: D1Database
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  )
}

function renderRegisterPage(
  error: string,
  code: string,
  username: string,
  display_name: string,
  origin: string
): Response {
  const action = `${origin.replace(/\/$/, "")}/api/register`
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>注册 · pyq.huanyan.org</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 40px 32px; max-width: 380px; width: 100%; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 6px; color: #2d3748; }
  .subtitle { text-align: center; color: #718096; margin-bottom: 24px; font-size: 13px; }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: 13px; color: #4a5568; margin-bottom: 6px; font-weight: 500; }
  input { width: 100%; padding: 11px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 15px; transition: border-color 0.2s; background: #fff; color: #1a202c; }
  input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
  input.code { font-family: "JetBrains Mono", Menlo, monospace; letter-spacing: 0.1em; text-align: center; font-size: 18px; }
  button { width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; transition: transform 0.1s, opacity 0.2s; }
  button:hover { opacity: 0.92; }
  button:active { transform: scale(0.98); }
  .error { background: #fed7d7; color: #c53030; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; text-align: center; }
  .hint { text-align: center; color: #a0aec0; font-size: 12px; margin-top: 16px; }
  .hint a { color: #667eea; text-decoration: none; }
  .hint a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <form class="card" method="POST" action="${escapeHtml(action)}">
    <h1>✨ 注册</h1>
    <div class="subtitle">内容营销朋友圈小助手 · pyq.huanyan.org</div>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <div class="form-group">
      <label for="code">邀请码</label>
      <input type="text" id="code" name="code" class="code" value="${escapeHtml(code)}" autocomplete="off" required autofocus placeholder="8 位">
    </div>
    <div class="form-group">
      <label for="username">账号（3-32 位字母/数字/下划线）</label>
      <input type="text" id="username" name="username" value="${escapeHtml(username)}" autocomplete="username" required pattern="[a-zA-Z0-9_]{3,32}">
    </div>
    <div class="form-group">
      <label for="display_name">显示名（别人看到的名字）</label>
      <input type="text" id="display_name" name="display_name" value="${escapeHtml(display_name)}" autocomplete="nickname" required>
    </div>
    <div class="form-group">
      <label for="password">密码（至少 8 位）</label>
      <input type="password" id="password" name="password" autocomplete="new-password" required minlength="8">
    </div>
    <button type="submit">注 册</button>
    <div class="hint">已有账号？<a href="/login">直接登录</a></div>
  </form>
</body>
</html>`
  return new Response(html, {
    status: error ? 400 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

export async function onRequest(ctx: {
  request: Request
  env: Env
}): Promise<Response> {
  const { request, env } = ctx
  const url = new URL(request.url)
  const fwdHost = request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  // 已登录 → 直接跳走
  const existing = await getCurrentUser(request, env)
  if (existing) {
    return Response.redirect(`${origin}/today`, 302)
  }

  if (request.method === "GET") {
    const error = url.searchParams.get("error") || ""
    const code = url.searchParams.get("code") || ""
    const username = url.searchParams.get("username") || ""
    const display_name = url.searchParams.get("display_name") || ""
    return renderRegisterPage(error, code, username, display_name, origin)
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST" } })
  }

  // POST：重定向到 /api/register，body 透传
  // 用 307 保持 method + body
  return Response.redirect(`${origin}/api/register`, 307)
}
