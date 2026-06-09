@echo off
chcp65001 >nul
REM ============================================
REM pyq.huanyan.org · 一键安装脚本（Windows）
REM功能：
REM1.克隆 Quartz v4 到 vendor/quartz
REM2.安装依赖
REM3.复制配置文件
REM4. 创建 .env（如果不存在）
REM ============================================

echo.
echo ============================================
echo pyq.huanyan.org · 一键安装
echo ============================================
echo.

REM 进入项目根目录
cd /d "%~dp0\.."

echo[1/5] 克隆 Quartz v4 ...
if exist vendor\quartz (
 echo 已经存在 vendor\quartz，跳过克隆
) else (
 git clone --depth1 https://github.com/jackyzha0/quartz.git vendor\quartz
 if errorlevel1 (
 echo克隆失败！检查网络 /Git
 pause
 exit /b1
 )
)

echo.
echo[2/5] 安装 Quartz依赖 ...
cd vendor\quartz
call npm install
if errorlevel1 (
 echo依赖安装失败！
 pause
 exit /b1
)
cd ..\..

echo.
echo[3/5] 复制 Quartz配置文件 ...
copy /Y ..\quartz.config.ts vendor\quartz\quartz.config.ts >nul
if not exist vendor\quartz\quartz.layout.ts (
 copy /Y ..\quartz.layout.ts vendor\quartz\quartz.layout.ts >nul
)

echo.
echo[4/5] 复制自定义组件 ...
if not exist vendor\quartz\components\PromptToolbox.tsx (
 copy /Y ..\components\PromptToolbox.tsx vendor\quartz\components\ >nul
)

echo.
echo[5/5] 创建 .env 文件 ...
if exist .env (
 echo .env 已存在，跳过
) else (
 copy /Y .env.example .env >nul
 echo 已创建 .env，请填写 API key 后继续
)

echo.
echo ============================================
echo 安装完成！
echo ============================================
echo.
echo接下来：
echo1. 编辑 .env，填入 API key
echo2.跑 scripts\2-dev.bat启动开发服务器
echo3.浏览器打开 http://localhost:8080
echo.
pause
