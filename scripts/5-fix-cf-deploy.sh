#!/bin/bash
# ============================================
# pyq.huanyan.org ·修复 CF Pages wrangler.toml错误
# ============================================

set -e

cd "$(dirname "$0")/.."

echo ""
echo "============================================"
echo "修复 wrangler.toml +重新推送"
echo "============================================"
echo ""

#备份
if [ -f wrangler.toml ]; then
 cp -f wrangler.toml wrangler.toml.bak
 echo "已备份 wrangler.toml.bak"
fi

#写入精简版
cat > wrangler.toml <<'EOF'
# Cloudflare Pages · pyq-huanyan-org（国际站）
# CF Pages 不支持 wrangler.toml里的 [build] section
# Build 配置必须在 CF Dashboard UI 上设置

name = "pyq-huanyan-org"
compatibility_date = "2024-06-20"
pages_build_output_dir = "./vendor/quartz/public"

#部署流程：
#1. CF Dashboard → Pages → Connect to Git → soho1319/pyq-huanyan-org-web
#2. Build command: cd vendor/quartz && npm install && npx quartz build
#3. Build output directory: vendor/quartz/public
#4. Environment variables (Plaintext): SITE_URL, SITE_NAME, FREE_TIER_DAILY_LIMIT
#5. Environment variables (Secret): ANTHROPIC_API_KEY, OPENAI_API_KEY
#6. Save and Deploy
EOF

echo ""
echo "新的 wrangler.toml:"
echo ""
cat wrangler.toml
echo ""

# Stage + commit + push
git add wrangler.toml
git commit -m "fix: simplify wrangler.toml (CF Pages doesn't support [build])"
echo ""
echo "推送到 GitHub..."
git push

echo ""
echo "============================================"
echo "完成！"
echo "============================================"
echo ""
echo "接下来去 CF Dashboard:"
echo "1.打开 https://dash.cloudflare.com/ → Pages → pyq-huanyan-org"
echo "2.Settings → Build:"
echo " Build command: cd vendor/quartz && npm install && npx quartz build"
echo " Build output: vendor/quartz/public"
echo "3.Environment variables (Plaintext):"
echo " - SITE_URL = https://pyq.huanyan.org"
echo " - SITE_NAME = 内容营销朋友圈小助手"
echo " - FREE_TIER_DAILY_LIMIT =50"
echo " - ANTHROPIC_API_KEY = sk-ant-xxx (Secret)"
echo "4.Retry deployment"
