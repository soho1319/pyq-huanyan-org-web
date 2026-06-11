// ============================================
// /history
// AI 草稿历史：按日期倒序，看每天 3 条候选 + 哪条被用
// ============================================

import { getCurrentUser } from "./lib/auth"
import { loadUserTheme, themeCssVar } from "./lib/theme"

interface AiDraft {
  id: string
  date: string
  today_type: string
  addon: string | null
  draft_1: string
  draft_2: string
  draft_3: string
  chosen_index: number | null
  chosen_text: string | null
  model: string | null
  used_at: number | null
  created_at: number
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database; SESSION_SECRET?: string }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = await getCurrentUser(ctx.request, ctx.env)
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  const rows = await ctx.env.DB.prepare(
    "SELECT id, date, today_type, addon, draft_1, draft_2, draft_3, chosen_index, chosen_text, model, used_at, created_at FROM ai_drafts WHERE user_id = ? ORDER BY created_at DESC LIMIT 200"
  ).bind(user.id).all<AiDraft>()

  const drafts = rows.results || []
  const theme = await loadUserTheme(ctx.env, user.id)

  // 统计
  const totalDays = drafts.length
  const usedDays = drafts.filter(d => d.chosen_index).length
  const totalChars = drafts.reduce((sum, d) => sum + (d.chosen_text?.length || 0), 0)

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>草稿历史 · pyq</title>
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
      <a href="/today">📅 今日</a>
      <a href="/my/intros">👋 自我介绍</a>
      <a href="/my/cases">👥 客户案例</a>
      <a href="/my/quotes">💎 金句库</a>
      <a href="/my/formulas">✍️ 公式填空</a>
      <a href="/calendar">🗓 日历</a>
      <a href="/history" class="active">📜 草稿历史</a>
      <a href="/my/types">🎨 颜色</a>
    </nav>

    <h1>📜 AI 草稿历史</h1>
    <div class="stats">
      <div class="stat"><span class="stat-num">${totalDays}</span><span class="stat-label">总生成</span></div>
      <div class="stat"><span class="stat-num">${usedDays}</span><span class="stat-label">已用</span></div>
      <div class="stat"><span class="stat-num">${totalChars}</span><span class="stat-label">已发字数</span></div>
    </div>

    ${drafts.length === 0
      ? '<div class="empty">还没有 AI 草稿。<a href="/today">去今日页生成 3 条 →</a></div>'
      : drafts.map(d => renderDay(d)).join('')}
  </main>
  <script>
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.target
        const text = document.getElementById(targetId)?.textContent || ''
        try {
          await navigator.clipboard.writeText(text)
          const orig = btn.textContent
          btn.textContent = '✓ 已复制'
          btn.style.background = '#48bb78'
          btn.style.color = '#fff'
          setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = '' }, 1500)
        } catch (e) {
          const range = document.createRange()
          range.selectNodeContents(document.getElementById(targetId))
          const sel = window.getSelection()
          sel.removeAllRanges()
          sel.addRange(range)
          alert('已选中文字，Ctrl+C 复制')
        }
      })
    })
  </script>
</body>
</html>`
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}

function renderDay(d: AiDraft): string {
  const drafts = [d.draft_1, d.draft_2, d.draft_3].filter(s => s && s.trim())
  const used = d.chosen_index
  const usedAt = d.used_at ? new Date(d.used_at).toLocaleString("zh-CN", { hour12: false }) : ""
  return `
  <section class="card day-card">
    <div class="card-head">
      <h2>📅 ${d.date}</h2>
      <span class="type-badge">${escapeHtml(d.today_type)}</span>
      ${used ? `<span class="used-badge">✓ 已用第 ${used} 条</span>` : '<span class="unused-badge">○ 未用</span>'}
    </div>
    ${d.addon ? `<div class="addon-line">📝 加餐：${escapeHtml(d.addon)}</div>` : ''}
    ${d.model ? `<div class="model-line">🤖 ${escapeHtml(d.model)}${usedAt ? ' · ' + usedAt : ''}</div>` : ''}
    <ul class="draft-list">
      ${drafts.map((text, i) => {
        const isChosen = used === (i + 1)
        return `<li class="draft-item ${isChosen ? 'chosen' : ''}">
          <div class="draft-head">
            <span class="draft-num">候选 ${i + 1}</span>
            <span class="draft-len">${text.length} 字</span>
            ${isChosen ? '<span class="chosen-tag">★ 已发</span>' : ''}
          </div>
          <pre class="draft-text" id="h_${d.id}_${i}">${escapeHtml(text)}</pre>
          <button type="button" class="btn-copy" data-target="h_${d.id}_${i}">📋 复制</button>
        </li>`
      }).join('')}
    </ul>
  </section>
  `
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
h1 { font-size: 24px; margin-bottom: 12px; color: #2d3748; }
.stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.stat { flex: 1; min-width: 90px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border-radius: 10px; padding: 14px; text-align: center; }
.stat-num { display: block; font-size: 22px; font-weight: 700; }
.stat-label { font-size: 12px; opacity: 0.9; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.card-head h2 { font-size: 18px; color: #2d3748; }
.type-badge { padding: 2px 8px; background: #edf2f7; color: #2d3748; border-radius: 4px; font-size: 12px; }
.used-badge { padding: 2px 8px; background: #c6f6d5; color: #22543d; border-radius: 4px; font-size: 12px; font-weight: 600; }
.unused-badge { padding: 2px 8px; background: #f7fafc; color: #a0aec0; border-radius: 4px; font-size: 12px; }
.addon-line { background: #fef5e7; padding: 6px 10px; border-radius: 6px; font-size: 13px; margin-bottom: 8px; color: #744210; }
.model-line { font-size: 11px; color: #a0aec0; margin-bottom: 10px; }
.draft-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.draft-item { background: #f7fafc; border: 1px solid #edf2f7; border-radius: 8px; padding: 12px; }
.draft-item.chosen { background: #f0fff4; border-color: #9ae6b4; }
.draft-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.draft-num { font-weight: 600; color: #4a5568; font-size: 13px; }
.draft-len { font-size: 11px; color: #a0aec0; }
.chosen-tag { padding: 1px 8px; background: #48bb78; color: #fff; border-radius: 3px; font-size: 11px; font-weight: 600; }
.draft-text { font-family: inherit; font-size: 14px; color: #2d3748; line-height: 1.6; white-space: pre-wrap; word-break: break-word; background: #fff; padding: 10px; border-radius: 6px; margin-bottom: 8px; max-height: 200px; overflow-y: auto; }
.btn-copy { padding: 6px 12px; background: #fff; color: #4a5568; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-copy:hover { background: var(--t); color: #fff; border-color: var(--t); }
.empty { padding: 40px; text-align: center; color: #a0aec0; background: #fff; border: 1px dashed #cbd5e0; border-radius: 12px; }
.empty a { color: var(--t); }
@media (max-width: 640px) { .topbar-inner, main { padding: 12px 16px; } .card { padding: 14px; } .stat { padding: 10px; } }
`
