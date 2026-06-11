#!/bin/bash
# ============================================
# pyq.huanyan.org · CF Pages build脚本
#
# 功能：
# 1. 临时 clone Quartz v4 到 vendor/quartz/
# 2. 复制 content + 配置 + functions 到 Quartz
# 3. strip Quartz 的 engines 字段（兼容 Node 20，本地开发友好）
# 4. 跑 npx quartz build
# 5. 把 functions 复制到 public/functions（Pages Functions 必须跟静态资源一起打包）
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
PUBLIC_DIR="$QUARTZ_DIR/public"

# 1. Clone Quartz（--depth1，中间必须有空格）
echo "[1/6] Clone Quartz v4 ..."
if [ -d "$QUARTZ_DIR" ]; then
  echo "vendor/quartz 已存在，先删除"
  rm -rf "$QUARTZ_DIR"
fi
git clone --depth 1 --branch v4 https://github.com/jackyzha0/quartz.git "$QUARTZ_DIR"

# 2. 复制配置
echo ""
echo "[2/6] 复制自定义配置 ..."
cp -rf "$REPO_DIR/quartz.config.ts" "$QUARTZ_DIR/quartz.config.ts"
if [ -f "$REPO_DIR/quartz.layout.ts" ]; then
  cp -rf "$REPO_DIR/quartz.layout.ts" "$QUARTZ_DIR/quartz.layout.ts"
fi

# 3. 复制 content（vault 内容）
echo ""
echo "[3/6] 复制 content ..."
rm -rf "$QUARTZ_DIR/content"
cp -rf "$REPO_DIR/content" "$QUARTZ_DIR/content"

# 4. 复制自定义组件 + functions
echo ""
echo "[4/6] 复制 components + functions ..."
mkdir -p "$QUARTZ_DIR/components"
cp -rf "$REPO_DIR/components/." "$QUARTZ_DIR/components/"
cp -rf "$REPO_DIR/functions" "$QUARTZ_DIR/functions"
cp -rf "$REPO_DIR/edge-functions" "$QUARTZ_DIR/edge-functions"

# 4.5. strip Quartz package.json 的 engines 字段（v4.5.2+ 要 Node ≥22）
#      本地 Node 20 跑不动，strip 后 --ignore-engines 兜底
echo ""
echo "[4.5/6] strip Quartz engines ..."
cd "$QUARTZ_DIR"
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
if (p.engines) {
  delete p.engines;
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
  console.log('  → engines removed (Quartz 兼容 Node 20)');
} else {
  console.log('  → no engines field, skip');
}
"

# 5. 装依赖 + build
echo ""
echo "[5/6] 装依赖 + build ..."
cd "$QUARTZ_DIR"
npm install --no-audit --no-fund --ignore-engines
npx quartz build

# 6. 把 functions 复制到 public/functions（CF Pages 要求）
#    不复制的话 wrangler pages deploy 后 /api/* /today 等全 404
echo ""
echo "[6/6] 复制 functions 到 public/functions ..."
mkdir -p "$PUBLIC_DIR/functions"
cp -rf "$REPO_DIR/functions/." "$PUBLIC_DIR/functions/"

# 同步：也复制 vendor/quartz/functions（如果有 build 过程中石英自动生成的版本，但优先级以 repo 为主）
if [ -d "$QUARTZ_DIR/functions" ] && [ "$QUARTZ_DIR/functions" != "$REPO_DIR/functions" ]; then
  # 跳过（避免覆盖）— repo/functions 是单一来源
  :
fi

echo ""
echo "============================================"
echo "Build 完成！产物在 $PUBLIC_DIR/"
echo "  静态资源: $(find "$PUBLIC_DIR" -type f -not -path "*/functions/*" | wc -l) 个"
echo "  Functions: $(find "$PUBLIC_DIR/functions" -type f 2>/dev/null | wc -l) 个"
echo "============================================"
