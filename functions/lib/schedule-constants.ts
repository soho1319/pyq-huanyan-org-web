// ============================================
// 排期共享常量 — D55 彻底切换到 7 维度（A-G）
// 旧 7 type（干货/生活/客户/互动/软广/复盘/休息）完全废弃
// 7 维度 = 课程 7 大维度 = 朋友圈能发的所有内容
//   A 观赏 / B 专业 / C 情绪 / D 身份 / E 生活 / F 思想 / G 关系
// ============================================

// 4 段固定时段（D55-3 确认；18-19 傍晚段合并入 evening）
export const SLOTS = [
  { id: "morning", label: "早", time: "08:00" },
  { id: "noon",    label: "午", time: "12:30" },
  { id: "evening", label: "傍晚", time: "18:00" },  // D55 加 18-19 傍晚段
  { id: "late",    label: "晚", time: "20:00" },
  { id: "night",   label: "夜", time: "22:30" },
] as const

export type SlotId = (typeof SLOTS)[number]["id"]
export const SLOT_IDS = SLOTS.map(s => s.id) as readonly SlotId[]

// ============================================
// 7 维度（D55 完全替代旧 7 type）
// ============================================

export const DIMS = [
  { id: "A", code: "VIEW",  name: "观赏价值", desc: "美学与视觉（看着舒服就想点进来看）" },
  { id: "B", code: "PRO",   name: "专业价值", desc: "问题解决（专业但不堆术语）" },
  { id: "C", code: "EMO",   name: "情绪价值", desc: "状态共鸣（调动别人情绪）" },
  { id: "D", code: "ID",    name: "身份维度", desc: "角色定位（我是谁）" },
  { id: "E", code: "LIFE",  name: "生活维度", desc: "真实质感（有血有肉的人）" },
  { id: "F", code: "THINK", name: "思想维度", desc: "筛选同频（价值观/反认知）" },
  { id: "G", code: "REL",   name: "关系维度", desc: "经营人脉（我活在关系里）" },
] as const

export type Dim = (typeof DIMS)[number]["id"]
export const DIM_IDS = DIMS.map(d => d.id) as readonly Dim[]

// Back-compat: 老 API 仍叫 post_types / TYPE_TEMPLATE 的代码（D29 旧 7 type 名：干货/生活/客户/互动/软广/复盘/休息）
// D55 后语义已统一为 dim 7 维 A-G；这里返回 dim ids 供新 form (<select name="dim">) 校验
export const POST_TYPES = DIM_IDS as readonly string[]

// Back-compat: 老代码用 TYPE_TO_TEMPLATE[postType] 查默认模板
// 现在 postType 已是 dim id（A-G），每个 dim 给一个语义化默认模板
export const TYPE_TO_TEMPLATE: Record<Dim, string> = {
  A: "aesthetic",     // 观赏价值
  B: "professional",  // 专业价值
  C: "emotional",     // 情绪价值
  D: "identity",      // 身份维度
  E: "lifestyle",     // 生活维度
  F: "reflective",    // 思想维度
  G: "relational",    // 关系维度
}

// 维度 → AI prompt 映射
export const DIM_PROMPT: Record<Dim, string> = {
  A: "P12",  // 观赏价值（综合 3 条）
  B: "P5",   // 专业价值（用户案例）
  C: "P4",   // 情绪价值（痛点）
  D: "P1",   // 身份维度（自我介绍）
  E: "P6",   // 生活维度（个人故事）
  F: "P3",   // 思想维度（反认知金句）
  G: "P9",   // 关系维度（连载故事）
}

// 维度 → 默认必发频次/周
export const DIM_FREQ_PER_WEEK: Record<Dim, number> = {
  A: 2, B: 3, C: 3, D: 1, E: 2, F: 2, G: 1,
}

// 5 段 × dim 7 必发频次/周
// 维度 × 段 对照表
export const DIM_SLOT_PREF: Record<Dim, SlotId[]> = {
  A: ["morning", "noon"],
  B: ["noon", "evening", "late"],
  C: ["morning", "noon", "evening", "late"],
  D: ["morning", "noon", "evening"],
  E: ["morning", "evening", "night"],
  F: ["morning", "noon"],
  G: ["evening", "late", "noon"],
}

// 7 天循环（按 dim 维度排）— 每天 top1 维度参考
export const ROTATION: Dim[] = ["A", "B", "C", "D", "E", "F", "G"]

// ============================================
// 5 段调性权重（D55-3 5 段最终版：早 F / 午 G 互动 / 傍 B / 晚 G+连载 / 夜 E）
// ============================================
export const SLOT_TONAL_WEIGHTS: Record<SlotId, Record<Dim, number>> = {
  // 早 7-9: F 思想（反认知）+ C 情绪（价值观） + E 生活（小确幸）
  morning: { F: 0.30, C: 0.25, E: 0.20, D: 0.10, A: 0.10, B: 0.05 },
  // 午 12-14: G 关系（互动/钩子）+ C 情绪（轻松）+ E 生活（动态）  ← D55-3 互换
  noon:    { G: 0.25, C: 0.20, E: 0.15, B: 0.15, A: 0.10, D: 0.10, F: 0.05 },
  // 傍 18-19: B 专业（干货/案例）+ A 观赏（高级配图）  ← D55-3 新增段
  evening: { B: 0.30, A: 0.20, G: 0.15, C: 0.10, F: 0.10, D: 0.10, E: 0.05 },
  // 晚 20-22: G 关系（连载/互动/复盘）+ C 情绪（软广种草）
  late:    { G: 0.30, C: 0.20, B: 0.15, E: 0.10, F: 0.10, D: 0.10, A: 0.05 },
  // 夜 22-23: E 生活（感悟/反思）+ D 身份（自嘲）
  night:   { E: 0.30, D: 0.20, F: 0.10, C: 0.10, B: 0.10, G: 0.10, A: 0.10 },
}

// 周末（D55-3 同步）：放松调性
export const WEEKEND_TONAL: Record<SlotId, Record<Dim, number>> = {
  morning: { E: 0.30, A: 0.20, C: 0.20, F: 0.10, D: 0.10, B: 0.05, G: 0.05 },
  noon:    { E: 0.25, C: 0.20, G: 0.20, A: 0.10, B: 0.10, F: 0.10, D: 0.05 },
  evening: { G: 0.20, C: 0.20, B: 0.15, A: 0.15, E: 0.15, F: 0.10, D: 0.05 },
  late:    { G: 0.25, E: 0.20, C: 0.15, B: 0.10, F: 0.10, D: 0.10, A: 0.10 },
  night:   { E: 0.30, D: 0.15, C: 0.15, A: 0.15, G: 0.10, F: 0.10, B: 0.05 },
}

// ============================================
// D36: 周主题 4 周循环（按 dim 7 维度权重）
// ============================================

export const WEEKLY_THEMES = {
  identity:   { label: '立人设',  weights: { D: 0.35, E: 0.25, A: 0.15, B: 0.10, C: 0.05, F: 0.05, G: 0.05 } },
  contrarian: { label: '反认知',  weights: { F: 0.35, C: 0.20, B: 0.15, E: 0.10, A: 0.10, D: 0.05, G: 0.05 } },
  story:      { label: '讲故事',  weights: { G: 0.30, E: 0.20, C: 0.15, B: 0.15, F: 0.10, A: 0.05, D: 0.05 } },
  boundary:   { label: '立边界',  weights: { D: 0.25, G: 0.20, C: 0.15, B: 0.15, F: 0.10, A: 0.10, E: 0.05 } },
} as const

export type WeeklyThemeId = keyof typeof WEEKLY_THEMES

// D36: 月主题 3 月循环（按 dim 7 维度权重）
export const MONTHLY_PHASES = {
  1: { label: '破冰', weights: { F: 0.30, C: 0.20, D: 0.15, B: 0.15, E: 0.10, A: 0.05, G: 0.05 } },
  2: { label: '转化', weights: { B: 0.25, G: 0.20, C: 0.15, F: 0.10, D: 0.10, A: 0.10, E: 0.10 } },
  3: { label: '复购', weights: { C: 0.20, E: 0.15, G: 0.20, D: 0.15, B: 0.15, A: 0.10, F: 0.05 } },
} as const

// D36: 周内 dayOfWeek 3 段（early/mid/weekend）
export const WEEKDAY_PHASE_WEIGHTS = {
  early:   { F: 0.25, D: 0.20, B: 0.15, C: 0.10, E: 0.10, A: 0.10, G: 0.10 },
  mid:     { B: 0.20, G: 0.20, C: 0.15, F: 0.15, A: 0.10, D: 0.10, E: 0.10 },
  weekend: { E: 0.25, A: 0.20, C: 0.20, G: 0.15, B: 0.10, D: 0.05, F: 0.05 },
} as const

// ============================================
// D36 工具函数（彻底用 dim 替换 post_type）
// ============================================

export function getWeeklyTheme(
  weekStart: string,
  userLocked: { theme: WeeklyThemeId } | null,
  cycleStart?: string | null  // D55-15: 用户 cycle 起点（YYYY-MM-DD），默认 2026-06-01
): { theme: WeeklyThemeId; weights: Record<string, number>; locked: boolean; cycleIndex: number; label: string } {
  // D55-17: cycleStart 对齐到所在周的周一（UTC ISO weekday 0=Mon）
  // 不对齐的话：cycleStart=周五 06-12，weekStart=周一 06-08，差 4 天 → weekDiff=-1 → cycleIndex=3（错位）
  const cs = new Date(cycleStart || '2026-06-01')
  const csDow = (cs.getUTCDay() + 6) % 7  // 0=Mon ... 6=Sun
  const startMs = cs.getTime() - csDow * 86400 * 1000
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

export function getMonthlyPhase(
  yearMonth: string,
  userCycleIndex: number | null,
  cycleStart?: string | null  // D55-15: 用户 cycle 起点（YYYY-MM-DD）
): { phase: 1|2|3; weights: Record<string, number>; locked: boolean; cycleIndex: number; label: string } {
  if (userCycleIndex && userCycleIndex >= 1 && userCycleIndex <= 3) {
    return { phase: userCycleIndex as 1|2|3, weights: MONTHLY_PHASES[userCycleIndex as 1|2|3].weights, locked: true, cycleIndex: userCycleIndex, label: MONTHLY_PHASES[userCycleIndex as 1|2|3].label }
  }
  const [y, m] = yearMonth.split('-').map(Number)
  // D55-17: cycleStart 对齐到所在月 1 号（避免 day-of-month 偏移）
  const cs = new Date(cycleStart || '2026-06-01')
  const startMs = Date.UTC(cs.getUTCFullYear(), cs.getUTCMonth(), 1)
  const currentMs = Date.UTC(y, m - 1, 1)
  const monthDiff = Math.round((currentMs - startMs) / (30 * 86400 * 1000))
  const cycleIndex = ((monthDiff % 3) + 3) % 3 + 1
  return { phase: cycleIndex as 1|2|3, weights: MONTHLY_PHASES[cycleIndex as 1|2|3].weights, locked: false, cycleIndex, label: MONTHLY_PHASES[cycleIndex as 1|2|3].label }
}

export function getWeekdayPhase(dayOfWeek: number): 'early'|'mid'|'weekend' {
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'weekend'
  if (dayOfWeek <= 3) return 'early'
  return 'mid'
}

// ============================================
// D45: 钩子口诀库（按 dim 分，每个 5 个钩子示例）
// ============================================
export const HOOK_HINTS: Record<Dim, string> = {
  A: `同色系自拍："本周主题色蓝色 → 蓝色西装自拍 + 蓝色背景咖啡馆"
L 型朋友圈："连续 3 张横图形成 L 视觉"
倒计时海报："倒计时 3 天 / 2 天 / 1 天橙色系方块"
裸拍产品图："胶原蛋白瓶裸拍 + 浅灰底（不贴海报）"
节日应景照："12 月 24 日拍一套圣诞照配文案"`,
  B: `效果对比："30 天前后对比图 + 数据描述"
用户反馈："客户说皮肤好截图 + 红框标注关键词"
业绩凡尔赛："正在喝鸡汤，叮铃铃微信到账 3720"
圈层背书："最近收到好多朋友的赠书：sponsor/陈玉琪/..."
考察过程："我自费去上海做尽职调查"`,
  C: `痛点 5 段式："人群画像+场景冲突+隐藏情绪+Why+金句"
对话公式："你以为给男人生孩子他就爱你一辈子吗？其实他只看到你越来越垮的脸"
互动："你怎么看？评论区扣字让我看到你"
福利互动："本条点赞第 28 位送神秘福利"
软广改写："睡前讲个故事...白雪公主问魔镜"`,
  D: `5 要素自我介绍："我做私域营销 8 年，累计营收一个亿..."
凡尔赛："我考过了注会、注册管理会计师、国际会计师"
90% 筛选："90% 的人不是我的客户，不要年收入 100 万以下的"
我是来找人的："我不是来销售的，我是来找人的"
立边界："所有机会都有窗口期，错过就拍大腿"`,
  E: `500 天坚持："我已经坚持早起 500 天" + 改变
小确幸："今天下楼买三明治，碰见个姑娘夸我皮肤好"
至暗时刻："我二姨得了癌症在医院的时候..."
旅居："在这个京郊小院子最舒服的时候是躺在沙发上..."
故事开头："那是一年的冬天..."`,
  F: `反认知金句："不好意思的本质是一种自私"
不是 X 而是 Y："創業第一桶金靠的不是管理，而是能量"
三流二流一流："三流卖产品二流卖理念一流卖自己"
数字型："成交成功率 70% 取决于销售前的准备，30% 靠临场发挥"
重新定义："所谓勇敢不是不害怕，而是能跟恐惧前行"`,
  G: `婚姻趣事："今天跟老公吃饭，假装很生气凡尔赛"
求互动："扣 1 我私聊"
卖货连载 8 步："需求→体验期→结果→求推荐→案例→考察→展示→正式出道"
辞职连载："我发了选择题→我放弃 70 万年薪..."
推产品 10 步："我月入 4 万你想不想要？→这事儿从 8 月说起"`,
}

// ============================================
// D45: 5 段 base 调性（D55-3 5 段最终版：早 F / 午 G / 傍 B / 晚 G+连载 / 夜 E）
// 上面 SLOT_TONAL_WEIGHTS 已经是按 5 段 + 7 dim 算的（不需再单独抽常量）
// ============================================

export interface SlotSuggestion {
  dim: Dim              // top1 推荐 dim（A-G）
  dim2: Dim             // 备选 top2
  weight1: number       // top1 权重（百分比 0-100）
  weight2: number       // top2 权重
  hookHint: string      // 钩子口诀（首行）
  // 完整 topN 列表（D46：给"🔄 换"按钮循环用）
  topN: Array<{ dim: Dim; weight: number }>
  // D55: 顶层推荐 category_id（来自 categories 表）
  categoryId?: string
  categoryName?: string
}

export interface DaySuggestion {
  date: string          // 'YYYY-MM-DD'
  weekday: number       // 0-6
  weekdayLabel: string  // '周五'
  isWeekend: boolean
  weekTheme: { theme: WeeklyThemeId; label: string; cycleIndex: number; locked: boolean; weights: Record<string, number> }
  monthPhase: { phase: 1|2|3; label: string; cycleIndex: number; locked: boolean; weights: Record<string, number> }
  weekdayPhase: 'early' | 'mid' | 'weekend'
  slots: Record<SlotId, SlotSuggestion>
  // 整日最推荐 = 5 段 top1 weight1 之和最大的 dim
  dayTopDim: Dim
  dayTopHint: string
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const DEFAULT_MONTH_W: Record<Dim, number> = { A: 0.14, B: 0.14, C: 0.14, D: 0.15, E: 0.14, F: 0.15, G: 0.14 }

export function computeDaySuggestions(
  date: string,
  themeMonth: { theme: string; weights: Record<string, number> } | null,
  weekdayWeights: typeof WEEKDAY_PHASE_WEIGHTS
): DaySuggestion {
  const d = new Date(date + 'T00:00:00')
  const weekday = d.getDay()
  const weekdayLabel = WEEKDAY_CN[weekday]
  const isWeekend = weekday === 0 || weekday === 6
  const weekdayPhase = getWeekdayPhase(weekday)
  const weekTheme = getWeeklyTheme(date, null)
  const monthPhase = getMonthlyPhase(date.slice(0, 7), null)
  const monthW = (themeMonth?.weights || DEFAULT_MONTH_W) as Record<Dim, number>

  // 5 段各自算
  const slots: Record<SlotId, SlotSuggestion> = {} as Record<SlotId, SlotSuggestion>
  for (const meta of SLOTS) {
    const slot = meta.id
    const base = isWeekend ? WEEKEND_TONAL[slot] : SLOT_TONAL_WEIGHTS[slot]
    const weekW = weekTheme.weights as Record<Dim, number>
    const phaseW = weekdayWeights[slot] || weekdayWeights
    // 联合：base 50% + month 20% + week 20% + weekday 10%
    const combined: Record<Dim, number> = {} as Record<Dim, number>
    for (const d of DIM_IDS) {
      combined[d] = (base[d] || 0) * 0.5 + (monthW[d] || 0) * 0.2 + (weekW[d] || 0) * 0.2 + (phaseW[d] || 0) * 0.1
    }
    // 排序取 top2
    const sorted = (Object.entries(combined) as [Dim, number][]).sort((a, b) => b[1] - a[1])
    const [d1, w1] = sorted[0] || ['A', 0]
    const [d2, w2] = sorted[1] || ['A', 0]
    // 钩子口诀取首行
    const firstHook = (HOOK_HINTS[d1] || '').split('\n').find(l => l.trim()) || ''
    const topN = sorted.map(([dim, w]) => ({ dim, weight: Math.round(w * 100) }))
    slots[slot] = {
      dim: d1,
      dim2: d2,
      weight1: Math.round(w1 * 100),
      weight2: Math.round(w2 * 100),
      hookHint: firstHook,
      topN,
    }
  }

  // 整日最推荐
  const dayTopScore: Record<string, number> = {}
  for (const meta of SLOTS) {
    const s = slots[meta.id]
    dayTopScore[s.dim] = (dayTopScore[s.dim] || 0) + s.weight1
  }
  const dayTopEntry = (Object.entries(dayTopScore) as [string, number][]).sort((a, b) => b[1] - a[1])[0] || ['A', 0]
  const dayTopFirstHook = (HOOK_HINTS[dayTopEntry[0] as Dim] || '').split('\n').find(l => l.trim()) || ''

  return {
    date,
    weekday,
    weekdayLabel,
    isWeekend,
    weekTheme,
    monthPhase,
    weekdayPhase,
    slots,
    dayTopDim: dayTopEntry[0] as Dim,
    dayTopHint: dayTopFirstHook,
  }
}

// ============================================
// D37: 加载 user 自己的 weekday 权重
// ============================================
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

// ============================================
// D55: 加载 categories 表（顶层分类 + AI prompt 映射）
// ============================================
export interface CategoryRow {
  id: string
  dim: Dim
  category: string
  subcategory: string
  name: string
  description: string
  slot: SlotId
  slot_secondary: string | null  // JSON array
  ai_prompt_id: string
  ai_prompt_focus: string
  sort_order: number
  is_active: number
  created_at: number
  updated_at: number | null
}

export interface FrameRow {
  id: string
  category_id: string
  code: string
  name: string
  structure: string
  example: string
  image_hint: string
  image_source: string
  slot: SlotId
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string
  sort_order: number
  is_active: number
  created_at: number
  updated_at: number | null
}

export async function loadCategories(
  env: { DB?: D1Database },
  dim?: Dim
): Promise<CategoryRow[]> {
  if (!env.DB) return []
  try {
    const sql = dim
      ? "SELECT * FROM categories WHERE dim = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC"
      : "SELECT * FROM categories WHERE is_active = 1 ORDER BY dim ASC, sort_order ASC, id ASC"
    const stmt = env.DB.prepare(sql)
    const result = dim ? await stmt.bind(dim).all<CategoryRow>() : await stmt.all<CategoryRow>()
    return result.results || []
  } catch {
    return []  // migration 还没跑
  }
}

export async function loadFramesByCategory(
  env: { DB?: D1Database },
  categoryId: string
): Promise<FrameRow[]> {
  if (!env.DB) return []
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM frames WHERE category_id = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC"
    ).bind(categoryId).all<FrameRow>()
    return result.results || []
  } catch {
    return []
  }
}

export async function loadTopCategoryForDim(
  env: { DB?: D1Database },
  dim: Dim,
  slot?: SlotId
): Promise<CategoryRow | null> {
  if (!env.DB) return null
  try {
    let sql = "SELECT * FROM categories WHERE dim = ? AND is_active = 1"
    const params: unknown[] = [dim]
    if (slot) {
      sql += " AND (slot = ? OR slot_secondary LIKE ?)"
      params.push(slot, `%"${slot}"%`)
    }
    sql += " ORDER BY sort_order ASC LIMIT 1"
    const row = await env.DB.prepare(sql).bind(...params).first<CategoryRow>()
    return row
  } catch {
    return null
  }
}

// ============================================
// 工具函数
// ============================================
export function isDim(s: string): s is Dim {
  return (DIM_IDS as readonly string[]).includes(s)
}
export function isSlot(s: string): s is SlotId {
  return (SLOT_IDS as readonly string[]).includes(s)
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// D55-16: Workers 默认 UTC，但排期日期是用户本地日期（CST = UTC+8）
// 用 Intl.DateTimeFormat 强制按指定时区格式化（不污染原 Date 对象）
export function ymdInTZ(d: Date, timeZone: string = "Asia/Shanghai"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find(p => p.type === "year")?.value || "1970"
  const m = parts.find(p => p.type === "month")?.value || "01"
  const day = parts.find(p => p.type === "day")?.value || "01"
  return `${y}-${m}-${day}`
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// D29+ 段配置解析（保持原样：4 段 → 5 段扩展，但 resolveEnabledSlots 仍可工作）
export function resolveEnabledSlots(
  settings: { default_slots_per_day: number; slot_config_json: string | null } | null,
  date: string
): SlotId[] {
  if (settings?.slot_config_json) {
    try {
      const m = JSON.parse(settings.slot_config_json)
      if (Array.isArray(m._default)) {
        if (Array.isArray(m[date])) return m[date] as SlotId[]
        const valid = (m._default as unknown[]).filter(
          (s): s is SlotId => typeof s === "string" && (SLOT_IDS as readonly string[]).includes(s)
        )
        if (valid.length > 0) return valid
      }
      if (Array.isArray(m[date])) return m[date] as SlotId[]
    } catch {}
  }
  const n = settings?.default_slots_per_day
  if (n && n > 0 && n < 5) return SLOTS.slice(0, Math.min(5, n)).map(s => s.id)
  return SLOTS.map(s => s.id)
}

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
    return ["morning"]
  }
}

// D55-12 兼容：D54 的 TYPE_SUBTHEMES/pickSubtheme 在 D55 切换 dim 时被删，
// 但 today.ts line 578/618 还在用。加 stub 让 /today 跑得通（返回 null 时 UI 不显示 subtheme 标签）
export function pickSubtheme(_key: string, _date: string): { id: string; label: string } | null {
  return null
}

// D55-12 兼容：D55 删了 DIMENSION_TYPE_MAP（旧 type→旧 type[] 映射），但 today.ts line 177/682 还在用。
// 返回 dim→dim 自身映射，UI 渲染空块（不影响 /today 200）
export const DIMENSION_TYPE_MAP: Record<string, string[]> = {
  A: ["A"], B: ["B"], C: ["C"], D: ["D"], E: ["E"], F: ["F"], G: ["G"],
}

// D55-12 兼容：D55 删了 reverseDimensionMap，但 today.ts line 177 dynamic import 解构里还在用
export function reverseDimensionMap(_postType: string): string[] {
  return []
}
