#!/bin/bash
# ============================================
# pyq.huanyan.org ·部署到 EdgeOne Pages（Mac/Linux）
# ============================================

set -e

cd "$(dirname "$0")/.."

echo ""
echo "============================================"
echo "部署到 EdgeOne Pages（国内站）"
echo "============================================"
echo ""

# 检查 edgeone CLI
if ! command -v edgeone &>/dev/null; then
 echo "[警告] edgeone CLI 未安装，正在安装..."
 npm install -g edgeone
fi

# 构建
echo "[1/3] 构建 Quartz ..."
cd vendor/quartz
npx quartz build
cd ../..

#部署
echo ""
echo "[2/3] 部署到 EdgeOne Pages ..."
edgeone deploy

echo ""
echo "[3/3] 配置 secrets..."
echo ""
echo "在腾讯云控制台 → EdgeOne → Secrets management添加："
echo " -MINIMAX_API_KEY"
echo " - DEEPSEEK_API_KEY（备选）"
echo " - KIMI_API_KEY（备选）"
echo ""

echo "============================================"
echo "部署完成！"
echo "访问：https://pyq-cn.huanyan.org"
echo "============================================"
