// ============================================
// 周复盘工具（D30）
// - 周定义：周一到周日（ISO week）
// - 汇总：周内 schedule 数据（posted / skipped / pending + 4 段分布 + 7 类分布）
// ============================================

export interface WeeklySummary {
  id?: string
  user_id: string
  week_start: string   // YYYY-MM-DD（周一）
  week_end: string     // YYYY-MM-DD（周日）
  posted_count: number
  skipped_count: number
  pending_count: number
  type_breakdown: Record<string, number>
  slot_breakdown: Record<string, number>
  summary_text: string | null
  generated_at: number
}

// ISO week 周一 = (d.getDay() + 6) % 7 === 0
export function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const wd = (x.getDay() + 6) % 7  // 周一=0
  x.setDate(x.getDate() - wd)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return e
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// 取本周 + 上周 + 本月汇总
export interface WeeklyData {
  week_start: string
  week_end: string
  posted: number
  skipped: number
  pending: number
  total: number
  byType: Record<string, number>
  bySlot: Record<string, number>
  byDay: Array<{ date: string; post_type: string; slot: string; status: string }>
}

export async function loadWeekData(env: D1Database, userId: string, weekStart: Date): Promise<WeeklyData> {
  const start = ymd(weekStart)
  const end = ymd(addDays(weekStart, 6))

  const rows = await env.prepare(
    "SELECT date, slot, post_type, status FROM schedule WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, slot"
  ).bind(userId, start, end).all<{ date: string; slot: string; post_type: string; status: string }>()

  const byType: Record<string, number> = {}
  const bySlot: Record<string, number> = {}
  let posted = 0, skipped = 0, pending = 0
  for (const r of rows.results || []) {
    if (r.status === 'posted') posted++
    else if (r.status === 'skipped') skipped++
    else pending++
    byType[r.post_type] = (byType[r.post_type] || 0) + 1
    bySlot[r.slot] = (bySlot[r.slot] || 0) + 1
  }

  return {
    week_start: start,
    week_end: end,
    posted,
    skipped,
    pending,
    total: (rows.results || []).length,
    byType,
    bySlot,
    byDay: rows.results || [],
  }
}

// 渲染"本周 X 条"自然语言
export function renderSummaryText(data: WeeklyData): string {
  if (data.total === 0) {
    return `本周（${data.week_start} - ${data.week_end}）还没排期。开始 seed 30 天，4 段都填起来吧。`
  }
  const parts: string[] = []
  parts.push(`📊 本周（${data.week_start} - ${data.week_end}）发朋友圈 ${data.posted} 条`)
  if (data.skipped > 0) parts.push(`跳 ${data.skipped} 条`)
  if (data.pending > 0) parts.push(`待发 ${data.pending} 条`)
  // 4 段分布
  const slotOrder = ['morning', 'noon', 'evening', 'night']
  const slotLabels = { morning: '早 8', noon: '午 12:30', evening: '晚 20', night: '夜 22:30' } as Record<string, string>
  const slotParts = slotOrder.filter(s => data.bySlot[s]).map(s => `${slotLabels[s]}=${data.bySlot[s]}`)
  if (slotParts.length > 0) parts.push(`分段：${slotParts.join(' / ')}`)
  // 7 类分布
  const typeParts = Object.entries(data.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`)
  if (typeParts.length > 0) parts.push(`类型：${typeParts.join(' / ')}`)
  return parts.join(' · ')
}
