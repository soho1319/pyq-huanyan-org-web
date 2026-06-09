#!/bin/bash
# ============================================
# pyq.huanyan.org · 一键安装脚本（Mac/Linux）
# ============================================

set -e

echo ""
echo "============================================"
echo " pyq.huanyan.org · 一键安装"
echo "============================================"
echo ""

# 进入项目根目录
cd "$(dirname "$0")/.."

#1.克隆 Quartz
echo "[1/5] 克隆 Quartz v4 ..."
if [ -d "vendor/quartz" ]; then
 echo "已经存在 vendor/quartz，跳过克隆"
else
 git clone --depth1 https://github.com/jackyzha0/quartz.git vendor/quartz
fi

#2. 安装依赖
echo ""
echo "[2/5] 安装 Quartz依赖 ..."
cd vendor/quartz
npm install
cd ../..

#3.复制配置
echo ""
echo "[3/5] 复制 Quartz配置文件 ..."
cp -f quartz.config.ts vendor/quartz/quartz.config.ts
if [ ! -f vendor/quartz/quartz.layout.ts ]; then
 cp -f quartz.layout.ts vendor/quartz/quartz.layout.ts2>/dev/null || true
fi

#4.复制自定义组件
echo ""
echo "[4/5] 复制自定义组件 ..."
cp -f components/PromptToolbox.tsx vendor/quartz/components/2>/dev/null || true

#5. 创建 .env
echo ""
echo "[5/5] 创建 .env 文件 ..."
if [ -f .env ]; then
 echo ".env 已存在，跳过"
else
 cp .env.example .env
 echo "已创建 .env，请填写 API key 后继续"
fi

echo ""
echo "============================================"
echo "安装完成！"
echo "============================================"
echo ""
echo "接下来："
echo "1. 编辑 .env，填入 API key"
echo "2.跑 scripts/2-dev.sh启动开发服务器"
echo "3.浏览器打开 http://localhost:8080"
