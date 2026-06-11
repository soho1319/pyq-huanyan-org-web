// ============================================
// /my/types
// 自定义 7 种 post_type 按钮颜色 + UI 主题色
//
// GET   渲染 7 个颜色选择器 + 2 个主题色
// POST  保存到 user_settings
// ============================================

import { DEFAULT_THEME, loadUserTheme, themeCssVar } from "../lib/theme"
import { POST_TYPES, SLOTS, SLOT_IDS, loadEnabledSlots } from "../lib/schedule-constants"

interface User { id: string; username: string; display_name: string | null }

const DEFAULT_COLORS: Record<string, { bg: string; fg: string }> = {
  "干货": { bg: "#ebf4ff", fg: "#2c5282" },
  "生活": { bg: "#fef5e7", fg: "#c05621" },
  "客户": { bg: "#e6fffa", fg: "#234e52" },
  "互动": { bg: "#faf5ff", fg: "#553c9a" },
  "软广": { bg: "#fff5f5", fg: "#c53030" },
  "复盘": { bg: "#f0fff4", fg: "#22543d" },
  "休息": { bg: "#edf2f7", fg: "#4a5568" },
}

const TYPE_ORDER = POST_TYPES  // D29: 从 lib/schedule-constants 复用

const TYPE_TIPS: Record<string, string> = {
  "干货": "建立专业感",
  "生活": "建立真实感",
  "客户": "建立信任感",
  "互动": "激活评论区",
  "软广": "种草不硬广",
  "复盘": "建立反思感",
  "休息": "放空一下",
}

// 每种类型 3 个快选色（深浅梯度）
const TYPE_PRESETS: Record<string, Array<{ bg: string; fg: string; label: string }>> = {
  "干货": [
    { bg: "#ebf4ff", fg: "#2c5282", label: "浅" },
    { bg: "#90cdf4", fg: "#1a365d", label: "中" },
    { bg: "#2b6cb0", fg: "#ffffff", label: "深" },
  ],
  "生活": [
    { bg: "#fef5e7", fg: "#c05621", label: "浅" },
    { bg: "#fbd38d", fg: "#7b341e", label: "中" },
    { bg: "#c05621", fg: "#ffffff", label: "深" },
  ],
  "客户": [
    { bg: "#e6fffa", fg: "#234e52", label: "浅" },
    { bg: "#81e6d9", fg: "#1d4044", label: "中" },
    { bg: "#2c7a7b", fg: "#ffffff", label: "深" },
  ],
  "互动": [
    { bg: "#faf5ff", fg: "#553c9a", label: "浅" },
    { bg: "#d6bcfa", fg: "#44337a", label: "中" },
    { bg: "#6b46c1", fg: "#ffffff", label: "深" },
  ],
  "软广": [
    { bg: "#fff5f5", fg: "#c53030", label: "浅" },
    { bg: "#fc8181", fg: "#742a2a", label: "中" },
    { bg: "#c53030", fg: "#ffffff", label: "深" },
  ],
  "复盘": [
    { bg: "#f0fff4", fg: "#22543d", label: "浅" },
    { bg: "#9ae6b4", fg: "#1c4532", label: "中" },
    { bg: "#276749", fg: "#ffffff", label: "深" },
  ],
  "休息": [
    { bg: "#edf2f7", fg: "#4a5568", label: "浅" },
    { bg: "#cbd5e0", fg: "#2d3748", label: "中" },
    { bg: "#4a5568", fg: "#ffffff", label: "深" },
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
// 返回 'saved' 表示有更新；返回 null 表示只是普通 GET 渲染
async function applySwatchFromQuery(env: { DB?: D1Database }, userId: string, url: URL): Promise<string | null> {
  if (!env.DB) return null

  const setTheme = url.searchParams.get("set_theme")
  const bulkSet = url.searchParams.get("bulk_set")
  // 检测任意 set_<type>
  let swatchSet: { type: string; bg: string; fg: string } | null = null
  for (const t of TYPE_ORDER) {
    const v = url.searchParams.get(`set_${t}`)
    if (v) {
      const parts = v.split(",")
      if (parts.length === 2 && isHex(parts[0]) && isHex(parts[1])) {
        swatchSet = { type: t, bg: parts[0], fg: parts[1] }
        break
      }
    }
  }

  if (!setTheme && !bulkSet && !swatchSet) return null

  // 读当前
  const row = await env.DB.prepare(
    "SELECT type_colors, theme_start, theme_end FROM user_settings WHERE user_id = ?"
  ).bind(userId).first<{ type_colors: string; theme_start: string; theme_end: string }>()
  let colors: Record<string, { bg: string; fg: string }> = { ...DEFAULT_COLORS }
  let themeStart = DEFAULT_THEME.start
  let themeEnd = DEFAULT_THEME.end
  if (row) {
    try { colors = { ...DEFAULT_COLORS, ...JSON.parse(row.type_colors) } } catch {}
    themeStart = row.theme_start || DEFAULT_THEME.start
    themeEnd = row.theme_end || DEFAULT_THEME.end
  }

  // apply
  if (swatchSet) {
    colors[swatchSet.type] = { bg: swatchSet.bg, fg: swatchSet.fg }
  }
  if (bulkSet) {
    const shadeIdx = bulkSet === "all_light" ? 0 : bulkSet === "all_mid" ? 1 : bulkSet === "all_deep" ? 2 : -1
    if (shadeIdx >= 0) {
      for (const t of TYPE_ORDER) {
        const preset = TYPE_PRESETS[t]?.[shadeIdx]
        if (preset) colors[t] = { bg: preset.bg, fg: preset.fg }
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
    `INSERT INTO user_settings (user_id, type_colors, theme_start, theme_end, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       type_colors = excluded.type_colors,
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
<title>类型颜色 · pyq</title>
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
    <a href="/my/types" class="active">🎨 颜色</a>
  </nav>

  <main>
    ${msg ? `<div class="flash ${msg.startsWith('✗') ? 'flash-err' : 'flash-ok'}">${escapeHtml(msg)}</div>` : ''}

    <h1>🎨 颜色 & 主题</h1>
    <p class="muted">每个 post_type 按钮 + UI 主题色。改了立刻在 <a href="/today">今日</a> 和 <a href="/calendar">日历</a> 生效。</p>

    <form method="POST" action="/my/types" class="form">
      <h2>🖼️ UI 主题色</h2>
      <p class="muted">按钮、顶部 banner、导航激活态都用这个渐变。默认紫色 (#667eea → #764ba2)。</p>
      <div class="theme-presets">
        <span class="preset-label">常用（点直接保存）：</span>
        <a href="/my/types?set_theme=%23667eea%2C%23764ba2" class="theme-swatch" style="background:linear-gradient(135deg,#667eea,#764ba2)" title="紫"></a>
        <a href="/my/types?set_theme=%234facfe%2C%2300f2fe" class="theme-swatch" style="background:linear-gradient(135deg,#4facfe,#00f2fe)" title="蓝"></a>
        <a href="/my/types?set_theme=%2343e97b%2C%2338f9d7" class="theme-swatch" style="background:linear-gradient(135deg,#43e97b,#38f9d7)" title="绿"></a>
        <a href="/my/types?set_theme=%23fa709a%2C%23fee140" class="theme-swatch" style="background:linear-gradient(135deg,#fa709a,#fee140)" title="粉"></a>
        <a href="/my/types?set_theme=%23ff9a9e%2C%23fad0c4" class="theme-swatch" style="background:linear-gradient(135deg,#ff9a9e,#fad0c4)" title="桃"></a>
        <a href="/my/types?set_theme=%23f5af19%2C%23c77700" class="theme-swatch" style="background:linear-gradient(135deg,#f5af19,#c77700)" title="金"></a>
        <a href="/my/types?set_theme=%232c3e50%2C%234ca1af" class="theme-swatch" style="background:linear-gradient(135deg,#2c3e50,#4ca1af)" title="深"></a>
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

      <h2>⏰ 每天发几条 + 几段</h2>
      <p class="muted">4 段固定时间：早 8:00 / 午 12:30 / 晚 20:00 / 夜 22:30。勾哪几段就发哪几段；不勾的时段不排期、不发。</p>
      <div class="slot-row">
        ${SLOTS.map(s => `
          <label class="slot-cb">
            <input type="checkbox" name="slot_${s.id}" value="1" ${(enabledSlots || []).includes(s.id as SlotId) ? 'checked' : ''}>
            <span class="cb-label">${s.label}</span>
            <span class="cb-time">${s.time}</span>
          </label>
        `).join('')}
      </div>
      <p class="muted">单日可改：到 <a href="/calendar">📅 日历</a> 点某天 → 4 段独立编辑</p>

      <h2>🏷️ 7 种类型颜色</h2>

      <div class="bulk-presets">
        <span class="preset-label">批量改（点直接保存）：</span>
        <a href="/my/types?bulk_set=all_light" class="bulk-btn" title="所有类型变浅色">全部变浅</a>
        <a href="/my/types?bulk_set=all_mid" class="bulk-btn" title="所有类型变中等深度">全部变中</a>
        <a href="/my/types?bulk_set=all_deep" class="bulk-btn" title="所有类型变深色">全部变深</a>
      </div>

      ${TYPE_ORDER.map(t => {
        const def = DEFAULT_COLORS[t]
        // currentColors[t] 可能是 string（旧格式）或 {bg,fg} 对象（D1 默认格式）
        const stored = currentColors[t]
        const current = (typeof stored === 'object' && stored !== null) ? stored.bg : (stored || def.bg)
        const currentFg = (typeof stored === 'object' && stored !== null) ? stored.fg : def.fg
        const presets = TYPE_PRESETS[t] || []
        return `
        <div class="type-row">
          <div class="type-label">
            <strong>${t}</strong>
            <span class="muted">${TYPE_TIPS[t]}</span>
          </div>
          <div class="color-pickers">
            <label>
              <span>背景</span>
              <input type="color" name="bg_${t}" value="${current}" class="color-input">
            </label>
            <label>
              <span>文字</span>
              <input type="color" name="fg_${t}" value="${currentFg}" class="color-input">
            </label>
            <span class="preview" style="background:${current};color:${currentFg}" data-preview="${t}">${t}</span>
          </div>
          <div class="type-presets">
            ${presets.map(p => `<a href="/my/types?set_${encodeURIComponent(t)}=${encodeURIComponent(p.bg + ',' + p.fg)}" class="type-swatch" style="background:${p.bg};color:${p.fg}" title="${t} ${p.label}">${p.label}</a>`).join('')}
          </div>
        </div>`
      }).join('')}

      <h2>⏰ D37: 周内 3 段比重可调</h2>
      <p class="muted">D37: 3 段权重 = 早周一-三 / 中周四-五 / 周末。改后点 [保存颜色]。D36 默认值保留；不想改就留空。</p>
      <div class="weekday-grid">
        <div class="wd-col">
          <h3>早 (周一-三)</h3>
          ${POST_TYPES.map(t => `
            <label class="wd-row">
              <span>${t}</span>
              <input type="number" name="weekday_early_${t}" min="0" max="1" step="0.05" value="${(weekdayWeights?.early[t] ?? WEEKDAY_PHASE_WEIGHTS.early[t]).toFixed(2)}">
            </label>
          `).join('')}
        </div>
        <div class="wd-col">
          <h3>中 (周四-五)</h3>
          ${POST_TYPES.map(t => `
            <label class="wd-row">
              <span>${t}</span>
              <input type="number" name="weekday_mid_${t}" min="0" max="1" step="0.05" value="${(weekdayWeights?.mid[t] ?? WEEKDAY_PHASE_WEIGHTS.mid[t]).toFixed(2)}">
            </label>
          `).join('')}
        </div>
        <div class="wd-col">
          <h3>周末 (周六-日)</h3>
          ${POST_TYPES.map(t => `
            <label class="wd-row">
              <span>${t}</span>
              <input type="number" name="weekday_weekend_${t}" min="0" max="1" step="0.05" value="${(weekdayWeights?.weekend[t] ?? WEEKDAY_PHASE_WEIGHTS.weekend[t]).toFixed(2)}">
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

  // ★ 兼容 swatch 的 GET 链接：/my/types?set_干货=%23xxx,%23yyy 或 ?bulk_set=all_light
  // 检测到 → 写入 D1 → 重定向到 /my/types?saved=1
  const swatchAction = await applySwatchFromQuery(ctx.env, user.id, url)
  if (swatchAction) {
    return Response.redirect(getOrigin(ctx.request) + `/my/types?saved=1`, 302)
  }

  const saved = url.searchParams.get("saved")
  let msg: string | undefined
  if (saved === "1") msg = "✓ 已保存"
  if (saved === "reset") msg = "✓ 已恢复默认"

  const row = await ctx.env.DB.prepare(
    "SELECT type_colors, theme_start, theme_end, default_slots_per_day, weekday_weights_json FROM user_settings WHERE user_id = ?"
  ).bind(user.id).first<{ type_colors: string; theme_start: string; theme_end: string; default_slots_per_day: number | null; weekday_weights_json: string | null }>()

  let currentColors: Record<string, string> = {}
  let currentTheme = { start: DEFAULT_THEME.start, end: DEFAULT_THEME.end }
  let defaultSlotsPerDay = 1
  // D37: 加载 weekday weights（用户自定 → D36 默认）
  const { WEEKDAY_PHASE_WEIGHTS } = await import("../lib/schedule-constants")
  let weekdayWeights = {
    early:   { ...WEEKDAY_PHASE_WEIGHTS.early },
    mid:     { ...WEEKDAY_PHASE_WEIGHTS.mid },
    weekend: { ...WEEKDAY_PHASE_WEIGHTS.weekend },
  }
  if (row) {
    try { currentColors = JSON.parse(row.type_colors) } catch {}
    currentTheme = {
      start: row.theme_start || DEFAULT_THEME.start,
      end: row.theme_end || DEFAULT_THEME.end,
    }
    defaultSlotsPerDay = row.default_slots_per_day || 1
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
  // D29: 推算 enabled slots（按 SLOTS 顺序取前 N 段）
  const enabledSlots = SLOTS.slice(0, Math.max(1, Math.min(4, defaultSlotsPerDay))).map(s => s.id)
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

  // 先读当前/默认颜色（用来兜底）
  const existingRow = await ctx.env.DB.prepare(
    "SELECT type_colors, theme_start, theme_end FROM user_settings WHERE user_id = ?"
  ).bind(user.id).first<{ type_colors: string; theme_start: string; theme_end: string }>()
  let fallbackColors: Record<string, { bg: string; fg: string }> = { ...DEFAULT_COLORS }
  let fallbackTheme = { start: DEFAULT_THEME.start, end: DEFAULT_THEME.end }
  if (existingRow) {
    try { fallbackColors = { ...DEFAULT_COLORS, ...JSON.parse(existingRow.type_colors) } } catch {}
    if (existingRow.theme_start) fallbackTheme.start = existingRow.theme_start
    if (existingRow.theme_end) fallbackTheme.end = existingRow.theme_end
  }

  let colors: Record<string, { bg: string; fg: string }>
  let themeStart: string
  let themeEnd: string
  let defaultSlotsPerDay = 1  // D29
  if (reset) {
    colors = DEFAULT_COLORS
    themeStart = DEFAULT_THEME.start
    themeEnd = DEFAULT_THEME.end
    defaultSlotsPerDay = 1
  } else {
    colors = {}
    // 1. 先从 form input 读（color picker 选的值，或当前已存值）
    for (const t of TYPE_ORDER) {
      const fallback = fallbackColors[t] || DEFAULT_COLORS[t]
      const bg = String(form.get(`bg_${t}`) || "").trim()
      const fg = String(form.get(`fg_${t}`) || "").trim()
      colors[t] = {
        bg: isHex(bg) ? bg : fallback.bg,
        fg: isHex(fg) ? fg : fallback.fg,
      }
    }
    // 2. 读 swatch 提交（点 swatch 时会带 set_<type>=bg,fg）
    for (const t of TYPE_ORDER) {
      const setVal = form.get(`set_${t}`)
      if (setVal) {
        const parts = String(setVal).split(",")
        if (parts.length === 2 && isHex(parts[0]) && isHex(parts[1])) {
          colors[t] = { bg: parts[0], fg: parts[1] }
        }
      }
    }
    // 3. 批量改（点批量按钮时带 bulk_set=all_light/mid/deep）
    const bulkSet = form.get("bulk_set")
    if (bulkSet) {
      const shadeIdx = bulkSet === "all_light" ? 0 : bulkSet === "all_mid" ? 1 : bulkSet === "all_deep" ? 2 : -1
      if (shadeIdx >= 0) {
        for (const t of TYPE_ORDER) {
          const preset = TYPE_PRESETS[t]?.[shadeIdx]
          if (preset) colors[t] = { bg: preset.bg, fg: preset.fg }
        }
      }
    }
    // 4. 主题色
    const rawStart = String(form.get("theme_start") || "").trim()
    const rawEnd = String(form.get("theme_end") || "").trim()
    themeStart = isHex(rawStart) ? rawStart : fallbackTheme.start
    themeEnd = isHex(rawEnd) ? rawEnd : fallbackTheme.end
    // 5. 主题 swatch
    const setTheme = form.get("set_theme")
    if (setTheme) {
      const parts = String(setTheme).split(",")
      if (parts.length === 2 && isHex(parts[0]) && isHex(parts[1])) {
        themeStart = parts[0]
        themeEnd = parts[1]
      }
    }
    // 6. D29: 4 段 checkbox 解析（按 SLOT_IDS 顺序，去重，限制 1-4）
    const checked: SlotId[] = []
    for (const sid of SLOT_IDS) {
      if (form.get(`slot_${sid}`)) checked.push(sid)
    }
    defaultSlotsPerDay = Math.max(1, Math.min(4, checked.length))
  }

  // D37: 周内 3 段配重（早/中/周末），从 form input 收
  // form: weekday_early_干货=0.30, weekday_early_生活=0.30, weekday_mid_干货=0.15 ...
  const { WEEKDAY_PHASE_WEIGHTS, POST_TYPES } = await import("../lib/schedule-constants")
  const weekdayWeights = {
    early:   { ...WEEKDAY_PHASE_WEIGHTS.early },
    mid:     { ...WEEKDAY_PHASE_WEIGHTS.mid },
    weekend: { ...WEEKDAY_PHASE_WEIGHTS.weekend },
  }
  for (const phase of ['early', 'mid', 'weekend'] as const) {
    for (const t of POST_TYPES) {
      const v = form.get(`weekday_${phase}_${t}`)
      if (v !== null && v !== '') {
        const n = parseFloat(String(v))
        if (!isNaN(n) && n >= 0) {
          // 容差容许 0.0-1.0 之间
          weekdayWeights[phase][t] = Math.min(1, Math.max(0, n))
        }
      }
    }
  }
  const weekdayWeightsJson = JSON.stringify(weekdayWeights)

  await ctx.env.DB.prepare(
    `INSERT INTO user_settings (user_id, type_colors, theme_start, theme_end, default_slots_per_day, weekday_weights_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       type_colors = excluded.type_colors,
       theme_start = excluded.theme_start,
       theme_end = excluded.theme_end,
       default_slots_per_day = excluded.default_slots_per_day,
       weekday_weights_json = excluded.weekday_weights_json,
       updated_at = excluded.updated_at`
  ).bind(user.id, JSON.stringify(colors), themeStart, themeEnd, defaultSlotsPerDay, weekdayWeightsJson, Date.now()).run()

  const suffix = reset ? "reset" : "1"
  return Response.redirect(getOrigin(ctx.request) + `/my/types?saved=${suffix}`, 302)
}

const script = `
document.querySelectorAll('.color-input').forEach(input => {
  input.addEventListener('input', () => {
    const t = input.name.startsWith('bg_') ? input.name.slice(3) : input.name.slice(3)
    const preview = document.querySelector('[data-preview="' + t + '"]')
    const bgInput = document.querySelector('input[name="bg_' + t + '"]')
    const fgInput = document.querySelector('input[name="fg_' + t + '"]')
    if (preview && bgInput && fgInput) {
      preview.style.background = bgInput.value
      preview.style.color = fgInput.value
    }
  })
})
// 主题色 live preview
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

// 所有 swatch 现在都是 <a href="/my/types?set_xxx=bg,fg"> GET 链接
// 点一下直接 GET 改色，0 JS 依赖，0 form 提交风险

// JS 只保留：input 颜色 picker 的实时预览
`

const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7fafc; color: #1a202c; line-height: 1.6; padding-bottom: 60px; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
.topbar-inner { max-width: 760px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.brand { font-weight: 700; font-size: 16px; text-decoration: none; color: #1a202c; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
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
.type-label { display: flex; flex-direction: column; gap: 2px; min-width: 80px; }
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
