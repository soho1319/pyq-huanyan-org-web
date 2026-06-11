// ============================================
// D55-7: /api/register 邀请制注册 API
//
// POST { code, username, display_name, password }
//   1. 校验 invite_code：存在、active、未过期、used_count < max_uses
//   2. 校验 username：3-32 字符 [a-zA-Z0-9_]，唯一
//   3. 校验 password：≥ 8 字符
//   4. 写 users 表（is_admin=0）
//   5. 写 invite_redemptions + UPDATE invite_codes.used_count + 1
//   6. 签发 session cookie → 302
//
// 支持 form-urlencoded / JSON
// ============================================

import {
  buildSessionCookie,
  hashPassword,
  newId,
  signSessionCookie,
  type Env as AuthEnv,
} from "../lib/auth"

interface Env extends AuthEnv {
  D1_PASSWORD_PEPPER?: string
  DB?: D1Database
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/

export async function onRequestPost(ctx: {
  request: Request
  env: Env
}): Promise<Response> {
  const { request, env } = ctx
  const url = new URL(request.url)
  const fwdHost = request.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  const origin = `${fwdProto}://${fwdHost}`

  if (!env.DB) return json({ error: "服务未配置 D1" }, 500)
  if (!env.SESSION_SECRET) return json({ error: "服务未配置 SESSION_SECRET" }, 500)

  // 解析 body
  let code = "", username = "", display_name = "", password = ""
  try {
    const ct = (request.headers.get("Content-Type") || "").toLowerCase()
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await request.formData()
      code = String(form.get("code") || "").trim().toUpperCase()
      username = String(form.get("username") || "").trim()
      display_name = String(form.get("display_name") || "").trim()
      password = String(form.get("password") || "")
    } else if (ct.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>
      code = String(body.code || "").trim().toUpperCase()
      username = String(body.username || "").trim()
      display_name = String(body.display_name || "").trim()
      password = String(body.password || "")
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      code = (params.get("code") || "").trim().toUpperCase()
      username = (params.get("username") || "").trim()
      display_name = (params.get("display_name") || "").trim()
      password = params.get("password") || ""
    }
  } catch {
    return json({ error: "请求格式错误" }, 400)
  }

  // 校验
  if (!code) return json({ error: "缺少邀请码" }, 400)
  if (!USERNAME_RE.test(username)) {
    return json({ error: "账号必须是 3-32 位字母/数字/下划线" }, 400)
  }
  if (password.length < 8) {
    return json({ error: "密码至少 8 位" }, 400)
  }
  if (!display_name) display_name = username

  // 查 invite_code
  const inv = await env.DB.prepare(
    "SELECT id, max_uses, used_count, expires_at, is_active FROM invite_codes WHERE code = ?"
  ).bind(code).first<{
    id: string
    max_uses: number
    used_count: number
    expires_at: number | null
    is_active: number
  } | null>()

  if (!inv) return json({ error: "邀请码无效" }, 400)
  if (inv.is_active !== 1) return json({ error: "邀请码已被撤销" }, 400)
  if (inv.expires_at && inv.expires_at < Date.now()) {
    return json({ error: "邀请码已过期" }, 400)
  }
  if (inv.used_count >= inv.max_uses) {
    return json({ error: "邀请码已用完" }, 400)
  }

  // 检查 username 唯一
  const exist = await env.DB.prepare(
    "SELECT id FROM users WHERE username = ?"
  ).bind(username).first<{ id: string } | null>()
  if (exist) return json({ error: "账号已被占用" }, 400)

  // 写 users
  const userId = newId()
  const passwordHash = await hashPassword(password, env.D1_PASSWORD_PEPPER || "")
  const now = Date.now()

  await env.DB.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, is_admin, created_at, updated_at, cycle_start_date) VALUES (?, ?, ?, ?, 0, ?, ?, ?)"
  ).bind(userId, username, passwordHash, display_name, now, now, new Date().toISOString().slice(0, 10)).run()

  // 写 invite_redemptions + 更新 used_count
  await env.DB.prepare(
    "INSERT INTO invite_redemptions (id, code_id, user_id, redeemed_at) VALUES (?, ?, ?, ?)"
  ).bind(newId(), inv.id, userId, now).run()

  await env.DB.prepare(
    "UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?"
  ).bind(inv.id).run()

  // 签发 session
  const cookieValue = await signSessionCookie(
    { username, id: userId },
    env.SESSION_SECRET
  )

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/`,
      "Set-Cookie": buildSessionCookie(cookieValue),
      "Cache-Control": "no-store",
    },
  })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}
