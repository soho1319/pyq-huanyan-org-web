// ============================================
// pyq.huanyan.org · CF Pages Function: /login
//
// GET  → 渲染登录表单（HTML）
// POST → 验证账号密码 → 通过则 Set-Cookie（pyq_session, 7 天）
//        → 302 重定向到 ?next= 或 /
//        → 失败回 401 + 表单 + 错误提示
//
// 支持 form-urlencoded / multipart / JSON（兼容性好）
// ============================================

interface Env {
  BASIC_AUTH_USER?: string
  BASIC_AUTH_PASSWORD?: string
  SESSION_SECRET?: string
}

const COOKIE_NAME = "pyq_session"
const SESSION_TTL = 60 * 60 * 24 * 7 // 7 天

async function hmac(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
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
  nextPath: string
): Response {
  const action = "/login" + (nextPath && nextPath !== "/" ? "?next=" + encodeURIComponent(nextPath) : "")
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
</style>
</head>
<body>
  <form class="card" method="POST" action="${action}">
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
    <div class="hint">输入正确的账号密码即可访问网站</div>
  </form>
</body>
</html>`
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export async function onRequest(context: {
  request: Request
  env: Env
}): Promise<Response> {
  const { request, env } = context
  const url = new URL(request.url)
  const nextParam = safeNextPath(url.searchParams.get("next"))

  if (request.method === "GET") {
    return renderLoginPage("", "", nextParam)
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, POST" },
    })
  }

  // 解析 body（form / multipart / json 三种都兼容）
  let username = ""
  let password = ""
  try {
    const ct = (request.headers.get("Content-Type") || "").toLowerCase()
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await request.formData()
      username = String(form.get("username") || "")
      password = String(form.get("password") || "")
    } else if (ct.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>
      username = String(body.username || "")
      password = String(body.password || "")
    } else {
      // 兜底：当作 form
      const text = await request.text()
      const params = new URLSearchParams(text)
      username = params.get("username") || ""
      password = params.get("password") || ""
    }
  } catch {
    return renderLoginPage("请求格式错误", username, nextParam)
  }

  const expectedUser = env.BASIC_AUTH_USER || "admin"
  const expectedPassword = env.BASIC_AUTH_PASSWORD
  if (!expectedPassword) {
    return new Response("服务未配置 BASIC_AUTH_PASSWORD 环境变量", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  if (
    username.length > 0 &&
    timingSafeEqual(username, expectedUser) &&
    timingSafeEqual(password, expectedPassword)
  ) {
    // 设置签名 cookie
    const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL
    const secret = env.SESSION_SECRET || expectedPassword
    const payload = `${expiry}.${username}`
    const sig = await hmac(secret, payload)
    const cookieValue = `${payload}.${sig}`
    const cookie = `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`
    return new Response(null, {
      status: 302,
      headers: {
        Location: nextParam,
        "Set-Cookie": cookie,
        "Cache-Control": "no-store",
      },
    })
  }

  return renderLoginPage("账号或密码错误", username, nextParam)
}
