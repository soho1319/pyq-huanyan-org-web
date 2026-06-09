@echo off
chcp65001 >nul
REM ============================================
REM pyq.huanyan.org · 把 vault 内容复制到 content/目录
REM功能：
REM1.复制 一人公司/内容营销朋友圈助手/ → pyq-huanyan-org-web/content/
REM2. （可选）复制20 节课程原文 → content/课程原文/
REM3. git add + commit + push
REM ============================================

cd /d "%~dp0\.."

echo.
echo ============================================
echo同步 vault 内容到 content/
echo ============================================
echo.

set SOURCE1=D:\Backup\Documents\我的Obsidian文档\一人公司\内容营销朋友圈助手
set SOURCE2=D:\Backup\Documents\我的Obsidian文档\内容营销朋友圈\doc
set TARGET=content

REM 创建 content目录
if not exist %TARGET% mkdir %TARGET%

REM复制助手笔记（核心）
echo [1/3] 复制助手笔记 ...
if exist "%SOURCE1%" (
 robocopy "%SOURCE1%" "%TARGET%" /E /XD .obsidian .trash /NFL /NDL /NJH /NJS >nul
 echo 已复制：助手笔记
) else (
 echo [警告] 找不到 %SOURCE1%
)

REM复制课程原文（可选）
echo.
echo [2/3] 复制20节课程原文 ...
if exist "%SOURCE2%" (
 robocopy "%SOURCE2%" "%TARGET%\课程原文" /E /NFL /NDL /NJH /NJS >nul
 echo 已复制：课程原文
) else (
 echo [警告] 找不到 %SOURCE2% （跳过）
)

REM Git commit + push
echo.
echo [3/3] Git commit + push ...
git add content
git status
echo.
git commit -m "feat: sync vault content to GitHub"
echo.
git push

echo.
echo ============================================
echo同步完成！
echo ============================================
echo.
echo content/目录里的内容已经推送到 GitHub
echo CF Pages 下次部署时会自动 build
echo.
pause
