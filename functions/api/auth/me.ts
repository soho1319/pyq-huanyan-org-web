// ============================================
// GET /api/auth/me
// 返回当前登录用户信息
// ============================================

import { getCurrentUser, type Env } from "../../lib/auth"

export async function onRequestGet(context: {
  request: Request
  env: Env
}): Promise<Response> {
  const user = await getCurrentUser(context.request, context.env)
  if (!user) {
    return new Response(
      JSON.stringify({ error: "未登录", authenticated: false }),
      { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } }
    )
  }
  return new Response(
    JSON.stringify({ authenticated: true, user }),
    { headers: { "Content-Type": "application/json; charset=utf-8" } }
  )
}
