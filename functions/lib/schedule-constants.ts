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

// D45: 类型小主题库（按课程 7 场景 A-G + 全套循环体系对齐）
// 第一行 = 核心公式；后续 = 课程里有的小主题
// 渲染：today.ts 用 white-space: pre-line 保留换行
export const TYPE_TIPS: Record<string, string> = {
  "干货": `核心公式：痛点具象化 = 人群画像 + 场景冲突 + 隐藏情绪 + Why + 金句/价值观结尾
📍 场景 D 痛点具象化：害怕 / 恐惧 / 担忧 / 焦虑 / 痛苦 / 同付出不同回报 / 不公平对待
🔑 刺痛关键词：教育焦虑(35岁危机/工资倒挂/被裁员/学历歧视) · 情感危机(冷暴力/丧偶式育儿/查手机/失眠) · 副业(死工资/房贷压顶/鄙视链底层) · 健康(体检警告/前任羞辱)
💡 反认知金句 11 公式（[[08 反认知金句]]）：[你以为的 X] = [实际是 Y]
✍️ 写痛点 3 法：①具象化(词→短句→小短文→长文章) ②故事文万能结构 ③谈单句式("明明…但…"/"你是不是最近…")
👤 场景 A 立人设 4 步：基础自我介绍(成就结果/帮助人数/踩坑/改变/身份) → 20 句凡尔赛一句话 → 7 年年轮法个人故事 → 1 段朋友圈简介
🗓 第 1 月破冰月：大量输出痛点共鸣 + 反认知 + 免费初筛钩子，专业干货占比高
❌ 避坑：不要把多个痛点堆在一个故事里 / 不要一上来直接讲产品（先共鸣+反认知+救赎）`,

  "生活": `核心心法："先成为有趣的人，再去做有趣的事"。跟闺蜜聊天的状态，私聊不要用"您"用"你"
🎭 有趣好玩 5 种写法（场景 F）：①生活片段有趣(天道好轮回) ②幽默段子 ③剧本式 ④自嘲自黑反转 ⑤软广场景化
🌱 价值观 5 种（场景 F）：①社会现象看法 ②新闻热点 ③观后感/读后感 ④成长感悟 ⑤改变心得
🌸 生活小确幸/至暗：下午茶感悟、跑步 500 天改变、辞职/结婚连载、命理师视角、宝妈时间管理
📸 配图建议：高颜值自拍、宠物/小孩、同色系九宫格、生活格调照
📆 周六至周日比重增加(70%)：周末放松，多发高颜值生活照、社交合影、生命经历故事
♻️ 月末归档：3 个月后从"已发内容"库自动提示可重新发布（一鸭多吃）`,

  "客户": `核心公式：谁 + 痛点 + 做了什么 + 结果 + 原话（客户证言万能模板）
🎙 直播稿 SOP 6 步（场景 C）：自我介绍 → 圈人群(用户画像) → 痛点 → 理念 → 好评 → 产品
📣 朋友圈宣发 4 步：①结果前置引发好奇("21 天收款 188 万") ②之前多惨("被坑一万，啥都没学到") ③经过我们什么("21 天实战代练") ④改变结果对比 + 结尾引发好奇("点赞=像素级拆解")
🛍 塑产品 5 种讲述：①场景描述(用小词不用大词) ②打比方 ③讲故事(why-how-what) ④举例子 ⑤做对比(价值塑造→破价)
📦 客户案例 5 要素：persona(谁) / pain(痛点) / action(做了什么) / result(结果) / testimonial(原话)
📸 配图建议：前后反差图、客户反馈截图、报喜收款图、工艺/方法拆解
❌ 避坑：不要只讲产品好处(用户要解决方案不是产品) / 不要先讲产品再讲理念`,

  "互动": `核心公式：场景描述 + 灵魂提问 + 引导回应（评论区扣字 / 点赞=福利）
🪝 3 类钩子（场景 B）：①加 V 钩子(朋友圈 → 评论区扣"想"我私聊发《100 个赚钱锦囊》) ②私聊钩子(社群 → 今天没讲完下条揭秘) ③线索钩子(直播 → 扫码填《商业测评》)
🎁 福利互动（场景 F）：第 28 位 / 38 位点赞获得神秘福利
💬 观点型互动（场景 F）："XX 这件事你怎么看？站队 A 扣 1，站队 B 扣 2"
🌍 生活话题互动（场景 F）："今天做的 XXX，你们也这样做吗？"
📍 发钩子的 5 个场景：朋友圈结尾 / 社群分享结尾 / 直播分享结尾 / 公众号文章结尾 / 小绿书
❌ 避坑：不要给客户发一大堆资料(资料做弹药库先私聊) / 不要把问卷当普通链接`,

  "软广": `核心心法：种草不硬广，产品是配角，故事是主角
🎬 软广 5 步法（场景 E）：①确定产品 → ②确定使用场景 → ③确定故事场景(耳熟能详) → ④确定植入片段(产品亮点自然插入) → ⑤改写故事(保持原貌加产品细节)
📚 4 种故事类型：①改写童话(灰姑娘/白雪公主/西游记/牛郎织女) ②改写古代(后羿射日/哪吒) ③改写电视剧(甄嬛传/还珠格格) ④改写日常生活
✨ 成功案例：白雪公主+魔镜+面膜 / 西游记+吹风机(孙悟空用速飞记忆负离子) / 牛郎织女+教育金保单(王母拔金钗划银河) / 后羿射日+太阳眼镜 / 甄嬛传+英子护肤神器
🚫 朋友圈广告 6 大误区：①说明书式 ②没剧情直接讲好处 ③没产品亮点 ④配图辣眼睛 ⑤天天硬广 ⑥不敢"脱文化"
📸 配图建议：反馈截图、高颜值产品场景图、客户使用对比图
❌ 避坑：故事要选大家耳熟能详的(记忆装置已安装) / 不要把广告硬塞进故事`,

  "复盘": `核心公式：故事万能模板 = 背景 + 冲突 + 转折 + 结果 + 反思
📅 7 年年轮法（场景 A）：把人生/创业/项目切成 7 个关键节点，每节点一主题（立人设/转折/踩坑/复盘等）
📣 宣发 4 步（场景 C）：①结果前置(21 天收款 188 万) ②之前多惨 ③经过我们什么 ④改变结果对比
🔁 反差钩子："30 天前 XXX，现在 XXX"（高光+至暗双线）
📊 周复盘：本周干货已发 N 条·软目标 M 条 + 7 维度覆盖 + 维度诊断（自动提示补哪个）
📦 月末归档：本月爆款(好案例/好故事)打标签入库，3 个月后可复用
❌ 避坑：不要把多个痛点堆在一个故事里 / 不要把别人删改照搬抄过来(要加自己东西)`,

  "休息": `1 张图 + 1 句心情，不强求转化
🛡 防折叠规则（场景 G）：不超一个手机屏幕 / 段落空行 / 配图不要 5/7/8 张缺角 / 表情符号不要太多
📗 小绿书操作：选"图片文字"创建 → 拖图片 + 输标题 + 输文字 → 直接放二维码（朋友圈不被折叠）
🧩 基础三件套：头像(真人露脸) / 朋友圈封面(真人高级感照，不要用海报) / 签名(价值观/初心/我解决什么问题)
✒️ 一条朋友圈只表达一个核心要点，不要堆多个意思
🕐 最佳时段：周末早 8 / 节假日 / 情绪低沉日`,
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

// 决定某天该开几段：D50 _default 数组 > per-date JSON 覆盖 > 默认 N 段
export function resolveEnabledSlots(
  settings: { default_slots_per_day: number; slot_config_json: string | null } | null,
  date: string
): SlotId[] {
  if (settings?.slot_config_json) {
    try {
      const m = JSON.parse(settings.slot_config_json)
      // 1. D50: 全局 _default 数组（用户勾了哪几段就是哪几段，顺序由勾选决定）
      if (Array.isArray(m._default)) {
        // per-date 覆盖优先于 _default
        if (Array.isArray(m[date])) return m[date] as SlotId[]
        const valid = (m._default as unknown[]).filter(
          (s): s is SlotId => typeof s === "string" && (SLOT_IDS as readonly string[]).includes(s)
        )
        if (valid.length > 0) return valid
      }
      // 2. 老格式：只有 per-date 覆盖
      if (Array.isArray(m[date])) return m[date] as SlotId[]
    } catch {}
  }
  // 3. 兜底：默认 N 段（D29 行为，向后兼容）
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

// ============================================
// D42-E: "💡 明日建议" 纯函数（不依赖 D1，给 today.ts 复用 seed 权重算法）
// 输入：date + 主题月 + weekday 权重 → 输出 4 段 top1/top2 + 钩子建议
// ============================================

// D45: 钩子口诀库（每类型 5 个钩子示例，来自课程 7 场景）
// 渲染：computeDaySuggestions 取首行；today.ts /today 卡片提示也用首行
export const HOOK_HINTS: Record<string, string> = {
  '干货': `反认知金句："你以为的 X = 实际是 Y"（11 公式之一）
人群画像："35 岁 / 工资倒挂 / 被裁员 / 房贷压顶的你，看到这条算我提醒你"
场景冲突："昨天朋友跟我哭诉：明明很努力，身边人却比自己好太多"
隐藏情绪："你说累的不是工作，是看着别人涨薪你原地踏步"
谈单句式："明明很想要，但就是下不了决心。你是不是最近心里有点不足？"`,

  '生活': `小确幸："今天 XXX，让我想起..."（配高颜值生活照）
至暗时刻："30 天前 XXX，现在 XXX"（生活版反差钩子）
幽默段子："刚才 XXX，差点把我笑死（配剧本式场景）"
自嘲自黑："我就是那种...的人，你们身边有吗？"
观后感："刚看完《XXX》，有句话扎到我了：..."`,

  '客户': `客户原话开场："XXX 跟我说：'...'"（配客户反馈截图）
结果前置："21 天收款 188 万，你想不想要？"
之前多惨："之前被坑一万，啥都没学到"
圈人群："如果你也是 XX 岁 / XX 行业 / XX 阶段，这篇必看"
理念前置："今天不卖产品，只讲一个我用了 5 年的理念..."`,

  '互动': `场景提问："你们有没有遇到 XXX？评论区扣字让我看到你"
福利互动："本条点赞第 28 位/38 位，送《100 个赚钱锦囊》"
观点型："XX 这件事你怎么看？站队 A 扣 1，站队 B 扣 2"
生活话题："今天做的 XXX，你们也这样做吗？评论区见"
钩子结尾："评论区扣'想'我私聊发《XXX 资料》"`,

  '软广': `痛点场景："如果你也 XXX，那你一定要看..."
故事开场："白雪公主问魔镜：谁是这世上最美的女人？（魔镜回答 → 引出产品）"
反差钩子："30 天前 XXX，现在 XXX（用产品改变）"
场景描述："早上 6 点的厨房，我拿出 XXX...（产品自然出现）"
打比方："这款面膜好用到什么程度？好到...（夸张比喻）"`,

  '复盘': `反差钩子："30 天前 XXX，现在 XXX"
结果前置："21 天收款 188 万，我是怎么做到的？"
踩坑故事："那一年我亏了 XXX 万，学到了..."
年轮开场："我的 7 年里，XXX 那年最关键"
复盘总结："本月写了 XXX 条朋友圈，数据最好的是..."`,

  '休息': `放空："今天不想说话，放张图，大家周末愉快"
心情："今天天气 XXX，心情也 XXX"
感谢："感谢 XXX 给我点的赞，你们是动力"
周末："周六早上 8 点，一杯咖啡，一页书"`,
}

// 4 段 base 调性（D44 严诼按课程"日排口诀"对齐）
// 课程口诀:早起发思想/生活,中午发专业/案例,晚上发故事/报喜
const SLOT_TONAL_WEIGHTS: Record<SlotId, Record<string, number>> = {
  morning: { "干货": 0.40, "生活": 0.25, "复盘": 0.20, "客户": 0.10, "互动": 0.05 },
  noon:    { "干货": 0.30, "客户": 0.25, "软广": 0.20, "互动": 0.10, "复盘": 0.08, "生活": 0.05, "休息": 0.02 },
  evening: { "复盘": 0.25, "客户": 0.20, "互动": 0.20, "软广": 0.15, "干货": 0.10, "生活": 0.10 },
  night:   { "复盘": 0.40, "互动": 0.25, "干货": 0.15, "生活": 0.10, "客户": 0.05, "软广": 0.05 },
}

// 周末:偏生活/休息/复盘(周末放松,反思本周)
const WEEKEND_TONAL: Record<SlotId, Record<string, number>> = {
  morning: { "生活": 0.35, "休息": 0.25, "干货": 0.15, "复盘": 0.10, "客户": 0.10, "互动": 0.05 },
  noon:    { "生活": 0.35, "互动": 0.25, "休息": 0.15, "客户": 0.10, "干货": 0.10, "软广": 0.05 },
  evening: { "软广": 0.25, "客户": 0.20, "生活": 0.20, "互动": 0.15, "干货": 0.10, "复盘": 0.10 },
  night:   { "复盘": 0.30, "生活": 0.25, "休息": 0.20, "互动": 0.15, "干货": 0.10 },
}

export interface SlotSuggestion {
  type: string          // top1 推荐 type
  type2: string         // 备选 top2
  weight1: number       // top1 权重（百分比 0-100）
  weight2: number       // top2 权重
  hookHint: string      // 钩子口诀
  topDims: string[]     // 这个 type 关联的 7 维度
  // D46: 完整排序（top1, top2, top3, ...）给"🔄 换"按钮循环用
  topN: Array<{ type: string; weight: number }>
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
  // 整日最推荐 = 4 段 top1 weight1 之和最大的 type
  dayTopType: string
  dayTopHint: string
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const DEFAULT_MONTH_W = { '干货': 0.15, '生活': 0.15, '客户': 0.14, '互动': 0.14, '软广': 0.14, '复盘': 0.14, '休息': 0.14 }

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
  const monthW = themeMonth?.weights || DEFAULT_MONTH_W

  // 4 段各自算
  const slots: Record<SlotId, SlotSuggestion> = {} as Record<SlotId, SlotSuggestion>
  for (const meta of SLOTS) {
    const slot = meta.id
    // D44: base 已经是按课程口诀的 (noon = 专业+案例 干货+客户), 不再需要特殊覆盖
    const base = isWeekend ? WEEKEND_TONAL[slot] : SLOT_TONAL_WEIGHTS[slot]
    const weekW = weekTheme.weights
    const phaseW = weekdayWeights[weekdayPhase]
    // 联合：50/20/20/10
    const combined: Record<string, number> = {}
    for (const t of ROTATION) {
      combined[t] = (base[t] || 0) * 0.5 + (monthW[t] || 0) * 0.2 + (weekW[t] || 0) * 0.2 + (phaseW[t] || 0) * 0.1
    }
    // 排序取 top2
    const sorted = (Object.entries(combined) as [string, number][]).sort((a, b) => b[1] - a[1])
    const [t1, w1] = sorted[0] || ['休息', 0]
    const [t2, w2] = sorted[1] || ['休息', 0]
    const topDims = reverseDimensionMap(t1)
    // D45: HOOK_HINTS 现在是多行（5 个钩子），卡片只显示首行（最常用的那个）
    const firstHook = (HOOK_HINTS[t1] || '').split('\n').find(l => l.trim()) || ''
    // D46: 完整 topN 列表给"🔄 换"按钮循环
    const topN = sorted.map(([type, w]) => ({ type, weight: Math.round(w * 100) }))
    slots[slot] = {
      type: t1,
      type2: t2,
      weight1: Math.round(w1 * 100),
      weight2: Math.round(w2 * 100),
      hookHint: firstHook,
      topDims,
      topN,
    }
  }

  // 整日最推荐
  const dayTopScore: Record<string, number> = {}
  for (const meta of SLOTS) {
    const s = slots[meta.id]
    dayTopScore[s.type] = (dayTopScore[s.type] || 0) + s.weight1
  }
  const dayTopEntry = (Object.entries(dayTopScore) as [string, number][]).sort((a, b) => b[1] - a[1])[0] || ['休息', 0]
  // D45: dayTopHint 也取首行
  const dayTopFirstHook = (HOOK_HINTS[dayTopEntry[0]] || '').split('\n').find(l => l.trim()) || ''

  return {
    date,
    weekday,
    weekdayLabel,
    isWeekend,
    weekTheme,
    monthPhase,
    weekdayPhase,
    slots,
    dayTopType: dayTopEntry[0],
    dayTopHint: dayTopFirstHook,
  }
}
