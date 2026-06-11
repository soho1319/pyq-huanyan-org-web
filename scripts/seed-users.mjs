// ============================================
// seed-users.mjs · 批量创建初始用户
// 用法：
//   1. 修改下面的 USERS 数组（改 username / password / display_name）
//   2. node scripts/seed-users.mjs           # 生成 seed.sql
//   3. npx wrangler d1 execute pyq-db --remote --file=scripts/seed.sql
//   4. 删掉 scripts/seed.sql（密码以 hash 形式无所谓，留着也可）
// ============================================

import { writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { webcrypto } from "node:crypto"

const PBKDF2_ITER = 100_000

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function hashPassword(plain, pepper = "") {
  const enc = new TextEncoder()
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const key = await webcrypto.subtle.importKey(
    "raw",
    enc.encode(plain + pepper),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    key,
    256
  )
  return `pbkdf2$${PBKDF2_ITER}$${b64urlEncode(salt)}$${b64urlEncode(bits)}`
}

const USERS = [
  { username: "admin", password: "pyq2024", display_name: "admin", is_admin: 1 },
  { username: "cici",  password: "pyq2024", display_name: "cici",  is_admin: 0 },
  { username: "cc",    password: "pyq2024", display_name: "cc",    is_admin: 0 },
]

async function main() {
  const now = Date.now()
  const rows = []
  for (const u of USERS) {
    const id = randomUUID()
    const hash = await hashPassword(u.password)
    rows.push({ id, ...u, hash, now })
  }

  // 生成 SQL
  const values = rows.map(r =>
    `('${r.id}','${r.username}','${r.hash}','${r.display_name}',${r.is_admin},${r.now})`
  ).join(",\n  ")

  const sql = `-- ============================================
-- 自动生成 · seed 3 个初始用户
-- 生成时间：${new Date().toISOString()}
-- ============================================

-- 先清空（可选，要保留注释掉下一行）
DELETE FROM users;

INSERT INTO users (id, username, password_hash, display_name, is_admin, created_at) VALUES
  ${values};

SELECT id, username, display_name, is_admin, created_at FROM users ORDER BY created_at;
`

  writeFileSync("scripts/seed.sql", sql, "utf-8")
  console.log("✅ 已生成 scripts/seed.sql")
  console.log("")
  console.log("用户清单：")
  for (const r of rows) {
    const role = r.is_admin ? "admin  " : "普通用户"
    console.log(`  ${role}  ${r.username.padEnd(8)} password=${USERS.find(u => u.username === r.username).password}`)
  }
  console.log("")
  console.log("下一步：")
  console.log("  npx wrangler d1 execute pyq-db --remote --file=scripts/seed.sql")
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
