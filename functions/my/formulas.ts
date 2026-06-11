// ============================================
import { loadUserTheme, themeCssVar } from "../lib/theme"
// /my/formulas
// 公式填空：按 formula_id 分组，每个公式下有 N 个变体
//
// GET   渲染
// POST  action=create/update/delete
// ============================================

interface User { id: string; username: string; display_name: string | null }
interface FormulaRow { id: string; formula_id: string; variant_index: number; filled_text: string; updated_at: number }

const FORMULAS: Array<{ id: string; name: string; hint: string }> = [
  { id: "contrarian",  name: "反认知 + 痛点 + 行动", hint: "[你以为的 X] ≠ [实际是 Y] → [3 个痛点场景] → [所以先做 Z]" },
  { id: "pain",        name: "痛点具象化",         hint: "3 个具体场景让读者对号入座：你有没有 [场景 1]？[场景 2]？[场景 3]？" },
  { id: "boundary",    name: "立边界 5 句式",       hint: "我 [行为]，[原因]，[提供替代方案]" },
  { id: "story",       name: "故事万能",           hint: "背景 + 冲突 + 转折 + 结果 + 反思" },
  { id: "testimonial", name: "客户证言",           hint: "谁 + 痛点 + 做了什么 + 结果 + 原话" },
  { id: "softad",      name: "软广改写",           hint: "场景痛点 + 产品价值 + 行动召唤（不硬推）" },
  { id: "hook",        name: "金句钩子",           hint: "大部分人以为 X，其实 X / 你以为的 X，只是 X 的 X" },
  { id: "ask",         name: "互动提问",           hint: "场景 + 灵魂提问 + 引导回应" },
  { id: "review",      name: "复盘",               hint: "发生了什么 + 学到什么 + 下一步" },
  { id: "pro",         name: "专业干货",           hint: "反认知 + 步骤拆解 + 行动建议" },
  { id: "lifestyle",   name: "生活场景",           hint: "生活细节 + 个人感受 + 钩子结尾" },
]

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function getOrigin(req: Request): string {
  const url = new URL(req.url)
  const fwdHost = req.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = req.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  return `${fwdProto}://${fwdHost}`
}

function renderPage(rows: FormulaRow[], user: User, editId: string | null, theme: { start: string; end: string; solid: string }, msg?: string): Response {
  // 按 formula_id 分组
  const grouped: Record<string, FormulaRow[]> = {}
  for (const r of rows) {
    if (!grouped[r.formula_id]) grouped[r.formula_id] = []
    grouped[r.formula_id].push(r)
  }
  // 排序
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => a.variant_index - b.variant_index)
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>公式填空 · pyq</title>
${themeCssVar(theme)}
<style>${styles}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/today" class="brand">🛠️ 朋友圈工作台</a>
      <div class="user">
        <span class="user-name">${escapeHtml(user.display_name || user.username)}</span>
        <a href="/logout" class="logout-btn">🔓 退出</a>
      </div>
    </div>
  </header>
  <main>
    <nav class="subnav">
      <a href="/my/intros">👋 自我介绍</a>
      <a href="/my/cases">👥 客户案例</a>
      <a href="/my/quotes">💎 金句库</a>
      <a href="/my/formulas" class="active">✍️ 公式填空</a>
      <a href="/calendar">📅 日历</a>
    </nav>
    ${msg ? `<div class="flash flash-ok">${escapeHtml(msg)}</div>` : ''}
    <h1>✍️ 公式填空模板</h1>
    <p class="muted">11 个公式，每个填 2-3 个变体。发朋友圈时直接套用。</p>

    ${FORMULAS.map(f => {
      const variants = grouped[f.id] || []
      const editRow = editId ? variants.find(v => v.id === editId) : null
      return `
      <section class="formula-block">
        <div class="formula-head">
          <h2>${escapeHtml(f.name)}</h2>
          <code class="fid">${f.id}</code>
        </div>
        <p class="formula-hint">${escapeHtml(f.hint)}</p>
        ${variants.length === 0
          ? '<div class="empty">还没有变体</div>'
          : `<ul class="variants">${variants.map(v => `
            <li class="${editRow?.id === v.id ? 'editing' : ''}">
              <div class="variant-head">
                <span class="vidx">变体 ${v.variant_index}</span>
              </div>
              ${editRow?.id === v.id
                ? `<form method="POST" action="/my/formulas" class="variant-edit">
                    <input type="hidden" name="_action" value="update">
                    <input type="hidden" name="id" value="${v.id}">
                    <textarea name="filled_text" rows="3" required>${escapeHtml(v.filled_text)}</textarea>
                    <div class="actions">
                      <button type="submit" class="btn-primary btn-sm">保存</button>
                      <a href="/my/formulas" class="btn-link btn-sm">取消</a>
                    </div>
                  </form>`
                : `<pre class="vtext">${escapeHtml(v.filled_text)}</pre>
                  <div class="variant-actions">
                    <a href="/my/formulas?edit=${v.id}" class="btn-sm">✏️ 编辑</a>
                    <form method="POST" action="/my/formulas" style="display:inline" onsubmit="return confirm('删除？')">
                      <input type="hidden" name="_action" value="delete">
                      <input type="hidden" name="id" value="${v.id}">
                      <button type="submit" class="btn-sm btn-danger">🗑 删除</button>
                    </form>
                  </div>`}
            </li>
          `).join('')}</ul>`}
        <form method="POST" action="/my/formulas" class="add-variant">
          <input type="hidden" name="_action" value="create">
          <input type="hidden" name="formula_id" value="${f.id}">
          <div class="row">
            <input name="variant_index" type="number" min="1" max="99" placeholder="变体 #" required style="width: 100px">
            <input name="filled_text" placeholder="填入公式的具体内容..." required style="flex: 1">
            <button type="submit" class="btn-primary btn-sm">➕ 加</button>
          </div>
        </form>
      </section>
      `
    }).join('')}
  </main>
</body>
</html>`
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = ctx.data.user as User | undefined
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const url = new URL(ctx.request.url)
  const editId = url.searchParams.get("edit")
  const saved = url.searchParams.get("saved")
  let msg: string | undefined
  if (saved === "1") msg = "✓ 已保存"
  if (saved === "deleted") msg = "✓ 已删除"

  const rows = await ctx.env.DB.prepare(
    "SELECT * FROM formula_templates WHERE user_id = ? ORDER BY formula_id, variant_index"
  ).bind(user.id).all<FormulaRow>()
  const theme = await loadUserTheme(ctx.env, user.id)
  return renderPage(rows.results || [], user, editId, theme, msg)
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = ctx.data.user as User | undefined
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const form = await ctx.request.formData()
  const action = String(form.get("_action") || "create")

  if (action === "delete") {
    const id = String(form.get("id") || "")
    if (id) await ctx.env.DB.prepare("DELETE FROM formula_templates WHERE id = ? AND user_id = ?").bind(id, user.id).run()
    return Response.redirect(getOrigin(ctx.request) + "/my/formulas?saved=deleted", 302)
  }

  if (action === "update") {
    const id = String(form.get("id") || "")
    const filledText = String(form.get("filled_text") || "").trim()
    if (!id || !filledText) return new Response("缺少 id 或内容", { status: 400 })
    await ctx.env.DB.prepare(
      "UPDATE formula_templates SET filled_text=?, updated_at=? WHERE id=? AND user_id=?"
    ).bind(filledText, Date.now(), id, user.id).run()
    return Response.redirect(getOrigin(ctx.request) + "/my/formulas?saved=1", 302)
  }

  // create
  const formulaId = String(form.get("formula_id") || "").trim()
  const variantIndex = parseInt(String(form.get("variant_index") || "0"))
  const filledText = String(form.get("filled_text") || "").trim()
  if (!formulaId || !variantIndex || !filledText) {
    return new Response("formula_id / variant_index / filled_text 必填", { status: 400 })
  }
  if (!FORMULAS.some(f => f.id === formulaId)) {
    return new Response(`formula_id 必须是：${FORMULAS.map(f => f.id).join(", ")}`, { status: 400 })
  }

  try {
    await ctx.env.DB.prepare(
      "INSERT INTO formula_templates (id, user_id, formula_id, variant_index, filled_text, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), user.id, formulaId, variantIndex, filledText, Date.now()).run()
  } catch (err: any) {
    if (String(err?.message || "").includes("UNIQUE")) {
      return new Response(`公式 ${formulaId} 的第 ${variantIndex} 变体已存在`, { status: 409 })
    }
    throw err
  }
  return Response.redirect(getOrigin(ctx.request) + "/my/formulas?saved=1", 302)
}

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; line-height: 1.6; padding-bottom: 60px; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
.topbar-inner { max-width: 760px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.brand { font-weight: 700; font-size: 16px; text-decoration: none; color: #1a202c; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.user-name { color: #4a5568; }
.logout-btn { padding: 4px 10px; background: #fff; color: #c53030; border: 1px solid #fc8181; border-radius: 16px; text-decoration: none; font-size: 12px; }
main { max-width: 760px; margin: 0 auto; padding: 20px; }
.subnav { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.subnav a { padding: 6px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; text-decoration: none; color: #4a5568; font-size: 13px; }
.subnav a.active, .subnav a:hover { background: var(--t); color: #fff; border-color: var(--t); }
.flash { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.flash-ok { background: #c6f6d5; color: #22543d; }
h1 { font-size: 24px; margin-bottom: 6px; color: #2d3748; }
.muted { color: #a0aec0; font-size: 14px; margin-bottom: 20px; }
.formula-block { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.formula-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.formula-head h2 { font-size: 18px; color: #2d3748; }
.fid { font-family: monospace; font-size: 11px; color: #a0aec0; background: #edf2f7; padding: 1px 6px; border-radius: 3px; }
.formula-hint { color: #4a5568; font-size: 13px; margin-bottom: 12px; padding: 6px 10px; background: #fef5e7; border-radius: 6px; }
.variants { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.variants li { background: #f7fafc; border: 1px solid #edf2f7; border-radius: 8px; padding: 10px 12px; }
.variants li.editing { background: #fef5e7; border-color: #fbd38d; }
.variant-head { margin-bottom: 4px; }
.vidx { font-size: 11px; color: #667eea; background: #ebf4ff; padding: 1px 8px; border-radius: 3px; font-weight: 600; }
.vtext { font-family: inherit; white-space: pre-wrap; font-size: 14px; color: #2d3748; line-height: 1.5; margin: 0; }
.variant-actions { display: flex; gap: 6px; margin-top: 8px; }
.variant-edit textarea { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 15px; font-family: inherit; resize: vertical; }
.variant-edit .actions { margin-top: 8px; padding-top: 8px; }
.btn-sm { padding: 6px 12px; font-size: 13px; border-radius: 6px; }
.btn-primary { background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border: none; font-weight: 600; cursor: pointer; }
.btn-primary:hover { opacity: 0.92; }
.btn-link { background: transparent; color: #4a5568; text-decoration: none; }
.btn-link:hover { color: #2d3748; }
.empty { padding: 20px; text-align: center; color: #a0aec0; background: #f7fafc; border-radius: 6px; font-size: 13px; }
.add-variant { background: #f7fafc; padding: 10px; border-radius: 6px; }
.add-variant .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.add-variant input { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; font-family: inherit; }
.add-variant input:focus { outline: none; border-color: #667eea; }
@media (max-width: 640px) { .topbar-inner, main { padding: 12px 16px; } .formula-block { padding: 16px; } .add-variant .row { flex-direction: column; align-items: stretch; } .add-variant input[type=number] { width: 100% !important; } }
`
