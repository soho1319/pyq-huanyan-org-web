// ============================================
// GET /api/categories/grouped
// D55-19: 返回全 7 维度 categories（按 dim → category → subcategory 嵌套）
// 输出格式：
// {
//   ok: true,
//   dims: [
//     { id: 'A', name: '观赏', categories: [
//       { name: '金句', subcategories: [
//         { id: 'A1-1', name: '...', description: '...', ai_prompt_focus: '...', slot: 'morning' }
//       ]}
//     ]}
//   ]
// }
// ============================================

import { getUser, json, jsonError, CrudError } from "../crud-helper"

interface CategoryRow {
  id: string; dim: string; category: string; subcategory: string; name: string;
  description: string | null; slot: string; slot_secondary: string | null;
  ai_prompt_id: string; ai_prompt_focus: string | null; sort_order: number;
}

const DIM_NAMES: Record<string, string> = {
  A: '观赏', B: '专业', C: '情绪', D: '身份', E: '生活', F: '思想', G: '关系',
}
const DIM_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

export async function onRequestGet(ctx: {
  request: Request
  env: { DB?: D1Database }
  data: Record<string, unknown>
}): Promise<Response> {
  try {
    const user = ctx.data.user as { id: string } | undefined
    if (!user) {
      // 中间件已校验，这里兜底
      return new Response("未登录", { status: 401 })
    }
    if (!ctx.env.DB) throw new CrudError("D1 未配置", 500)

    const rows = await ctx.env.DB.prepare(
      "SELECT id, dim, category, subcategory, name, description, slot, slot_secondary, ai_prompt_id, ai_prompt_focus, sort_order FROM categories WHERE is_active = 1 ORDER BY dim ASC, sort_order ASC, subcategory ASC"
    ).all<CategoryRow>()

    // 按 dim → category → subcategory 嵌套
    const dimMap: Record<string, { id: string; name: string; categories: Map<string, { name: string; subcategories: CategoryRow[] }> }> = {}
    for (const d of DIM_IDS) {
      dimMap[d] = { id: d, name: DIM_NAMES[d], categories: new Map() }
    }
    for (const r of rows.results || []) {
      const dimBucket = dimMap[r.dim]
      if (!dimBucket) continue
      if (!dimBucket.categories.has(r.category)) {
        dimBucket.categories.set(r.category, { name: r.category, subcategories: [] })
      }
      dimBucket.categories.get(r.category)!.subcategories.push(r)
    }

    // Map → Array 序列化
    const dims = DIM_IDS.map(d => ({
      id: d,
      name: DIM_NAMES[d],
      categories: Array.from(dimMap[d].categories.values()).map(cat => ({
        name: cat.name,
        subcategories: cat.subcategories.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          slot: s.slot,
          slot_secondary: s.slot_secondary,
          ai_prompt_id: s.ai_prompt_id,
          ai_prompt_focus: s.ai_prompt_focus,
        })),
      })),
    }))

    return json({ ok: true, dims, total: (rows.results || []).length })
  } catch (err) {
    return jsonError(err)
  }
}
