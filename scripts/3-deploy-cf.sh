#!/bin/bash
# ============================================
# pyq.huanyan.org ·部署到 Cloudflare Pages（Mac/Linux）
# ============================================

set -e

cd "$(dirname "$0")/.."

echo ""
echo "============================================"
echo "部署到 Cloudflare Pages（国际站）"
echo "============================================"
echo ""

# 检查 wrangler
if ! command -v wrangler &>/dev/null; then
 echo "[警告] wrangler 未安装，正在安装..."
 npm install -g wrangler
fi

# 构建
echo "[1/3] 构建 Quartz ..."
cd vendor/quartz
npx quartz build
cd ../..

#部署
echo ""
echo "[2/3] 部署到 Cloudflare Pages ..."
wrangler pages deploy vendor/quartz/public --project-name=pyq-huanyan-org

echo ""
echo "[3/3] 配置 secrets（首次部署需要）..."
echo ""
echo "如果这是首次部署，请运行："
echo " wrangler pages secret put ANTHROPIC_API_KEY --project-name=pyq-huanyan-org"
echo " wrangler pages secret put OPENAI_API_KEY --project-name=pyq-huanyan-org"
echo " wrangler pages secret put MINIMAX_API_KEY --project-name=pyq-huanyan-org"
echo ""

echo "============================================"
echo "部署完成！"
echo "访问：https://pyq-huanyan-org.pages.dev"
echo "（或自定义域名 https://pyq.huanyan.org）"
echo "============================================"
