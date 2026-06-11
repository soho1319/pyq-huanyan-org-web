// ============================================
// 把 content/ 里的中文文件名 + 文件夹名都改成 ASCII
// 解决 Quartz 4.5.1 slug 含中文 → CF Pages 404 问题
//
// 用法: node scripts/rename-to-ascii.js
// ============================================

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'content')

// 重命名映射（旧 → 新）
const FILE_MAP = {
  '00 - 内容营销朋友圈小助手（MOC入口）.md':           '00-moc.md',
  '01 -20节课核心速查.md':                              '01-course-summary.md',
  '02 -朋友圈公式库（11公式 +23结构）.md':              '02-formula-library.md',
  '03 -朋友圈 SOP 按场景查.md':                         '03-sop-scenarios.md',
  '04 - 人设7 大维度 +朋友圈诊断.md':                   '04-persona-diagnose.md',
  '05 -软广改写故事 + 立边界5 类句式.md':               '05-soft-ad-boundary.md',
  '06 -故事写作万能模板.md':                            '06-story-template.md',
  '07 -朋友圈诊断10 项检查清单.md':                     '07-diagnose-checklist.md',
  '08 - 反认知金句11公式 +痛点具象化.md':               '08-contrarian-pain.md',
  '20 -30 天朋友圈 SOP.md':                             '20-30day-sop.md',
  '30 - AI Prompt库（10场景）.md':                      '30-ai-prompts.md',
  '35 - 文案库总览（7维度×大类×小类）.md':              '35-copy-library.md',
  '36 - D55 数据库 schema 设计.md':                     '36-d55-schema.md',
}

const OLD_FOLDER = '内容营销朋友圈助手'
const NEW_FOLDER = 'pyq-helper'

// wikilink 替换规则（wikilink 不带 .md）
const stripMd = (s) => s.replace(/\.md$/, '')
const WIKILINK_REPLACEMENTS = [
  // 带 "内容营销朋友圈助手/" 前缀的
  ...Object.entries(FILE_MAP).map(([old, neu]) => [
    `[[${OLD_FOLDER}/${stripMd(old)}]]`,
    `[[${NEW_FOLDER}/${stripMd(neu)}]]`,
  ]),
  // 不带前缀的
  ...Object.entries(FILE_MAP).map(([old, neu]) => [
    `[[${stripMd(old)}]]`,
    `[[${stripMd(neu)}]]`,
  ]),
]

function main() {
  const oldDir = path.join(ROOT, OLD_FOLDER)
  const newDir = path.join(ROOT, NEW_FOLDER)
  if (!fs.existsSync(oldDir)) {
    console.log(`✗ 源文件夹不存在: ${oldDir}`)
    process.exit(1)
  }
  if (fs.existsSync(newDir)) {
    console.log(`✗ 目标文件夹已存在: ${newDir}（先手动删除或合并）`)
    process.exit(1)
  }

  // 1. 建新文件夹 + 移动文件
  fs.mkdirSync(newDir, { recursive: true })
  for (const [oldName, newName] of Object.entries(FILE_MAP)) {
    const oldPath = path.join(oldDir, oldName)
    const newPath = path.join(newDir, newName)
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath)
      console.log(`  ✓ ${oldName} → ${NEW_FOLDER}/${newName}`)
    } else {
      console.log(`  ⚠ 跳过（不存在）: ${oldName}`)
    }
  }
  // README.md 单独处理
  const readmeOld = path.join(oldDir, 'README.md')
  if (fs.existsSync(readmeOld)) {
    fs.renameSync(readmeOld, path.join(newDir, 'README.md'))
    console.log(`  ✓ README.md → ${NEW_FOLDER}/README.md`)
  }
  // 删空旧文件夹
  const remaining = fs.readdirSync(oldDir)
  if (remaining.length === 0) {
    fs.rmdirSync(oldDir)
    console.log(`  ✓ 删空文件夹: ${OLD_FOLDER}/`)
  } else {
    console.log(`  ⚠ 旧文件夹还有内容未搬: ${remaining.join(', ')}`)
  }

  // 2. 扫所有 .md，更新 wikilink
  console.log('\n=== 更新 wikilink ===')
  let updated = 0
  const allFiles = []
  walk(ROOT, allFiles)
  for (const fp of allFiles) {
    let c = fs.readFileSync(fp, 'utf-8')
    let changed = false
    for (const [old, neu] of WIKILINK_REPLACEMENTS) {
      if (c.includes(old)) {
        c = c.split(old).join(neu)
        changed = true
      }
    }
    if (changed) {
      fs.writeFileSync(fp, c, 'utf-8')
      updated++
      console.log(`  ✓ ${path.relative(ROOT, fp)}`)
    }
  }
  console.log(`\n共更新 ${updated} 个文件`)
}

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name.startsWith('.')) continue
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p, out)
    else if (f.name.endsWith('.md')) out.push(p)
  }
}

main()
