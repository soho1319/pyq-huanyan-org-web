---
title:README · pyq.huanyan.org Web部署项目
tags: [web/部署/MOC]
created:2026-06-09
---

# 🌐 pyq.huanyan.org Web部署项目

> 把 [[../内容营销朋友圈助手/00 - 内容营销朋友圈小助手（MOC入口）|内容营销朋友圈助手]] +20 节课程原文变成**可访问 + 可一键调用 AI 生成**的网站。
> 双平台部署：CF Pages（国际站）+ EdgeOne Pages（国内镜像）。

## 🎯项目目标

|维度 |目标 |
|---|---|
| **域名** | `pyq.huanyan.org`（"朋友圈"拼音首字母） |
| **国际站** | Cloudflare Pages → 国际访问快 +免备案 |
| **国内站** | EdgeOne Pages → 国内访问快 +免翻墙 |
| **内容** |压缩版（12 篇助手笔记）+完整版（20 节课程原文） |
| **AI 模型** | 国际站：Claude / GPT；国内站：minimax M3（也可换 DeepSeek / Kimi） |
| **API key方案** |混合：免费试用（你提供） +付费（用户自带） |
| **UI风格** |工具箱（每个 Prompt 一张大卡片 + "🤖 AI 生成"按钮） |

## 📂项目结构

```
pyq-huanyan-org-web/
├──README.md ← 你在这里（总览）
├──部署指南.md ← 从0到部署的详细步骤
├──quartz.config.ts ← Quartz v4 配置（覆盖）
├──package.json ← Node依赖
├──tsconfig.json ← TypeScript 配置
├──.env.example ← 环境变量模板
├──.gitignore ← Git忽略
├──wrangler.toml ← Cloudflare Pages 配置
├──edgeone.json ← EdgeOne Pages 配置
│
├──components/ ← 自定义组件（覆盖到 Quartz）
│ ├──PromptCard.tsx ← "AI 生成"卡片组件
│ └──PromptCard.css ←工具箱风样式
│
├──functions/api/ ← CF Pages Functions（国际站后端）
│ └──generate.ts ← /api/generate端点
│
├──edge-functions/ ← EdgeOne Edge Functions（国内站后端）
│ └──generate.ts ← /api/generate端点
│
├──scripts/ ← 一键脚本
│ ├──1-setup.bat ← Windows：克隆 Quartz + 安装依赖
│ ├──2-dev.bat ← Windows：本地启动开发服务器
│ ├──3-deploy-cf.bat ← Windows：部署到 CF Pages
│ ├──4-deploy-edgeone.bat ← Windows：部署到 EdgeOne Pages
│ └──*.sh ← Mac/Linux 对应版本
│
└──.github/workflows/
 └──deploy.yml ← GitHub Actions（推送自动部署）
```

## 🚀快速开始（5 分钟看完）

1. **看完** [[部署指南]]
2. **跑** `scripts/1-setup.bat`（Windows）或 `scripts/1-setup.sh`（Mac/Linux）→ 自动 clone Quartz + 安装依赖
3. **配** `.env`（复制 `.env.example`）→填 API key
4. **跑** `scripts/2-dev.bat` → 本地 `http://localhost:8080` 看效果
5. **部署**：`scripts/3-deploy-cf.bat`（国际站）+ `scripts/4-deploy-edgeone.bat`（国内站）

## 🧰核心功能

###1.笔记内容展示
-保留 Obsidian风格的 wikilink（点击跳转）
-保留 frontmatter（tags / source）
- 中文完美支持
-暗色 /亮色主题切换

###2. AI 生成（核心卖点）
- 每个 Prompt旁边有 **"🤖 AI 生成"**按钮
- 点击 →弹窗表单（自动识别 `【变量】` 生成 input）
- 用户填变量 →调后端 API → 流式显示生成结果
- 一键复制到剪贴板

###3. 双平台智能路由（可选）
- 国内访问自动走 EdgeOne（速度快）
-国外访问自动走 CF Pages（免备案）
- DNS 用 Cloudflare智能解析 / DNSPod智能解析

## 💰成本估算

| 项 |成本 |
|---|---|
| Cloudflare Pages | **免费**（无限流量） |
| EdgeOne Pages | **免费**（额度内） |
| Claude API（国际站） | 按 token付费，~$0.25/百万 input |
| minimax M3 API（国内站） | 待定（M3 价格） |
|域名 `pyq.huanyan.org` |0 元（用 huanyan.org 子域） |
| **月成本** | 主要看 API 调用量 |

> 免费额度预估：1000 次/月免费试用 =几乎零成本起步

## 🔑安全边界

- ✅ API key永远放在**后端环境变量**，不暴露给前端
- ✅ 加 **rate limit**（每 IP每天50 次）
- ✅ CF WAF + EdgeOne 安全策略
- ✅域名走 HTTPS（CF / EdgeOne 自动配）
- ⚠️试用额度耗尽后，提示用户输入自己的 key（BYOK）

## 📝下一步

- 看 [[部署指南]] 开始干
-任何步骤卡住 →贴报错给我看，我帮你 debug
