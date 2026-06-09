#!/bin/bash
# ============================================
# pyq.huanyan.org ·同步 vault 内容到 content/
# ============================================

set -e

cd "$(dirname "$0")/.."

echo ""
echo "============================================"
echo "同步 vault 内容到 content/"
echo "============================================"
echo ""

SOURCE1="/d/Backup/Documents/我的Obsidian文档/一人公司/内容营销朋友圈助手"
SOURCE2="/d/Backup/Documents/我的Obsidian文档/内容营销朋友圈/doc"
TARGET="content"

mkdir -p "$TARGET"

#1.复制助手笔记
echo "[1/3] 复制助手笔记 ..."
if [ -d "$SOURCE1" ]; then
 cp -rf "$SOURCE1"/* "$TARGET/"2>/dev/null || true
 #隐藏文件夹排除
 rm -rf "$TARGET/.obsidian"2>/dev/null || true
 rm -rf "$TARGET/.trash"2>/dev/null || true
 echo "已复制：助手笔记"
else
 echo "[警告] 找不到 $SOURCE1"
fi

#2.复制课程原文
echo ""
echo "[2/3] 复制20节课程原文 ..."
if [ -d "$SOURCE2" ]; then
 mkdir -p "$TARGET/课程原文"
 cp -rf "$SOURCE2"/* "$TARGET/课程原文/"
 echo "已复制：课程原文"
else
 echo "[警告] 找不到 $SOURCE2 （跳过）"
fi

#3. Git
echo ""
echo "[3/3] Git commit + push ..."
git add content
git status
echo ""
git commit -m "feat: sync vault content to GitHub"
echo ""
git push

echo ""
echo "============================================"
echo "同步完成！"
echo "============================================"
echo ""
echo "content/目录里的内容已经推送到 GitHub"
echo "CF Pages 下次部署时会自动 build"
