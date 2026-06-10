import { QuartzComponent, QuartzComponentProps } from "./quartz/components/types"
import { JSX } from "preact"

/**
 * UserBar · 全局悬浮「🔓 退出」按钮
 *
 * - 部署位置：vendor/quartz/components/UserBar.tsx
 * - 在 quartz.layout.ts 的 sharedPageComponents.header 里挂载
 * - 点击 → /logout → 清 cookie → 302 → /login
 * - 不依赖 JS，纯链接
 */

export default (() => {
  return (_props: QuartzComponentProps) => {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
        <div class="user-bar">
          <a href="/logout" class="user-bar-btn" title="退出登录" aria-label="退出登录">
            <span class="user-bar-icon" aria-hidden="true">🔓</span>
            <span class="user-bar-text">退出</span>
          </a>
        </div>
      </>
    )
  }
}) satisfies QuartzComponent

const styles = `
.user-bar {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  pointer-events: none;
}
.user-bar-btn {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 20px;
  color: #4a5568;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s;
}
.user-bar-btn:hover {
  background: #fff;
  color: #c53030;
  border-color: #fc8181;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.user-bar-icon { font-size: 14px; line-height: 1; }
.user-bar-text { display: inline; }
@media (max-width: 640px) {
  .user-bar-text { display: none; }
  .user-bar-btn { padding: 6px 10px; }
}
@media (prefers-color-scheme: dark) {
  .user-bar-btn {
    background: rgba(45, 55, 72, 0.85);
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.1);
  }
  .user-bar-btn:hover {
    background: #2d3748;
    color: #fc8181;
    border-color: #fc8181;
  }
}
`
