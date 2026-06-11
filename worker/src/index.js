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

const PAGES_ORIGIN = "https://pyq-b4s.pages.dev"
const PAGES_HOST = "pyq-b4s.pages.dev"

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
    newRequest.headers.set("Host", PAGES_HOST)
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

    // 透传响应（保留所有 Set-Cookie / Location 等），但重写关键头
    const outHeaders = new Headers(response.headers)
    outHeaders.set("X-Proxy-By", "pyq-huanyan-reverse")
    outHeaders.set("X-Proxy-Original-Status", String(response.status))
    outHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin")
    outHeaders.set("X-Content-Type-Options", "nosniff")

    // ============ 重写 Location 头 ============
    // 避免 302 跳转到 pyq-huanyan-org-web.pages.dev（function 里 new URL("/login", url) 会拼成 .pages.dev）
    // 改成相对路径，让浏览器按 URL 栏域名（pyq.huanyan.org）解析
    const location = response.headers.get("Location")
    if (location) {
      try {
        const locUrl = new URL(location, targetUrl)
        if (locUrl.host === PAGES_HOST) {
          outHeaders.set(
            "Location",
            locUrl.pathname + locUrl.search + locUrl.hash
          )
        }
      } catch {
        // Location 不是可解析的 URL（极少见），原样保留
      }
    }

    // ============ 重写 Set-Cookie 头 ============
    // 把 Domain=pyq-huanyan-org-web.pages.dev 去掉，让 cookie 落到 pyq.huanyan.org
    // 浏览器看到的是 pyq.huanyan.org，cookie 也必须在这个域上才能正常发送
    const getSetCookie =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : null
    if (getSetCookie && getSetCookie.length > 0) {
      outHeaders.delete("Set-Cookie")
      for (const cookie of getSetCookie) {
        let rewritten = cookie
          // 去掉 Domain=pyq-huanyan-org-web.pages.dev（带分号前缀的）
          .replace(/;\s*Domain=pyq-huanyan-org-web\.pages\.dev/gi, "")
          // 去掉 Domain=pyq-huanyan-org-web.pages.dev（开头的）
          .replace(/^\s*Domain=pyq-huanyan-org-web\.pages\.dev;\s*/i, "")
        // 强制 Path=/（CF Pages 默认就是 /，保险起见）
        if (!/;\s*Path=/i.test(rewritten)) {
          rewritten += "; Path=/"
        }
        outHeaders.append("Set-Cookie", rewritten)
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    })
  },
}
