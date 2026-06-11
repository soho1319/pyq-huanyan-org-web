// ============================================
// pyq-huanyan-org-web-saas · CF Pages Function: /login（多用户版）
//
// GET  → 渲染登录表单
// POST → 按 username 查 D1 → 验密码 → 设置签名 cookie（带 userid）→ 302
//        失败 → 401 + 表单 + 错误提示
//
// Cookie 格式：<expiry>.<username>.<userid>.<sig>
// ============================================

import {
  buildSessionCookie,
  getCurrentUser,
  hashPassword,
  signSessionCookie,
  verifyPassword,
  type Env as AuthEnv,
} from "./lib/auth"

interface Env extends AuthEnv {
  D1_PASSWORD_PEPPER?: string
  DB?: D1Database
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  )
}

function safeNextPath(input: string | null): string {
  if (!input) return "/"
  if (!input.startsWith("/") || input.startsWith("//")) return "/"
  return input
}

function renderLoginPage(
  error: string,
  username: string,
  nextPath: string,
  origin: string
): Response {
  const action = origin.replace(/\/$/, "") + "/login" + (nextPath && nextPath !== "/" ? "?next=" + encodeURIComponent(nextPath) : "")
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>登录 · pyq.huanyan.org</title>
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
    <h1>🔐 登录</h1>
    <div class="subtitle">内容营销朋友圈小助手 · pyq.huanyan.org</div>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <div class="form-group">
      <label for="username">账号</label>
      <input type="text" id="username" name="username" value="${escapeHtml(username)}" autocomplete="username" required autofocus>
    </div>
    <div class="form-group">
      <label for="password">密码</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
    </div>
    <button type="submit">登 入</button>
    <div class="hint">还没有账号？<a href="/register">用邀请码注册</a></div>
  </form>
</body>
</html>`
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

export async function onRequest(context: {
  request: Request
  env: Env
  data: Record<string, unknown>
}): Promise<Response> {
  const { request, env, data } = context
  const url = new URL(request.url)
  const nextParam = safeNextPath(url.searchParams.get("next"))

  // 取得 origin（处理反代场景）
  const fwdHost = request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  // 已登录 → 直接跳走
  const existing = await getCurrentUser(request, env)
  if (existing) {
    return Response.redirect(origin.replace(/\/$/, "") + nextParam, 302)
  }

  if (request.method === "GET") {
    return renderLoginPage("", "", nextParam, origin)
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, POST" },
    })
  }

  // 解析 body
  let username = ""
  let password = ""
  try {
    const ct = (request.headers.get("Content-Type") || "").toLowerCase()
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await request.formData()
      username = String(form.get("username") || "").trim()
      password = String(form.get("password") || "")
    } else if (ct.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>
      username = String(body.username || "").trim()
      password = String(body.password || "")
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      username = (params.get("username") || "").trim()
      password = params.get("password") || ""
    }
  } catch {
    return renderLoginPage("请求格式错误", username, nextParam, origin)
  }

  if (!username || !password) {
    return renderLoginPage("请输入账号和密码", username, nextParam, origin)
  }

  if (!env.DB) {
    return new Response("服务未配置 D1 数据库", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
  if (!env.SESSION_SECRET) {
    return new Response("服务未配置 SESSION_SECRET 环境变量", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // 查 user
  const row = await env.DB.prepare(
    "SELECT id, username, password_hash, display_name, is_admin FROM users WHERE username = ?"
  ).bind(username).first<{
    id: string
    username: string
    password_hash: string
    display_name: string | null
    is_admin: number
  } | null>()

  if (!row) {
    return renderLoginPage("账号或密码错误", username, nextParam, origin)
  }

  const ok = await verifyPassword(password, row.password_hash, env.D1_PASSWORD_PEPPER || "")
  if (!ok) {
    return renderLoginPage("账号或密码错误", username, nextParam, origin)
  }

  // 签发 session cookie
  const cookieValue = await signSessionCookie(
    { username: row.username, id: row.id },
    env.SESSION_SECRET
  )

  // 设置 context.data 供下游使用
  data.user = {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    is_admin: row.is_admin,
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: nextParam,
      "Set-Cookie": buildSessionCookie(cookieValue),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  })
}
