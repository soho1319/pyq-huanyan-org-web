// ============================================
// 排期共享常量（4 段固定时段 + 7 种 post_type）
// D29 之前散在 4+ 个文件重复，改一次要改 4 处 → 集中到这
// ============================================

// 4 段固定时段（slot ID 不允许改，时间已确认）
export const SLOTS = [
  { id: "morning", label: "早", time: "08:00" },
  { id: "noon",    label: "午", time: "12:30" },
  { id: "evening", label: "晚", time: "20:00" },
  { id: "night",   label: "夜", time: "22:30" },
] as const

export type SlotId = (typeof SLOTS)[number]["id"]
export const SLOT_IDS = SLOTS.map(s => s.id) as readonly SlotId[]

// 7 种 post_type（之前散在 4 个文件）
export const POST_TYPES = ["干货", "生活", "客户", "互动", "软广", "复盘", "休息"] as const
export type PostType = (typeof POST_TYPES)[number]

// 7 天循环（周一到周日）
export const ROTATION: PostType[] = ["干货", "生活", "客户", "互动", "软广", "复盘", "休息"]

// post_type → 默认推荐 formula_id 映射（之前重复 3 处）
export const TYPE_TO_TEMPLATE: Record<PostType, string> = {
  "干货": "pro",
  "生活": "lifestyle",
  "客户": "testimonial",
  "互动": "ask",
  "软广": "softad",
  "复盘": "review",
  "休息": "lifestyle",
}

// 类型提示（之前重复 2 处）
export const TYPE_TIPS: Record<string, string> = {
  "干货": "建立专业感。公式：反认知钩子 + 痛点具象化 + 行动建议",
  "生活": "建立真实感。公式：生活场景 + 个人感受 + 钩子结尾",
  "客户": "建立信任感。公式：客户背景 + 痛点 + 做了什么 + 结果 + 原话",
  "互动": "激活评论区。公式：场景描述 + 灵魂提问 + 引导回应",
  "软广": "种草不硬广。公式：场景痛点 + 产品价值 + 行动召唤",
  "复盘": "建立反思感。公式：发生了什么 + 学到什么 + 下一步",
  "休息": "放空一下。发张图、说句话、不强求转化",
}

// ymd 工具（之前重复 5+ 处）
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// type guards
export function isPostType(s: string): s is PostType {
  return (POST_TYPES as readonly string[]).includes(s)
}
export function isSlot(s: string): s is SlotId {
  return (SLOT_IDS as readonly string[]).includes(s)
}

// 决定某天该开几段：per-date JSON 覆盖 → 默认 N 段
export function resolveEnabledSlots(
  settings: { default_slots_per_day: number; slot_config_json: string | null } | null,
  date: string
): SlotId[] {
  if (settings?.slot_config_json) {
    try {
      const m = JSON.parse(settings.slot_config_json)
      if (Array.isArray(m[date])) return m[date] as SlotId[]
    } catch {}
  }
  const n = Math.max(1, Math.min(4, settings?.default_slots_per_day || 1))
  return SLOTS.slice(0, n).map(s => s.id)
}

// 安全 wrapper：migration 还没跑时降级到 ['morning']
export async function loadEnabledSlots(
  env: { DB?: D1Database },
  userId: string,
  date: string
): Promise<SlotId[]> {
  if (!env.DB) return ["morning"]
  try {
    const row = await env.DB.prepare(
      "SELECT default_slots_per_day, slot_config_json FROM user_settings WHERE user_id = ?"
    ).bind(userId).first<{ default_slots_per_day: number; slot_config_json: string | null }>()
    return resolveEnabledSlots(row, date)
  } catch {
    // migration 还没跑（D29 前）→ 降级到 1 段
    return ["morning"]
  }
}

// ============================================
// D36: 朋友圈运营循环体系（4 周 + 3 月 + 周内比重 + 7 维度）
// ============================================

// D36: 周主题 4 周循环（立人设/反认知/讲故事/立边界）
export const WEEKLY_THEMES = {
  identity:   { label: '立人设', weights: { '干货': 0.30, '生活': 0.30, '客户': 0.10, '互动': 0.05, '软广': 0.05, '复盘': 0.15, '休息': 0.05 } },
  contrarian: { label: '反认知', weights: { '干货': 0.45, '复盘': 0.25, '互动': 0.15, '软广': 0.05, '客户': 0.05, '生活': 0.03, '休息': 0.02 } },
  story:      { label: '讲故事', weights: { '复盘': 0.30, '客户': 0.25, '生活': 0.20, '互动': 0.10, '干货': 0.10, '软广': 0.03, '休息': 0.02 } },
  boundary:   { label: '立边界', weights: { '软广': 0.30, '客户': 0.25, '互动': 0.20, '干货': 0.10, '复盘': 0.08, '生活': 0.05, '休息': 0.02 } },
} as const

export type WeeklyThemeId = keyof typeof WEEKLY_THEMES

// D36: 月主题 3 月循环（破冰/转化/复购）
export const MONTHLY_PHASES = {
  1: { label: '破冰', weights: { '干货': 0.35, '互动': 0.20, '客户': 0.10, '复盘': 0.10, '生活': 0.10, '软广': 0.10, '休息': 0.05 } },
  2: { label: '转化', weights: { '客户': 0.25, '软广': 0.25, '干货': 0.15, '互动': 0.15, '复盘': 0.10, '生活': 0.05, '休息': 0.05 } },
  3: { label: '复购', weights: { '互动': 0.25, '复盘': 0.20, '客户': 0.20, '生活': 0.15, '干货': 0.10, '软广': 0.08, '休息': 0.02 } },
} as const

// D36: 周内 dayOfWeek 3 段（early/mid/weekend）
export const WEEKDAY_PHASE_WEIGHTS = {
  early:   { '干货': 0.30, '复盘': 0.20, '客户': 0.15, '互动': 0.10, '生活': 0.10, '软广': 0.10, '休息': 0.05 },
  mid:     { '软广': 0.25, '互动': 0.20, '客户': 0.15, '干货': 0.15, '生活': 0.10, '复盘': 0.10, '休息': 0.05 },
  weekend: { '生活': 0.30, '互动': 0.25, '休息': 0.15, '复盘': 0.10, '客户': 0.10, '干货': 0.05, '软广': 0.05 },
} as const

// D36: 7 维度 → 7 种 post_type 映射
export const DIMENSION_TYPE_MAP: Record<string, string[]> = {
  '身份': ['干货', '客户'],
  '原生': ['生活', '互动'],
  '生活': ['生活', '休息'],
  '专业': ['干货', '客户', '软广'],
  '关系': ['互动', '软广'],
  '思想': ['干货', '复盘'],
  '链接': ['互动', '软广'],
}

// D36: 工具：算本周周主题（自动循环 + 可锁）
export function getWeeklyTheme(
  weekStart: string,
  userLocked: { theme: WeeklyThemeId } | null
): { theme: WeeklyThemeId; weights: Record<string, number>; locked: boolean; cycleIndex: number; label: string } {
  const startMs = new Date('2026-06-01').getTime()
  const currentMs = new Date(weekStart).getTime()
  const weekDiff = Math.floor((currentMs - startMs) / (7 * 86400 * 1000))
  const cycleIndex = ((weekDiff % 4) + 4) % 4
  const themeIds: WeeklyThemeId[] = ['identity', 'contrarian', 'story', 'boundary']
  const autoTheme = themeIds[cycleIndex]
  if (userLocked) {
    return { theme: userLocked.theme, weights: WEEKLY_THEMES[userLocked.theme].weights, locked: true, cycleIndex, label: WEEKLY_THEMES[userLocked.theme].label }
  }
  return { theme: autoTheme, weights: WEEKLY_THEMES[autoTheme].weights, locked: false, cycleIndex, label: WEEKLY_THEMES[autoTheme].label }
}

// D36: 工具：算本月月阶段（自动循环 + cycle_index 覆盖）
export function getMonthlyPhase(
  yearMonth: string,
  userCycleIndex: number | null
): { phase: 1|2|3; weights: Record<string, number>; locked: boolean; cycleIndex: number; label: string } {
  if (userCycleIndex && userCycleIndex >= 1 && userCycleIndex <= 3) {
    return { phase: userCycleIndex as 1|2|3, weights: MONTHLY_PHASES[userCycleIndex as 1|2|3].weights, locked: true, cycleIndex: userCycleIndex, label: MONTHLY_PHASES[userCycleIndex as 1|2|3].label }
  }
  const [y, m] = yearMonth.split('-').map(Number)
  const startMs = new Date('2026-06-01').getTime()
  const currentMs = Date.UTC(y, m - 1, 1)
  const monthDiff = Math.round((currentMs - startMs) / (30 * 86400 * 1000))
  const cycleIndex = ((monthDiff % 3) + 3) % 3 + 1
  return { phase: cycleIndex as 1|2|3, weights: MONTHLY_PHASES[cycleIndex as 1|2|3].weights, locked: false, cycleIndex, label: MONTHLY_PHASES[cycleIndex as 1|2|3].label }
}

// D36: 工具：dayOfWeek → phase
export function getWeekdayPhase(dayOfWeek: number): 'early'|'mid'|'weekend' {
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'weekend'
  if (dayOfWeek <= 3) return 'early'
  return 'mid'
}

// D36: 工具：post_type → 7 维度
export function reverseDimensionMap(postType: string): string[] {
  const dims: string[] = []
  for (const [dim, types] of Object.entries(DIMENSION_TYPE_MAP)) {
    if (types.includes(postType)) dims.push(dim)
  }
  return dims
}

// ============================================
// D37: 周内比重可调（user 可改 early/mid/weekend 权重）
// ============================================

// D37: 加载 user 自己的 weekday 权重（带降级到 D36 默认）
export async function loadWeekdayWeights(
  env: { DB?: D1Database },
  userId: string
): Promise<typeof WEEKDAY_PHASE_WEIGHTS> {
  if (!env.DB) return WEEKDAY_PHASE_WEIGHTS
  try {
    const row = await env.DB.prepare(
      "SELECT weekday_weights_json FROM user_settings WHERE user_id = ?"
    ).bind(userId).first<{ weekday_weights_json: string | null }>()
    if (row?.weekday_weights_json) {
      const parsed = JSON.parse(row.weekday_weights_json)
      // 浅合并：用户配置覆盖默认
      return {
        early:   { ...WEEKDAY_PHASE_WEIGHTS.early,   ...(parsed.early   || {}) },
        mid:     { ...WEEKDAY_PHASE_WEIGHTS.mid,     ...(parsed.mid     || {}) },
        weekend: { ...WEEKDAY_PHASE_WEIGHTS.weekend, ...(parsed.weekend || {}) },
      }
    }
    return WEEKDAY_PHASE_WEIGHTS
  } catch {
    return WEEKDAY_PHASE_WEIGHTS
  }
}
