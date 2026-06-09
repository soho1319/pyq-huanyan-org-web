import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz v4 configuration for pyq.huanyan.org
 * 内容营销朋友圈小助手 · 双站部署
 *
 *复制到 vendor/quartz/quartz.config.ts（覆盖默认）
 */

const config: QuartzConfig = {
 configuration: {
 name: "pyq.huanyan.org",
 pageTitle: "内容营销朋友圈小助手",
 pageTitleSuffix: "",
 description: "20节内容营销课程精华 + AI 一键生成朋友圈文案",
 locale: "zh-CN",
 generateSocialImages: false,
 enableSiteMap: true,
 enableRSS: true,
 generateRobotsTxt: true,
 defaultDateType: "created",
 theme: {
 typography: {
 header: "Source Serif Pro, Georgia, serif",
 body: "Inter, -apple-system, system-ui, sans-serif",
 code: "JetBrains Mono, Menlo, monospace",
 },
 colors: {
 lightMode: {
 light: "#faf8f5",
 lightgray: "#e5e5e5",
 gray: "#b4b4b4",
 darkgray: "#4a4a4a",
 dark: "#2b2b2b",
 tertiary: "#e0e0e0",
 secondary: "#d97706", //工具箱风：橙色强调
 highlight: "rgba(217,119,6,0.15)",
 },
 darkMode: {
 light: "#1a1a1a",
 lightgray: "#2a2a2a",
 gray: "#7a7a7a",
 darkgray: "#b4b4b4",
 dark: "#fafafa",
 tertiary: "#3a3a3a",
 secondary: "#fbbf24",
 highlight: "rgba(251,191,36,0.15)",
 },
 },
 },
 baseUrl: "pyq.huanyan.org",
 },

 plugins: {
 transformers: [
 Plugin.FrontMatter({ delims: ["---", "---"], language: "yaml" }),
 Plugin.CreatedModifiedDate({
 priority: ["frontmatter", "filesystem"],
 }),
 Plugin.SyntaxHighlighting({
 theme: { light: "github-light", dark: "github-dark" },
 keepBackground: false,
 }),
 Plugin.ObsidianFlavoredMarkdown({
 enableInHtmlEmbed: false,
 enableYouTubeEmbed: true,
 enableVideoEmbed: true,
 enableMermaid: true,
 }),
 Plugin.GitHubFlavoredMarkdown(),
 Plugin.TableOfContents(),
 Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
 ],
 filters: [Plugin.RemoveDrafts()],
 emitters: [
 Plugin.AliasRedirects(),
 Plugin.ComponentResources(),
 Plugin.ContentPage(),
 Plugin.FolderPage(),
 Plugin.TagPage(),
 Plugin.ContentIndex({
 enableSiteMap: true,
 enableRSS: true,
 }),
 Plugin.Assets(),
 Plugin.Static(),
 Plugin.NotFoundPage(),
 ],
 },
}

export default config
