#!/bin/bash
# ============================================
# pyq.huanyan.org · 本地开发服务器（Mac/Linux）
# ============================================

cd "$(dirname "$0")/.."

echo ""
echo "启动本地开发服务器..."
echo "打开 http://localhost:8080"
echo "按 Ctrl+C停止"
echo ""

cd vendor/quartz
exec npx quartz build --serve
