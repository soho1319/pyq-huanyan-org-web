import { QuartzComponent, QuartzComponentProps } from "./quartz/components/types"
import { classNames } from "./quartz/util/lang"
import { JSX } from "preact"

/**
 * PromptToolbox组件 ·工具箱风
 *
 * 功能：
 *1.扫描笔记 HTML 中的 <div class="prompt-toolbox">元素
 *2. 自动解析【变量】生成 input form
 *3. "🤖 AI 生成"按钮 →调 /api/generate
 *4. 流式显示生成结果 + 一键复制
 *
 *部署到 vendor/quartz/components/PromptToolbox.tsx
 * 在 quartz.layout.ts 里全局引用
 */

// 全局扫描函数，在客户端执行
const initToolbox = `
(function() {
 if (window.__pyqToolboxLoaded) return;
 window.__pyqToolboxLoaded = true;

 //扫描所有 .prompt-toolbox元素
 const scan = () => {
 const boxes = document.querySelectorAll('.prompt-toolbox:not([data-initialized])');
 boxes.forEach((box) => initBox(box));
 };

 const initBox = (box) => {
 box.dataset.initialized = 'true';

 //提取 Prompt模板
 const templateEl = box.querySelector('.prompt-content code, .prompt-content pre');
 const promptText = templateEl ? templateEl.textContent : box.querySelector('.prompt-content').textContent;
 box.dataset.prompt = promptText.trim();

 //提取变量
 const variables = [];
 const regex = /【([^】]+)】/g;
 let match;
 while ((match = regex.exec(promptText)) !== null) {
 variables.push(match[1]);
 }

 //提取标题
 const titleEl = box.querySelector('.prompt-title');
 const title = titleEl ? titleEl.textContent : 'AI 生成';

 // 构建 UI
 box.innerHTML = '';
 box.classList.add('initialized');

 // Header
 const header = document.createElement('div');
 header.className = 'pt-header';
 header.innerHTML = \`
 <span class="pt-icon">🛠️</span>
 <span class="pt-title">\${escapeHtml(title)}</span>
 <span class="pt-vars">\${variables.length} 个变量</span>
 \`;
 box.appendChild(header);

 // Variables Form
 if (variables.length >0) {
 const form = document.createElement('div');
 form.className = 'pt-form';
 variables.forEach(v => {
 const id = 'pt-var-' + Math.random().toString(36).slice(2);
 const label = document.createElement('label');
 label.htmlFor = id;
 label.className = 'pt-label';
 label.textContent = v;
 const input = document.createElement('textarea');
 input.id = id;
 input.className = 'pt-input';
 input.placeholder = '请输入【' + v + '】的内容...';
 input.rows =2;
 input.dataset.varName = v;
 form.appendChild(label);
 form.appendChild(input);
 });
 box.appendChild(form);
 }

 // Button
 const btn = document.createElement('button');
 btn.className = 'pt-generate-btn';
 btn.innerHTML = '🤖 AI 生成文案';
 btn.onclick = () => generate(box, title, promptText, variables);
 box.appendChild(btn);

 // Output
 const output = document.createElement('div');
 output.className = 'pt-output';
 output.style.display = 'none';
 box.appendChild(output);
 };

 const generate = async (box, title, promptText, variables) => {
 const btn = box.querySelector('.pt-generate-btn');
 const output = box.querySelector('.pt-output');

 //收集变量值
 const filledPrompt = promptText;
 const inputs = box.querySelectorAll('.pt-input');
 inputs.forEach(input => {
 const name = input.dataset.varName;
 const value = input.value || '（未填写）';
 filledPrompt.replace('【' + name + '】', value);
 });

 // 显示 loading
 btn.disabled = true;
 btn.innerHTML = '⏳ 生成中...';
 output.style.display = 'block';
 output.innerHTML = '<div class="pt-loading">AI正在思考...</div>';

 try {
 //调后端 API
 const resp = await fetch('/api/generate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 title,
 prompt: filledPrompt,
 variables: Array.from(inputs).map(i => ({
 name: i.dataset.varName,
 value: i.value
 }))
 })
 });

 if (!resp.ok) {
 const err = await resp.json();
 throw new Error(err.error || 'HTTP ' + resp.status);
 }

 // 流式读取
 const reader = resp.body.getReader();
 const decoder = new TextDecoder();
 let fullText = '';

 output.innerHTML = '';
 const textEl = document.createElement('div');
 textEl.className = 'pt-text';
 output.appendChild(textEl);

 while (true) {
 const { done, value } = await reader.read();
 if (done) break;
 const chunk = decoder.decode(value, { stream: true });
 fullText += chunk;
 textEl.textContent = fullText;
 }

 // 完成，加复制按钮
 const copyBtn = document.createElement('button');
 copyBtn.className = 'pt-copy-btn';
 copyBtn.innerHTML = '📋复制到剪贴板';
 copyBtn.onclick = () => {
 navigator.clipboard.writeText(fullText).then(() => {
 copyBtn.innerHTML = '✅ 已复制';
 setTimeout(() => copyBtn.innerHTML = '📋复制到剪贴板',2000);
 });
 };
 output.appendChild(copyBtn);

 } catch (err) {
 output.innerHTML = '<div class="pt-error">❌ 生成失败：' + escapeHtml(err.message) + '<br><small>检查 API key 配置 /浏览器控制台</small></div>';
 } finally {
 btn.disabled = false;
 btn.innerHTML = '🔄重新生成';
 }
 };

 const escapeHtml = (str) => {
 const div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
 };

 //页面加载完成后扫描
 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', scan);
 } else {
 scan();
 }

 //监听 pjax导航（Quartz 用 SPA路由）
 document.addEventListener('nav', scan);
})();
`;

export default (() => {
 return (props: QuartzComponentProps) => {
 return (
 <>
 {/*注入全局样式 */}
 <style dangerouslySetInnerHTML={{ __html: styles }} />
 {/*注入客户端脚本 */}
 <script dangerouslySetInnerHTML={{ __html: initToolbox }} />
 </>
 )
 }
}) satisfies QuartzComponent

const styles = `
.prompt-toolbox {
 background: linear-gradient(135deg, #fef3c70%, #fde68a100%);
 border:2px solid #f59e0b;
 border-radius:12px;
 padding:1.25rem;
 margin:1.5rem0;
 box-shadow:04px12px rgba(245,158,11,0.15);
 transition: all0.2s;
}
.prompt-toolbox:hover {
 box-shadow:06px16px rgba(245,158,11,0.25);
 transform: translateY(-2px);
}
.prompt-toolbox.initialized {
 background: #fff;
 border-color: #d97706;
}
.pt-header {
 display: flex;
 align-items: center;
 gap:0.75rem;
 margin-bottom:1rem;
 padding-bottom:0.75rem;
 border-bottom:1px dashed #d97706;
}
.pt-icon { font-size:1.5rem; }
.pt-title { font-weight:600; font-size:1.1rem; color: #b45309; }
.pt-vars {
 background: #fbbf24;
 color: #78350f;
 padding:0.15rem0.5rem;
 border-radius:4px;
 font-size:0.85rem;
 margin-left: auto;
}
.pt-form { display: flex; flex-direction: column; gap:0.5rem; margin-bottom:1rem; }
.pt-label {
 font-size:0.9rem;
 color: #78350f;
 font-weight:500;
 margin-top:0.25rem;
}
.pt-input {
 padding:0.5rem;
 border:1px solid #fbbf24;
 border-radius:6px;
 font-size:0.95rem;
 font-family: inherit;
 resize: vertical;
 background: #fffbeb;
}
.pt-input:focus {
 outline: none;
 border-color: #d97706;
 box-shadow:0003px rgba(217,119,6,0.15);
}
.pt-generate-btn {
 background: linear-gradient(135deg, #f59e0b0%, #d97706100%);
 color: #fff;
 border: none;
 padding:0.75rem1.5rem;
 border-radius:8px;
 font-size:1rem;
 font-weight:600;
 cursor: pointer;
 transition: all0.2s;
 width:100%;
}
.pt-generate-btn:hover:not(:disabled) {
 transform: translateY(-1px);
 box-shadow:04px12px rgba(217,119,6,0.4);
}
.pt-generate-btn:disabled {
 opacity:0.7;
 cursor: not-allowed;
}
.pt-output {
 margin-top:1rem;
 padding:1rem;
 background: #f9fafb;
 border-radius:8px;
 border:1px solid #e5e7eb;
}
.pt-loading { color: #6b7280; text-align: center; padding:1rem; }
.pt-text {
 white-space: pre-wrap;
 line-height:1.7;
 color: #1f2937;
 font-size:0.95rem;
}
.pt-copy-btn {
 margin-top:1rem;
 background: #10b981;
 color: #fff;
 border: none;
 padding:0.5rem1rem;
 border-radius:6px;
 cursor: pointer;
 font-size:0.9rem;
}
.pt-copy-btn:hover { background: #059669; }
.pt-error {
 color: #dc2626;
 padding:0.75rem;
 background: #fef2f2;
 border-radius:6px;
 border:1px solid #fecaca;
}

@media (prefers-color-scheme: dark) {
 .prompt-toolbox {
 background: linear-gradient(135deg, #4220060%, #78350f100%);
 border-color: #b45309;
 }
 .prompt-toolbox.initialized { background: #1f1f1f; border-color: #fbbf24; }
 .pt-title { color: #fbbf24; }
 .pt-input { background: #2a2a2a; color: #fafafa; border-color: #92400e; }
 .pt-output { background: #2a2a2a; border-color: #3a3a3a; }
 .pt-text { color: #e5e5e5; }
}
`
