@echo off
chcp65001 >nul
REM ============================================
REM pyq.huanyan.org · 本地开发服务器（Windows）
REM ============================================

cd /d "%~dp0\.."

echo.
echo启动本地开发服务器...
echo打开 http://localhost:8080
echo 按 Ctrl+C停止
echo.

cd vendor\quartz
npx quartz build --serve

pause
