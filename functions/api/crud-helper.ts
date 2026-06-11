// ============================================
// CRUD API 共享 helper
// - 取当前 user（从 context.data.user，已由 _middleware 注入）
// - 强制 user_id 隔离
// - 标准化 JSON 响应
// ============================================

export interface User {
  id: string
  username: string
  display_name: string | null
  is_admin: number
  cycle_start_date?: string | null   // D55-17: 排期起点
}

export interface CrudEnv {
  DB?: D1Database
}

export interface CrudContext {
  request: Request
  env: CrudEnv
  data: Record<string, unknown>
}

export function getUser(ctx: CrudContext): User {
  const u = ctx.data.user as User | undefined
  if (!u) {
    throw new CrudError("未登录", 401)
  }
  return u
}

export class CrudError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

export function jsonError(err: unknown): Response {
  if (err instanceof CrudError) {
    return json({ error: err.message }, err.status)
  }
  console.error("[crud]", err)
  const msg = err instanceof Error ? err.message : String(err)
  return json({ error: msg }, 500)
}

export function newId(): string {
  return crypto.randomUUID()
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new CrudError("请求体不是合法 JSON", 400)
  }
}

export function requireFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === "") {
      throw new CrudError(`缺少必填字段：${f}`, 400)
    }
  }
}
