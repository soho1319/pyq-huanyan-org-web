// ============================================
// / (根路径)
// - 已登录 → 302 → /today（工作台主页）
// - 未登录 → 302 → /login
//
// 公共方法论浏览：直接访问 /内容营销朋友圈助手/... 等子路径
// ============================================

import { getCurrentUser } from "./lib/auth"

export async function onRequest(ctx: {
  request: Request
  env: { SESSION_SECRET?: string; DB?: D1Database }
}): Promise<Response> {
  const url = new URL(ctx.request.url)
  const fwdHost = ctx.request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = ctx.request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  const user = await getCurrentUser(ctx.request, ctx.env)
  if (user) {
    return Response.redirect(`${origin}/today`, 302)
  }
  return Response.redirect(`${origin}/login`, 302)
}
