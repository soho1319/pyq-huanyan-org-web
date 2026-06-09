interface Env {
  BASIC_AUTH_USER?: string
  BASIC_AUTH_PASSWORD?: string
}

function unauthorized(): Response {
  return new Response("需要密码才能访问。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="内容营销朋友圈小助手", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export async function onRequest(context: {
  request: Request
  env: Env
  next: () => Promise<Response>
}): Promise<Response> {
  const { request, env, next } = context
  const expectedUser = env.BASIC_AUTH_USER || "admin"
  const expectedPassword = env.BASIC_AUTH_PASSWORD
  if (!expectedPassword) return unauthorized()

  const auth = request.headers.get("Authorization") || ""
  if (!auth.startsWith("Basic ")) return unauthorized()

  let user = ""
  let password = ""
  try {
    const decoded = atob(auth.slice(6))
    const index = decoded.indexOf(":")
    user = index >= 0 ? decoded.slice(0, index) : decoded
    password = index >= 0 ? decoded.slice(index + 1) : ""
  } catch {
    return unauthorized()
  }

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(password, expectedPassword)) {
    return unauthorized()
  }
  return next()
}
