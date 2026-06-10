// ============================================
// pyq.huanyan.org · CF Pages Function: /logout
//
// 清除 pyq_session cookie → 302 重定向到 /login
// GET / POST 都能用（点链接是 GET，表单提交是 POST）
// ============================================

export async function onRequest(): Promise<Response> {
  const cookie =
    "pyq_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  })
}
