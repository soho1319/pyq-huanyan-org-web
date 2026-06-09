@echo off
chcp65001 >nul
REM ============================================
REM pyq.huanyan.org ·修复 CF Pages wrangler.toml错误
REM功能：移除 wrangler.toml里的 [build] section（CF Pages 不支持）
REM ============================================

cd /d "%~dp0\.."

echo.
echo ============================================
echo修复 wrangler.toml +重新推送
echo ============================================
echo.

REM备份原 wrangler.toml
if exist wrangler.toml (
 copy /Y wrangler.toml wrangler.toml.bak >nul
 echo 已备份 wrangler.toml.bak
)

REM写入精简版 wrangler.toml
(
 echo.# ============================================
 echo.# Cloudflare Pages · pyq-huanyan-org（国际站）
 echo.# CF Pages 不支持 wrangler.toml里的 [build] section
 echo.# Build 配置必须在 CF Dashboard UI 上设置
 echo.# ============================================
 echo.name = "pyq-huanyan-org"
 echo.compatibility_date = "2024-06-20"
 echo.pages_build_output_dir = "./vendor/quartz/public"
 echo.
 echo.# ============================================
 echo.#部署流程
 echo.# ============================================
 echo.#1. CF Dashboard -^> Pages -^> Connect to Git -^> soho1319/pyq-huanyan-org-web
 echo.#2. Build command: cd vendor/quartz ^&^& npm install ^&^& npx quartz build
 echo.#3. Build output directory: vendor/quartz/public
 echo.#4. Environment variables (Plaintext): SITE_URL, SITE_NAME, FREE_TIER_DAILY_LIMIT
 echo.#5. Environment variables (Secret): ANTHROPIC_API_KEY, OPENAI_API_KEY
 echo.#6. Save and Deploy
) > wrangler.toml

echo.
echo新的 wrangler.toml:
echo.
type wrangler.toml
echo.

REM Stage改动
git add wrangler.toml

REM Commit
git commit -m "fix: simplify wrangler.toml (CF Pages doesn't support [build])"

REM Push
echo.
echo推送到 GitHub...
git push

echo.
echo ============================================
echo 完成！
echo ============================================
echo.
echo接下来去 CF Dashboard:
echo1.打开 https://dash.cloudflare.com/ -^> Pages -^> pyq-huanyan-org
echo2.Settings -^> Build:
echo Build command: cd vendor/quartz ^&^& npm install ^&^& npx quartz build
echo Build output: vendor/quartz/public
echo3.Environment variables:
echo - SITE_URL = https://pyq.huanyan.org
echo - SITE_NAME = 内容营销朋友圈小助手
echo - FREE_TIER_DAILY_LIMIT =50
echo - ANTHROPIC_API_KEY = sk-ant-xxx (Secret)
echo4.Retry deployment
echo.
pause
