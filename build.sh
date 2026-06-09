#!/bin/bash
# ============================================
# pyq.huanyan.org · CF Pages build脚本
#
# 功能：
#1.临时 clone Quartz v4 到 vendor/quartz/
#2.复制 content + 配置 + functions 到 Quartz
#3.跑 npx quartz build
#
# CF Pages 配置：
# Build command: bash build.sh
# Build output directory: vendor/quartz/public
# ============================================

set -e

echo ""
echo "============================================"
echo "pyq.huanyan.org · CF Pages Build"
echo "============================================"
echo ""

REPO_DIR="$(pwd)"
QUARTZ_DIR="$REPO_DIR/vendor/quartz"

#1. Clone Quartz
echo "[1/5] Clone Quartz v4 ..."
if [ -d "$QUARTZ_DIR" ]; then
 echo "vendor/quartz 已存在，跳过 clone"
else
 git clone --depth1 https://github.com/jackyzha0/quartz.git "$QUARTZ_DIR"
fi

#2.复制配置
echo ""
echo "[2/5] 复制自定义配置 ..."
cp -rf "$REPO_DIR/quartz.config.ts" "$QUARTZ_DIR/quartz.config.ts"
cp -rf "$REPO_DIR/quartz.layout.ts" "$QUARTZ_DIR/quartz.layout.ts"2>/dev/null || true

#3.复制 content（vault 内容）
echo ""
echo "[3/5] 复制 content ..."
rm -rf "$QUARTZ_DIR/content"
cp -rf "$REPO_DIR/content" "$QUARTZ_DIR/content"

#4.复制自定义组件 + functions
echo ""
echo "[4/5] 复制 components + functions ..."
cp -rf "$REPO_DIR/components/." "$QUARTZ_DIR/components/"
cp -rf "$REPO_DIR/functions" "$QUARTZ_DIR/functions"
cp -rf "$REPO_DIR/edge-functions" "$QUARTZ_DIR/edge-functions"

#5.装依赖 + build
echo ""
echo "[5/5] 装依赖 + build ..."
cd "$QUARTZ_DIR"
npm install --no-audit --no-fund
npx quartz build

echo ""
echo "============================================"
echo "Build 完成！产物在 vendor/quartz/public/"
echo "============================================"
