// ============================================
// /my （用户工作台入口）
// - 已登录 → 302 → /my/dashboard
// - 未登录 → middleware 拦截 → /login?next=/my/dashboard
// ============================================

export async function onRequest(ctx: {
  request: Request
  env: { SESSION_SECRET?: string; DB?: D1Database }
}): Promise<Response> {
  const url = new URL(ctx.request.url)
  const fwdHost = ctx.request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = ctx.request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  return Response.redirect(`${origin}/my/dashboard`, 302)
}
