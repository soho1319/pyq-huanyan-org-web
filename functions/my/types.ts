// ============================================
// /my/dims（D55 彻底切换：颜色按 7 维度）
// 自定义 7 维度按钮颜色 + UI 主题色
//
// GET   渲染 7 个颜色选择器 + 2 个主题色
// POST  保存到 user_settings
// ============================================

import { DEFAULT_THEME, loadUserTheme, themeCssVar } from "../lib/theme"
import { DIMS, DIM_IDS, SLOTS, SLOT_IDS, loadEnabledSlots, type Dim, type SlotId } from "../lib/schedule-constants"

interface User { id: string; username: string; display_name: string | null }

// D55: 7 维度默认色（每维度用课程术语的语义化配色）
const DEFAULT_COLORS: Record<Dim, { bg: string; fg: string; label: string }> = {
  A: { bg: "#fef5e7", fg: "#c05621", label: "美学" },      // 观赏价值 → 暖橙
  B: { bg: "#ebf4ff", fg: "#2c5282", label: "专业" },      // 专业价值 → 蓝
  C: { bg: "#faf5ff", fg: "#553c9a", label: "情绪" },      // 情绪价值 → 紫
  D: { bg: "#e6fffa", fg: "#234e52", label: "身份" },      // 身份维度 → 青
  E: { bg: "#f0fff4", fg: "#22543d", label: "生活" },      // 生活维度 → 绿
  F: { bg: "#fff5f5", fg: "#c53030", label: "思想" },      // 思想维度 → 红
  G: { bg: "#fdf4ff", fg: "#86198f", label: "关系" },      // 关系维度 → 玫紫
}

const DIM_ORDER = DIM_IDS  // D55: 从 lib/schedule-constants 复用

// D55: 5 段（早/午/傍/晚/夜）勾选
const slotLabelMap: Record<SlotId, string> = {
  morning: "早 8:00",
  noon:    "午 12:30",
  evening: "傍晚 18:00",
  late:    "晚 20:00",
  night:   "夜 22:30",
}

// D55: 每维度 3 个快选色（深浅梯度）
const DIM_PRESETS: Record<Dim, Array<{ bg: string; fg: string; label: string }>> = {
  A: [
    { bg: "#fef5e7", fg: "#c05621", label: "浅" },
    { bg: "#fbd38d", fg: "#7b341e", label: "中" },
    { bg: "#c05621", fg: "#ffffff", label: "深" },
  ],
  B: [
    { bg: "#ebf4ff", fg: "#2c5282", label: "浅" },
    { bg: "#90cdf4", fg: "#1a365d", label: "中" },
    { bg: "#2b6cb0", fg: "#ffffff", label: "深" },
  ],
  C: [
    { bg: "#faf5ff", fg: "#553c9a", label: "浅" },
    { bg: "#d6bcfa", fg: "#44337a", label: "中" },
    { bg: "#6b46c1", fg: "#ffffff", label: "深" },
  ],
  D: [
    { bg: "#e6fffa", fg: "#234e52", label: "浅" },
    { bg: "#81e6d9", fg: "#1d4044", label: "中" },
    { bg: "#2c7a7b", fg: "#ffffff", label: "深" },
  ],
  E: [
    { bg: "#f0fff4", fg: "#22543d", label: "浅" },
    { bg: "#9ae6b4", fg: "#1c4532", label: "中" },
    { bg: "#276749", fg: "#ffffff", label: "深" },
  ],
  F: [
    { bg: "#fff5f5", fg: "#c53030", label: "浅" },
    { bg: "#fc8181", fg: "#742a2a", label: "中" },
    { bg: "#c53030", fg: "#ffffff", label: "深" },
  ],
  G: [
    { bg: "#fdf4ff", fg: "#86198f", label: "浅" },
    { bg: "#d8b4fe", fg: "#6b21a8", label: "中" },
    { bg: "#86198f", fg: "#ffffff", label: "深" },
  ],
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function getOrigin(req: Request): string {
  const url = new URL(req.url)
  const fwdHost = req.headers.get("X-Forwarded-Host") || url.host
  const fwdProto = req.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  return `${fwdProto}://${fwdHost}`
}

function isHex(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)
}

// ★ swatch GET 链接的写入：检测 url 里 set_/bulk_set/set_theme，apply 后写 D1
async function applySwatchFromQuery(env: { DB?: D1Database }, userId: string, url: URL): Promise<string | null> {
  if (!env.DB) return null

  const setTheme = url.searchParams.get("set_theme")
  const bulkSet = url.searchParams.get("bulk_set")
  // 检测任意 set_<dim>
  let swatchSet: { dim: Dim; bg: string; fg: string } | null = null
  for (const d of DIM_ORDER) {
    const v = url.searchParams.get(`set_${d}`)
    if (v) {
      const parts = v.split(",")
      if (parts.length === 2 && isHex(parts[0]) && isHex(parts[1])) {
        swatchSet = { dim: d, bg: parts[0], fg: parts[1] }
        break
      }
    }
  }

  if (!setTheme && !bulkSet && !swatchSet) return null

  // 读当前
  const row = await env.DB.prepare(
    "SELECT dim_colors, theme_start, theme_end FROM user_settings WHERE user_id = ?"
  ).bind(userId).first<{ dim_colors: string; theme_start: string; theme_end: string }>()
  let colors: Record<string, { bg: string; fg: string }> = {}
  for (const d of DIM_ORDER) colors[d] = { ...DEFAULT_COLORS[d] }
  let themeStart = DEFAULT_THEME.start
  let themeEnd = DEFAULT_THEME.end
  if (row) {
    try {
      const stored = JSON.parse(row.dim_colors || "{}")
      for (const d of DIM_ORDER) colors[d] = { ...DEFAULT_COLORS[d], ...(stored[d] || {}) }
    } catch {}
    themeStart = row.theme_start || DEFAULT_THEME.start
    themeEnd = row.theme_end || DEFAULT_THEME.end
  }

  // apply
  if (swatchSet) {
    colors[swatchSet.dim] = { bg: swatchSet.bg, fg: swatchSet.fg }
  }
  if (bulkSet) {
    const shadeIdx = bulkSet === "all_light" ? 0 : bulkSet === "all_mid" ? 1 : bulkSet === "all_deep" ? 2 : -1
    if (shadeIdx >= 0) {
      for (const d of DIM_ORDER) {
        const preset = DIM_PRESETS[d]?.[shadeIdx]
        if (preset) colors[d] = { bg: preset.bg, fg: preset.fg }
      }
    }
  }
  if (setTheme) {
    const parts = setTheme.split(",")
    if (parts.length === 2 && isHex(parts[0]) && isHex(parts[1])) {
      themeStart = parts[0]
      themeEnd = parts[1]
    }
  }

  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, dim_colors, theme_start, theme_end, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       dim_colors = excluded.dim_colors,
       theme_start = excluded.theme_start,
       theme_end = excluded.theme_end,
       updated_at = excluded.updated_at`
  ).bind(userId, JSON.stringify(colors), themeStart, themeEnd, Date.now()).run()

  return "saved"
}

function renderPage(currentColors: Record<string, string>, currentTheme: { start: string; end: string }, user: User, msg?: string, enabledSlots?: SlotId[], weekdayWeights?: { early: Record<string, number>; mid: Record<string, number>; weekend: Record<string, number> }): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>维度颜色 · pyq</title>
${themeCssVar({ start: currentTheme.start, end: currentTheme.end, solid: currentTheme.start })}
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
  <nav class="subnav">
    <a href="/today">📅 今日</a>
    <a href="/my/intros">👋 自我介绍</a>
    <a href="/my/cases">👥 客户案例</a>
    <a href="/my/quotes">💎 金句库</a>
    <a href="/my/formulas">✍️ 公式填空</a>
    <a href="/calendar">🗓 日历</a>
    <a href="/my/dims" class="active">🎨 维度颜色</a>
  </nav>

  <main>
    ${msg ? `<div class="flash ${msg.startsWith('✗') ? 'flash-err' : 'flash-ok'}">${escapeHtml(msg)}</div>` : ''}

    <h1>🎨 维度颜色 & 主题</h1>
    <p class="muted">每个 <strong>7 维度</strong>（A 观赏/B 专业/C 情绪/D 身份/E 生活/F 思想/G 关系）按钮 + UI 主题色。改了立刻在 <a href="/today">今日</a> 和 <a href="/calendar">日历</a> 生效。</p>

    <form method="POST" action="/my/dims" class="form">
      <h2>🖼️ UI 主题色</h2>
      <p class="muted">按钮、顶部 banner、导航激活态都用这个渐变。默认紫色 (#667eea → #764ba2)。</p>
      <div class="theme-presets">
        <span class="preset-label">常用（点直接保存）：</span>
        <a href="/my/dims?set_theme=%23667eea%2C%23764ba2" class="theme-swatch" style="background:linear-gradient(135deg,#667eea,#764ba2)" title="紫"></a>
        <a href="/my/dims?set_theme=%234facfe%2C%2300f2fe" class="theme-swatch" style="background:linear-gradient(135deg,#4facfe,#00f2fe)" title="蓝"></a>
        <a href="/my/dims?set_theme=%2343e97b%2C%2338f9d7" class="theme-swatch" style="background:linear-gradient(135deg,#43e97b,#38f9d7)" title="绿"></a>
        <a href="/my/dims?set_theme=%23fa709a%2C%23fee140" class="theme-swatch" style="background:linear-gradient(135deg,#fa709a,#fee140)" title="粉"></a>
        <a href="/my/dims?set_theme=%23ff9a9e%2C%23fad0c4" class="theme-swatch" style="background:linear-gradient(135deg,#ff9a9e,#fad0c4)" title="桃"></a>
        <a href="/my/dims?set_theme=%23f5af19%2C%23c77700" class="theme-swatch" style="background:linear-gradient(135deg,#f5af19,#c77700)" title="金"></a>
        <a href="/my/dims?set_theme=%232c3e50%2C%234ca1af" class="theme-swatch" style="background:linear-gradient(135deg,#2c3e50,#4ca1af)" title="深"></a>
      </div>
      <div class="theme-row">
        <label>
          <span>渐变起（浅）</span>
          <input type="color" name="theme_start" value="${currentTheme.start}" class="color-input">
        </label>
        <label>
          <span>渐变止（深）</span>
          <input type="color" name="theme_end" value="${currentTheme.end}" class="color-input">
        </label>
        <div class="theme-preview" id="themePreview" style="background:linear-gradient(135deg, ${currentTheme.start} 0%, ${currentTheme.end} 100%);">
          <span>按钮预览</span>
        </div>
      </div>

      <h2>⏰ 5 段勾选</h2>
      <p class="muted">5 段固定时间：早 8:00 / 午 12:30 / 傍晚 18:00 / 晚 20:00 / 夜 22:30。勾哪几段就发哪几段；不勾的时段不排期、不发。</p>
      <div class="slot-row">
        ${SLOTS.map(s => `
          <label class="slot-cb">
            <input type="checkbox" name="slot_${s.id}" value="1" ${(enabledSlots || []).includes(s.id as SlotId) ? 'checked' : ''}>
            <span class="cb-label">${s.label}</span>
            <span class="cb-time">${s.time}</span>
          </label>
        `).join('')}
      </div>
      <p class="muted">单日可改：到 <a href="/calendar">📅 日历</a> 点某天 → 5 段独立编辑</p>

      <h2>🏷️ 7 维度颜色</h2>

      <div class="bulk-presets">
        <span class="preset-label">批量改（点直接保存）：</span>
        <a href="/my/dims?bulk_set=all_light" class="bulk-btn" title="所有维度变浅色">全部变浅</a>
        <a href="/my/dims?bulk_set=all_mid" class="bulk-btn" title="所有维度变中等深度">全部变中</a>
        <a href="/my/dims?bulk_set=all_deep" class="bulk-btn" title="所有维度变深色">全部变深</a>
      </div>

      ${DIM_ORDER.map(d => {
        const def = DEFAULT_COLORS[d]
        const dimMeta = DIMS.find(x => x.id === d)
        const stored = currentColors[d]
        const current = (typeof stored === 'object' && stored !== null) ? stored.bg : (stored || def.bg)
        const currentFg = (typeof stored === 'object' && stored !== null) ? stored.fg : def.fg
        const presets = DIM_PRESETS[d] || []
        return `
        <div class="type-row">
          <div class="type-label">
            <strong>${d} ${escapeHtml(dimMeta?.name || d)}</strong>
            <span class="muted">${escapeHtml(dimMeta?.desc || '')}</span>
          </div>
          <div class="color-pickers">
            <label>
              <span>背景</span>
              <input type="color" name="bg_${d}" value="${current}" class="color-input">
            </label>
            <label>
              <span>文字</span>
              <input type="color" name="fg_${d}" value="${currentFg}" class="color-input">
            </label>
            <span class="preview" style="background:${current};color:${currentFg}" data-preview="${d}">${d}</span>
          </div>
          <div class="type-presets">
            ${presets.map(p => `<a href="/my/dims?set_${d}=${encodeURIComponent(p.bg + ',' + p.fg)}" class="type-swatch" style="background:${p.bg};color:${p.fg}" title="${d} ${p.label}">${p.label}</a>`).join('')}
          </div>
        </div>`
      }).join('')}

      <h2>⏰ D37: 周内 3 段比重可调</h2>
      <p class="muted">D37: 3 段权重 = 早周一-三 / 中周四-五 / 周末。改后点 [保存颜色]。D36 默认值保留；不想改就留空。</p>
      <div class="weekday-grid">
        <div class="wd-col">
          <h3>早 (周一-三)</h3>
          ${DIM_ORDER.map(d => `
            <label class="wd-row">
              <span>${d}</span>
              <input type="number" name="weekday_early_${d}" min="0" max="1" step="0.05" value="${(weekdayWeights?.early[d] ?? 0.14).toFixed(2)}">
            </label>
          `).join('')}
        </div>
        <div class="wd-col">
          <h3>中 (周四-五)</h3>
          ${DIM_ORDER.map(d => `
            <label class="wd-row">
              <span>${d}</span>
              <input type="number" name="weekday_mid_${d}" min="0" max="1" step="0.05" value="${(weekdayWeights?.mid[d] ?? 0.14).toFixed(2)}">
            </label>
          `).join('')}
        </div>
        <div class="wd-col">
          <h3>周末 (周六-日)</h3>
          ${DIM_ORDER.map(d => `
            <label class="wd-row">
              <span>${d}</span>
              <input type="number" name="weekday_weekend_${d}" min="0" max="1" step="0.05" value="${(weekdayWeights?.weekend[d] ?? 0.14).toFixed(2)}">
            </label>
          `).join('')}
        </div>
      </div>

      <div class="actions">
        <button type="submit" class="btn-primary">保存颜色</button>
        <button type="submit" name="reset" value="1" class="btn-link" onclick="return confirm('恢复默认颜色？')">恢复默认</button>
      </div>
    </form>
  </main>
  <script>${script}</script>
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

  // ★ 兼容 /my/dims?set_xxx=%23xxx,%23yyy 或 ?bulk_set=all_light
  // D55: 路由改到 /my/dims（替代旧的 /my/types）
  const swatchAction = await applySwatchFromQuery(ctx.env, user.id, url)
  if (swatchAction) {
    return Response.redirect(getOrigin(ctx.request) + `/my/dims?saved=1`, 302)
  }

  const saved = url.searchParams.get("saved")
  let msg: string | undefined
  if (saved === "1") msg = "✓ 已保存"
  if (saved === "reset") msg = "✓ 已恢复默认"

  const row = await ctx.env.DB.prepare(
    "SELECT dim_colors, theme_start, theme_end, default_slots_per_day, slot_config_json, weekday_weights_json FROM user_settings WHERE user_id = ?"
  ).bind(user.id).first<{ dim_colors: string; theme_start: string; theme_end: string; default_slots_per_day: number | null; slot_config_json: string | null; weekday_weights_json: string | null }>()

  let currentColors: Record<string, string> = {}
  let currentTheme = { start: DEFAULT_THEME.start, end: DEFAULT_THEME.end }
  let defaultSlotsPerDay = 1
  let enabledSlotsFromJson: SlotId[] | null = null
  const { WEEKDAY_PHASE_WEIGHTS } = await import("../lib/schedule-constants")
  let weekdayWeights = {
    early:   { ...WEEKDAY_PHASE_WEIGHTS.early },
    mid:     { ...WEEKDAY_PHASE_WEIGHTS.mid },
    weekend: { ...WEEKDAY_PHASE_WEIGHTS.weekend },
  }
  if (row) {
    try {
      const stored = JSON.parse(row.dim_colors || "{}")
      for (const d of DIM_ORDER) {
        const v = stored[d]
        if (v) currentColors[d] = typeof v === 'string' ? v : v.bg
      }
    } catch {}
    currentTheme = {
      start: row.theme_start || DEFAULT_THEME.start,
      end: row.theme_end || DEFAULT_THEME.end,
    }
    defaultSlotsPerDay = row.default_slots_per_day || 1
    if (row.slot_config_json) {
      try {
        const cfg = JSON.parse(row.slot_config_json)
        if (Array.isArray(cfg._default)) {
          enabledSlotsFromJson = cfg._default.filter(
            (s: unknown): s is SlotId => typeof s === "string" && (SLOT_IDS as readonly string[]).includes(s)
          )
        }
      } catch {}
    }
    if (row.weekday_weights_json) {
      try {
        const parsed = JSON.parse(row.weekday_weights_json)
        weekdayWeights = {
          early:   { ...weekdayWeights.early,   ...(parsed.early   || {}) },
          mid:     { ...weekdayWeights.mid,     ...(parsed.mid     || {}) },
          weekend: { ...weekdayWeights.weekend, ...(parsed.weekend || {}) },
        }
      } catch {}
    }
  }
  const enabledSlots = enabledSlotsFromJson ?? SLOTS.map(s => s.id)
  return renderPage(currentColors, currentTheme, user, msg, enabledSlots, weekdayWeights)
}

export async function onRequestPost(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  const user = ctx.data.user as User | undefined
  if (!user) return new Response("未登录", { status: 401 })
  if (!ctx.env.DB) return new Response("D1 未配置", { status: 500 })

  let form: FormData
  try {
    form = await ctx.request.formData()
  } catch {
    form = new FormData()
  }
  const reset = form.get("reset")

  // 先读当前/默认颜色
  const existingRow = await ctx.DB.prepare(
    "SELECT dim_colors, theme_start, theme_end, slot_config_json FROM user_settings WHERE user_id = ?"
  ).bind(user.id).first<{ dim_colors: string; theme_start: string; theme_end: string; slot_config_json: string | null }>()
  let fallbackColors: Record<string, { bg: string; fg: string }> = {}
  for (const d of DIM_ORDER) fallbackColors[d] = { ...DEFAULT_COLORS[d] }
  let fallbackTheme = { start: DEFAULT_THEME.start, end: DEFAULT_THEME.end }
  let existingConfig: Record<string, unknown> = {}
  if (existingRow) {
    try {
      const stored = JSON.parse(existingRow.dim_colors || "{}")
      for (const d of DIM_ORDER) fallbackColors[d] = { ...DEFAULT_COLORS[d], ...(stored[d] || {}) }
    } catch {}
    if (existingRow.theme_start) fallbackTheme.start = existingRow.theme_start
    if (existingRow.theme_end) fallbackTheme.end = existingRow.theme_end
    if (existingRow.slot_config_json) {
      try { existingConfig = JSON.parse(existingRow.slot_config_json) } catch {}
    }
  }

  let colors: Record<string, { bg: string; fg: string }>
  let themeStart: string
  let themeEnd: string
  let defaultSlotsPerDay = 1
  let checkedSlots: SlotId[] = []
  if (reset) {
    colors = fallbackColors
    for (const d of DIM_ORDER) colors[d] = { ...DEFAULT_COLORS[d] }
    themeStart = DEFAULT_THEME.start
    themeEnd = DEFAULT_THEME.end
    defaultSlotsPerDay = 1
  } else {
    colors = {}
    for (const d of DIM_ORDER) {
      const fallback = fallbackColors[d] || DEFAULT_COLORS[d]
      const bg = String(form.get(`bg_${d}`) || "").trim()
      const fg = String(form.get(`fg_${d}`) || "").trim()
      colors[d] = {
        bg: isHex(bg) ? bg : fallback.bg,
        fg: isHex(fg) ? fg : fallback.fg,
      }
    }
    for (const d of DIM_ORDER) {
      const setVal = form.get(`set_${d}`)
      if (setVal) {
        const parts = String(setVal).split(",")
        if (parts.length === 2 && isHex(parts[0]) && isHex(parts[1])) {
          colors[d] = { bg: parts[0], fg: parts[1] }
        }
      }
    }
    const bulkSet = form.get("bulk_set")
    if (bulkSet) {
      const shadeIdx = bulkSet === "all_light" ? 0 : bulkSet === "all_mid" ? 1 : bulkSet === "all_deep" ? 2 : -1
      if (shadeIdx >= 0) {
        for (const d of DIM_ORDER) {
          const preset = DIM_PRESETS[d]?.[shadeIdx]
          if (preset) colors[d] = { bg: preset.bg, fg: preset.fg }
        }
      }
    }
    const rawStart = String(form.get("theme_start") || "").trim()
    const rawEnd = String(form.get("theme_end") || "").trim()
    themeStart = isHex(rawStart) ? rawStart : fallbackTheme.start
    themeEnd = isHex(rawEnd) ? rawEnd : fallbackTheme.end
    const setTheme = form.get("set_theme")
    if (setTheme) {
      const parts = String(setTheme).split(",")
      if (parts.length === 2 && isHex(parts[0]) && isHex(parts[1])) {
        themeStart = parts[0]
        themeEnd = parts[1]
      }
    }
    for (const sid of SLOT_IDS) {
      if (form.get(`slot_${sid}`)) checkedSlots.push(sid)
    }
    if (checkedSlots.length === 0) checkedSlots = SLOTS.map(s => s.id)
    defaultSlotsPerDay = checkedSlots.length
  }

  const newSlotConfig = { ...existingConfig, _default: checkedSlots }
  const slotConfigJson = JSON.stringify(newSlotConfig)

  const { WEEKDAY_PHASE_WEIGHTS } = await import("../lib/schedule-constants")
  const weekdayWeights = {
    early:   { ...WEEKDAY_PHASE_WEIGHTS.early },
    mid:     { ...WEEKDAY_PHASE_WEIGHTS.mid },
    weekend: { ...WEEKDAY_PHASE_WEIGHTS.weekend },
  }
  for (const phase of ['early', 'mid', 'weekend'] as const) {
    for (const d of DIM_ORDER) {
      const v = form.get(`weekday_${phase}_${d}`)
      if (v !== null && v !== '') {
        const n = parseFloat(String(v))
        if (!isNaN(n) && n >= 0) {
          weekdayWeights[phase][d] = Math.min(1, Math.max(0, n))
        }
      }
    }
  }
  const weekdayWeightsJson = JSON.stringify(weekdayWeights)

  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, dim_colors, theme_start, theme_end, default_slots_per_day, slot_config_json, weekday_weights_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       dim_colors = excluded.dim_colors,
       theme_start = excluded.theme_start,
       theme_end = excluded.theme_end,
       default_slots_per_day = excluded.default_slots_per_day,
       slot_config_json = excluded.slot_config_json,
       weekday_weights_json = excluded.weekday_weights_json,
       updated_at = excluded.updated_at`
  ).bind(user.id, JSON.stringify(colors), themeStart, themeEnd, defaultSlotsPerDay, slotConfigJson, weekdayWeightsJson, Date.now()).run()

  const suffix = reset ? "reset" : "1"
  return Response.redirect(getOrigin(ctx.request) + `/my/dims?saved=${suffix}`, 302)
}

const script = `
document.querySelectorAll('.color-input').forEach(input => {
  input.addEventListener('input', () => {
    const d = input.name.startsWith('bg_') ? input.name.slice(3) : input.name.slice(3)
    const preview = document.querySelector('[data-preview="' + d + '"]')
    const bgInput = document.querySelector('input[name="bg_' + d + '"]')
    const fgInput = document.querySelector('input[name="fg_' + d + '"]')
    if (preview && bgInput && fgInput) {
      preview.style.background = bgInput.value
      preview.style.color = fgInput.value
    }
  })
})
const themeStartInput = document.querySelector('input[name="theme_start"]')
const themeEndInput = document.querySelector('input[name="theme_end"]')
const themePreview = document.getElementById('themePreview')
function updateThemePreview() {
  if (themePreview && themeStartInput && themeEndInput) {
    themePreview.style.background = 'linear-gradient(135deg, ' + themeStartInput.value + ' 0%, ' + themeEndInput.value + ' 100%)'
  }
}
if (themeStartInput) themeStartInput.addEventListener('input', updateThemePreview)
if (themeEndInput) themeEndInput.addEventListener('input', updateThemePreview)
`

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; line-height: 1.6; padding-bottom: 60px; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
.topbar-inner { max-width: 760px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.brand { font-weight: 700; font-size: 16px; text-decoration: none; color: #1a202c; }
.user { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.user-name { color: #4a5568; }
.logout-btn { padding: 4px 10px; background: #fff; color: #c53030; border: 1px solid #fc8181; border-radius: 16px; text-decoration: none; font-size: 12px; }
.subnav { max-width: 760px; margin: 0 auto; display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 20px 0; }
.subnav a { padding: 6px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; text-decoration: none; color: #4a5568; font-size: 13px; }
.subnav a.active, .subnav a:hover { background: var(--t); color: #fff; border-color: var(--t); }
main { max-width: 760px; margin: 0 auto; padding: 20px; }
.flash { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.flash-ok { background: #c6f6d5; color: #22543d; }
.flash-err { background: #fed7d7; color: #c53030; }
h1 { font-size: 24px; margin-bottom: 6px; color: #2d3748; }
.muted { color: #a0aec0; font-size: 14px; margin-bottom: 20px; }
.muted a { color: #667eea; }
.form { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
h2 { font-size: 18px; margin: 24px 0 8px; color: #2d3748; }
.theme-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 16px; background: #f7fafc; border-radius: 8px; margin-bottom: 16px; }
.theme-row label { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: #4a5568; }
.theme-preview { padding: 12px 24px; border-radius: 8px; color: #fff; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.theme-presets { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.preset-label { font-size: 13px; color: #4a5568; font-weight: 500; }
.theme-swatch { width: 56px; height: 32px; border: 2px solid transparent; border-radius: 6px; cursor: pointer; padding: 0; }
.theme-swatch:hover { border-color: var(--t); transform: scale(1.05); }
.type-presets { display: flex; gap: 4px; margin-top: 6px; }
.type-swatch { min-width: 28px; height: 24px; padding: 0 6px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; }
.type-swatch:hover { transform: scale(1.1); box-shadow: 0 0 0 2px var(--t); }
.bulk-presets { display: flex; gap: 8px; align-items: center; padding: 10px 0; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e0; flex-wrap: wrap; }
.bulk-btn { padding: 6px 14px; background: #fff; border: 1.5px solid var(--t); color: var(--t); border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
.bulk-btn:hover { background: var(--t); color: #fff; }
@media (max-width: 640px) { .theme-row { flex-direction: column; align-items: flex-start; } }
.type-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #edf2f7; gap: 16px; }
.type-row:last-of-type { border-bottom: none; }
.type-label { display: flex; flex-direction: column; gap: 2px; min-width: 160px; }
.type-label strong { color: #2d3748; font-size: 16px; }
.type-label .muted { font-size: 12px; margin: 0; }
.color-pickers { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.color-pickers label { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: #4a5568; }
.color-input { width: 44px; height: 44px; padding: 0; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: #fff; }
.preview { padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 14px; min-width: 60px; text-align: center; }
.actions { display: flex; gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #edf2f7; }
.btn-primary { padding: 10px 20px; background: linear-gradient(135deg, var(--ts) 0%, var(--te) 100%); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-primary:hover { opacity: 0.92; }
.btn-link { padding: 10px 20px; color: #4a5568; background: transparent; border: none; text-decoration: none; cursor: pointer; font-size: 15px; }
.btn-link:hover { color: #2d3748; text-decoration: underline; }
@media (max-width: 640px) { .topbar-inner, main, .subnav { padding-left: 16px; padding-right: 16px; } .type-row { flex-direction: column; align-items: flex-start; gap: 8px; } .color-pickers { width: 100%; } .preview { width: 100%; } }
`
