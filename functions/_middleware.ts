// ============================================
// pyq.huanyan.org · CF Pages Middleware（cookie 会话版）
//
// 流程：
// 1. /login /logout 路径直接放行（由 functions/login.ts 和 functions/logout.ts 处理）
// 2. 其他路径：读取 pyq_session cookie → 验证 HMAC 签名 + 未过期 → 通过
// 3. 没通过：
//    - API 路径 → 401 JSON
//    - HTML 路径 → 302 重定向到 /login（带 next 参数，登录后跳回）
//
// 环境变量：
//   BASIC_AUTH_USER     账号（明文，默认 "admin"）
//   BASIC_AUTH_PASSWORD 密码（Secret）
//   SESSION_SECRET      HMAC 签名密钥（可选；不设就用 BASIC_AUTH_PASSWORD）
// ============================================

interface Env {
  BASIC_AUTH_USER?: string
  BASIC_AUTH_PASSWORD?: string
  SESSION_SECRET?: string
}

const COOKIE_NAME = "pyq_session"

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

function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie") || ""
  const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  const m = cookie.match(re)
  return m ? decodeURIComponent(m[1]) : null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/.well-known/")
  )
}

function safeNextPath(input: string | null): string {
  if (!input) return "/"
  // 仅允许同源相对路径，防止 open redirect
  if (!input.startsWith("/") || input.startsWith("//")) return "/"
  return input
}

export async function onRequest(context: {
  request: Request
  env: Env
  next: () => Promise<Response>
}): Promise<Response> {
  const { request, env, next } = context
  const url = new URL(request.url)

  // 1. 放行公开路径
  if (isPublicPath(url.pathname)) {
    return next()
  }

  // 2. 准备校验
  const expectedUser = env.BASIC_AUTH_USER || "admin"
  const password = env.BASIC_AUTH_PASSWORD
  if (!password) {
    return new Response("服务未配置 BASIC_AUTH_PASSWORD 环境变量", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
  const secret = env.SESSION_SECRET || password

  // 3. 校验 cookie 会话
  const session = getCookie(request, COOKIE_NAME)
  if (session) {
    // 格式: <expiry>.<user>.<sig>
    const dot1 = session.indexOf(".")
    const dot2 = session.indexOf(".", dot1 + 1)
    if (dot1 > 0 && dot2 > dot1) {
      const expiry = session.slice(0, dot1)
      const user = session.slice(dot1 + 1, dot2)
      const sig = session.slice(dot2 + 1)
      const now = Math.floor(Date.now() / 1000)
      if (
        /^\d+$/.test(expiry) &&
        parseInt(expiry) > now &&
        timingSafeEqual(user, expectedUser)
      ) {
        const payload = `${expiry}.${user}`
        const expectedSig = await hmac(secret, payload)
        if (timingSafeEqual(sig, expectedSig)) {
          return next() // 有效会话
        }
      }
    }
  }

  // 4. 未通过：API 返 401，HTML 重定向到 /login
  if (url.pathname.startsWith("/api/")) {
    return new Response(
      JSON.stringify({ error: "未登录或会话已过期" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    )
  }
  const loginUrl = new URL("/login", url)
  const target = safeNextPath(url.pathname + url.search)
  if (target !== "/") {
    loginUrl.searchParams.set("next", target)
  }
  return Response.redirect(loginUrl, 302)
}
