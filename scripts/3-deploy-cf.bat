@echo off
chcp65001 >nul
REM ============================================
REM pyq.huanyan.org ·部署到 Cloudflare Pages（Windows）
REM ============================================

cd /d "%~dp0\.."

echo.
echo ============================================
echo部署到 Cloudflare Pages（国际站）
echo ============================================
echo.

REM 检查 wrangler
where wrangler >nul2>nul
if errorlevel1 (
 echo [警告] wrangler 未安装，正在安装...
 call npm install -g wrangler
)

REM 构建
echo [1/3] 构建 Quartz ...
cd vendor\quartz
call npx quartz build
if errorlevel1 (
 echo 构建失败！
 pause
 exit /b1
)
cd ..\..

REM部署
echo.
echo [2/3] 部署到 Cloudflare Pages ...
call wrangler pages deploy vendor\quartz\public --project-name=pyq-huanyan-org
if errorlevel1 (
 echo部署失败！检查 wrangler login状态
 pause
 exit /b1
)

echo.
echo [3/3] 配置 secrets（首次部署需要）...
echo.
echo 如果这是首次部署，请运行：
echo wrangler pages secret put ANTHROPIC_API_KEY --project-name=pyq-huanyan-org
echo wrangler pages secret put OPENAI_API_KEY --project-name=pyq-huanyan-org
echo wrangler pages secret put MINIMAX_API_KEY --project-name=pyq-huanyan-org
echo.

echo ============================================
echo部署完成！
echo访问：https://pyq-huanyan-org.pages.dev
echo （或自定义域名 https://pyq.huanyan.org）
echo ============================================
echo.

pause
