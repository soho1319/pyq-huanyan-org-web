@echo off
chcp65001 >nul
REM ============================================
REM pyq.huanyan.org ·部署到 EdgeOne Pages（Windows）
REM ============================================

cd /d "%~dp0\.."

echo.
echo ============================================
echo部署到 EdgeOne Pages（国内站）
echo ============================================
echo.

REM 检查 edgeone CLI
where edgeone >nul2>nul
if errorlevel1 (
 echo [警告] edgeone CLI 未安装，正在安装...
 call npm install -g edgeone
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
echo [2/3] 部署到 EdgeOne Pages ...
call edgeone deploy
if errorlevel1 (
 echo部署失败！检查 edgeone login状态
 pause
 exit /b1
)

echo.
echo [3/3] 配置 secrets...
echo.
echo 在腾讯云控制台 → EdgeOne → Secrets management添加：
echo -MINIMAX_API_KEY
echo - DEEPSEEK_API_KEY（备选）
echo - KIMI_API_KEY（备选）
echo.

echo ============================================
echo部署完成！
echo访问：https://pyq-cn.huanyan.org
echo ============================================
echo.

pause
