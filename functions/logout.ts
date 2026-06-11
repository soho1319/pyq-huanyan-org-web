// ============================================
// pyq-huanyan-org-web-saas · CF Pages Function: /logout（多用户版）
//
// 清除 pyq_session cookie → 302 重定向到 /login
// GET / POST 都能用（点链接是 GET，表单提交是 POST）
// ============================================

import { buildClearCookie } from "./lib/auth"

export async function onRequest(context: {
  request: Request
}): Promise<Response> {
  const url = new URL(context.request.url)
  const fwdHost = context.request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = context.request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  return new Response(null, {
    status: 302,
    headers: {
      Location: origin.replace(/\/$/, "") + "/login",
      "Set-Cookie": buildClearCookie(),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  })
}
