// ============================================
// pyq.huanyan.org · Worker 反代
//
// 作用：
// 1. 接收所有到 pyq.huanyan.org/* 的请求
// 2. 转发到 CF Pages 项目 pyq-huanyan-org-web.pages.dev
// 3. 原样返回响应（包括 Set-Cookie / 302 等）
// 4. 加几个调试 + 安全头
//
// 部署：cd worker && npx wrangler deploy
// ============================================

const PAGES_ORIGIN = "https://pyq-huanyan-org-web.pages.dev"

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const clientIp = request.headers.get("CF-Connecting-IP") || ""

    // 构造转发到 Pages 的 URL
    const targetUrl = PAGES_ORIGIN + url.pathname + url.search

    // Clone request with target host
    const init = {
      method: request.method,
      headers: new Headers(request.headers),
      body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
      redirect: "manual",
    }
    const newRequest = new Request(targetUrl, init)
    newRequest.headers.set("Host", "pyq-huanyan-org-web.pages.dev")
    newRequest.headers.set("X-Forwarded-Host", url.host)
    newRequest.headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""))
    if (clientIp) newRequest.headers.set("X-Real-IP", clientIp)

    let response
    try {
      response = await fetch(newRequest)
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err.message}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Proxy-By": "pyq-huanyan-reverse" },
      })
    }

    // 透传响应（保留所有 Set-Cookie / Location 等）
    const outHeaders = new Headers(response.headers)
    outHeaders.set("X-Proxy-By", "pyq-huanyan-reverse")
    outHeaders.set("X-Proxy-Original-Status", String(response.status))
    outHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin")
    outHeaders.set("X-Content-Type-Options", "nosniff")

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    })
  },
}
