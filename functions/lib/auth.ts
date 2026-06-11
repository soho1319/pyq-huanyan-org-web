// ============================================
// 多用户 Auth 共享库
// - PBKDF2-SHA256 密码 hash（Workers/Pages 兼容，no WASM）
// - HMAC-SHA256 session cookie 签名
// - D1 user 查询
// ============================================

export interface Env {
  SESSION_SECRET?: string
  D1_PASSWORD_PEPPER?: string  // 可选，给密码 hash 加额外 pepper
  DB?: D1Database
}

export interface User {
  id: string
  username: string
  display_name: string | null
  is_admin: number
  cycle_start_date?: string | null   // D55-15: 账号启用日 = 日排/周排/月排起点
}

const PBKDF2_ITER = 100_000
const SESSION_TTL = 60 * 60 * 24 * 7 // 7 天
export const COOKIE_NAME = "pyq_session"

// ============================================
// 编码工具
// ============================================
function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  while (s.length % 4) s += "="
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// ============================================
// 密码 hash（PBKDF2-SHA256）
// 格式：pbkdf2$<iter>$<saltB64>$<hashB64>
// ============================================
export async function hashPassword(plain: string, pepper = ""): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(plain + pepper),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    key,
    256
  )
  return `pbkdf2$${PBKDF2_ITER}$${b64urlEncode(salt)}$${b64urlEncode(bits)}`
}

export async function verifyPassword(
  plain: string,
  stored: string,
  pepper = ""
): Promise<boolean> {
  try {
    const parts = stored.split("$")
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false
    const iter = parseInt(parts[1])
    const salt = b64urlDecode(parts[2])
    const expected = b64urlDecode(parts[3])
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(plain + pepper),
      "PBKDF2",
      false,
      ["deriveBits"]
    )
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
      key,
      expected.length * 8
    )
    return timingSafeEqual(new Uint8Array(bits), expected)
  } catch {
    return false
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i]
  return out === 0
}

// ============================================
// Session cookie 签名（HMAC-SHA256）
// Cookie 格式：<expiry>.<user>.<userid>.<sig>
// ============================================
async function hmac(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data))
  return b64urlEncode(sig)
}

export async function signSessionCookie(
  user: { username: string; id: string },
  secret: string,
  ttlSec = SESSION_TTL
): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + ttlSec
  const payload = `${expiry}.${user.username}.${user.id}`
  const sig = await hmac(secret, payload)
  return `${payload}.${sig}`
}

export interface SessionData {
  expiry: number
  username: string
  userid: string
}

export async function verifySessionCookie(
  cookie: string,
  secret: string
): Promise<SessionData | null> {
  const parts = cookie.split(".")
  if (parts.length !== 4) return null
  const [expiry, username, userid, sig] = parts
  if (!/^\d+$/.test(expiry) || parseInt(expiry) < Math.floor(Date.now() / 1000)) {
    return null
  }
  const expected = await hmac(secret, `${expiry}.${username}.${userid}`)
  if (!timingSafeEqualStr(sig, expected)) return null
  return { expiry: parseInt(expiry), username, userid }
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

// ============================================
// 从请求读 session cookie → 查 D1 → 返回 user
// 返回 null 表示未登录 / cookie 无效 / user 不存在
// ============================================
export function getCookieValue(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("Cookie") || ""
  const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  const m = cookieHeader.match(re)
  return m ? decodeURIComponent(m[1]) : null
}

export async function getCurrentUser(req: Request, env: Env): Promise<User | null> {
  const secret = env.SESSION_SECRET
  if (!secret) return null
  const cookie = getCookieValue(req, COOKIE_NAME)
  if (!cookie) return null
  const session = await verifySessionCookie(cookie, secret)
  if (!session) return null
  if (!env.DB) return null
  const row = await env.DB.prepare(
    "SELECT id, username, display_name, is_admin, cycle_start_date FROM users WHERE id = ?"
  ).bind(session.userid).first<User | null>()
  return row
}

export function buildSessionCookie(value: string, ttlSec = SESSION_TTL): string {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSec}`
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export function newId(): string {
  return crypto.randomUUID()
}
