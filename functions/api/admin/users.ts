// ============================================
// /api/admin/users
// 管理员用户管理 CRUD
// - GET    列出所有用户
// - POST   创建新用户 { username, password, display_name?, is_admin? }
// - PUT    更新用户（重置密码 / 改 display_name）{ id, password?, display_name?, is_admin? }
// - DELETE 删除用户 { id }
//
// 权限：仅 admin 可访问
// ============================================

import { getCurrentUser, hashPassword, newId, type Env } from "../../lib/auth"

interface User {
  id: string
  username: string
  display_name: string | null
  is_admin: number
  created_at: number
  updated_at: number | null
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function requireAdmin(context: { request: Request; env: Env; data: Record<string, unknown> }): { ok: true; userId: string } | { ok: false; response: Response } {
  const user = context.data.user as { id: string; is_admin: number } | undefined
  if (!user || user.is_admin !== 1) {
    return { ok: false, response: json({ error: "需要 admin 权限" }, 403) }
  }
  return { ok: true, userId: user.id }
}

export async function onRequestGet(context: {
  request: Request
  env: Env
  data: Record<string, unknown>
}): Promise<Response> {
  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response
  if (!context.env.DB) return json({ error: "D1 未配置" }, 500)

  const users = await context.env.DB.prepare(
    "SELECT id, username, display_name, is_admin, created_at, updated_at FROM users ORDER BY created_at ASC"
  ).all<User>()
  return json({ users: users.results || [] })
}

export async function onRequestPost(context: {
  request: Request
  env: Env
  data: Record<string, unknown>
}): Promise<Response> {
  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response
  if (!context.env.DB) return json({ error: "D1 未配置" }, 500)

  let body: { username?: string; password?: string; display_name?: string; is_admin?: number }
  try {
    body = await context.request.json()
  } catch {
    return json({ error: "请求体不是合法 JSON" }, 400)
  }

  const username = (body.username || "").trim()
  const password = body.password || ""
  if (!username || username.length < 2) {
    return json({ error: "用户名至少 2 字符" }, 400)
  }
  if (!password || password.length < 6) {
    return json({ error: "密码至少 6 字符" }, 400)
  }
  const isAdmin = body.is_admin === 1 ? 1 : 0
  const displayName = (body.display_name || username).trim()
  const pepper = context.env.D1_PASSWORD_PEPPER || ""
  const passwordHash = await hashPassword(password, pepper)
  const id = newId()
  const now = Date.now()

  try {
    await context.env.DB.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, username, passwordHash, displayName, isAdmin, now).run()
  } catch (err: any) {
    if (String(err?.message || "").includes("UNIQUE")) {
      return json({ error: `用户名「${username}」已存在` }, 409)
    }
    return json({ error: err?.message || "创建失败" }, 500)
  }

  return json({ ok: true, user: { id, username, display_name: displayName, is_admin: isAdmin } }, 201)
}

export async function onRequestPut(context: {
  request: Request
  env: Env
  data: Record<string, unknown>
}): Promise<Response> {
  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response
  if (!context.env.DB) return json({ error: "D1 未配置" }, 500)

  let body: { id?: string; password?: string; display_name?: string; is_admin?: number }
  try {
    body = await context.request.json()
  } catch {
    return json({ error: "请求体不是合法 JSON" }, 400)
  }

  const id = body.id
  if (!id) return json({ error: "缺少 id" }, 400)

  // 不允许 admin 把自己降级（防自废）
  if (id === auth.userId && body.is_admin === 0) {
    return json({ error: "不能把自己降级为普通用户" }, 400)
  }

  const updates: string[] = []
  const values: unknown[] = []

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return json({ error: "密码至少 6 字符" }, 400)
    }
    const pepper = context.env.D1_PASSWORD_PEPPER || ""
    const newHash = await hashPassword(body.password, pepper)
    updates.push("password_hash = ?")
    values.push(newHash)
  }

  if (typeof body.display_name === "string") {
    updates.push("display_name = ?")
    values.push(body.display_name.trim())
  }

  if (body.is_admin === 0 || body.is_admin === 1) {
    updates.push("is_admin = ?")
    values.push(body.is_admin)
  }

  if (updates.length === 0) {
    return json({ error: "没有要更新的字段" }, 400)
  }

  updates.push("updated_at = ?")
  values.push(Date.now())
  values.push(id)

  const result = await context.env.DB.prepare(
    `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run()

  if (!result.success || result.meta?.changes === 0) {
    return json({ error: "用户不存在或未变更" }, 404)
  }

  return json({ ok: true })
}

export async function onRequestDelete(context: {
  request: Request
  env: Env
  data: Record<string, unknown>
}): Promise<Response> {
  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response
  if (!context.env.DB) return json({ error: "D1 未配置" }, 500)

  const url = new URL(context.request.url)
  const id = url.searchParams.get("id")
  if (!id) return json({ error: "缺少 id 参数（?id=...）" }, 400)

  // 不允许 admin 删自己
  if (id === auth.userId) {
    return json({ error: "不能删除自己" }, 400)
  }

  const result = await context.env.DB.prepare(
    "DELETE FROM users WHERE id = ?"
  ).bind(id).run()

  if (!result.success || result.meta?.changes === 0) {
    return json({ error: "用户不存在" }, 404)
  }
  return json({ ok: true })
}
