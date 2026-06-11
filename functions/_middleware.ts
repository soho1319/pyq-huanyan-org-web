// ============================================
// pyq-huanyan-org-web-saas · CF Pages Middleware（多用户版·白名单模式）
//
// 模式：默认全部放行（Quartz 公共方法论可读），**白名单**内才强制 auth
// 白名单：
//   - /api/* （所有 API）
//   - /today  （今日页）
//   - /my/*   （未来扩展：我的素材 / 我的排期等）
//
// Quartz 静态资源、笔记内容、首页：都公开可读
//
// 流程：
// 1. 路径在白名单 → 校验 session → 失败重定向 /login（HTML）或 401（API）
// 2. 路径不在白名单 → 直接 next()，data.user 也填上（方便 handler 选用）
// ============================================

import { getCurrentUser, type Env as AuthEnv, type User } from "./lib/auth"

interface MiddlewareEnv extends AuthEnv {
  SESSION_SECRET?: string
  DB?: D1Database
}

function requiresAuth(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true
  if (pathname === "/today") return true
  if (pathname.startsWith("/my/")) return true
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return true
  return false
}

function safeNextPath(input: string | null): string {
  if (!input) return "/"
  if (!input.startsWith("/") || input.startsWith("//")) return "/"
  return input
}

export async function onRequest(context: {
  request: Request
  env: MiddlewareEnv
  data: Record<string, unknown>
  next: () => Promise<Response>
}): Promise<Response> {
  const { request, env, data, next } = context
  const url = new URL(request.url)

  // 试着取 user（即便非 auth-required 路径也填好，让 handler 自由用）
  const user = await getCurrentUser(request, env)
  if (user) data.user = user

  // 不需要 auth 的路径 → 直接放行
  if (!requiresAuth(url.pathname)) {
    return next()
  }

  // 需要 auth 但没登录
  if (!user) {
    return redirectToLogin(request, url)
  }

  return next()
}

function redirectToLogin(req: Request, url: URL): Response {
  if (url.pathname.startsWith("/api/")) {
    return new Response(
      JSON.stringify({ error: "未登录或会话已过期" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    )
  }
  const target = safeNextPath(url.pathname + url.search)
  const fwdHost = req.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = req.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`
  const loginUrl = new URL("/login", origin)
  if (target !== "/") {
    loginUrl.searchParams.set("next", target)
  }
  return Response.redirect(loginUrl, 302)
}
