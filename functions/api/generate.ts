/**
 * CF Pages Functions · 国际站 AI 生成 API
 *路径：/api/generate
 *
 *部署位置：vendor/quartz/functions/api/generate.ts
 *（CF Pages Functions 必须放在项目根目录的 functions/ 下）
 *
 * 支持模型：
 * - Claude (默认，国际站主推)
 * - OpenAI (备选)
 *
 *鉴权：API key存在环境变量，不暴露给前端
 */

// ============================================
// KV存储（限流）· CF Pages KV binding
//在 CF Dashboard → KV → 创建 namespace：rate_limit
// 在 Pages → Settings → Functions → KV bindings →绑定
// ============================================

interface Env {
 ANTHROPIC_API_KEY?: string;
 OPENAI_API_KEY?: string;
 ANTHROPIC_MODEL?: string;
 OPENAI_MODEL?: string;
 MINIMAX_API_KEY?: string;
 MINIMAX_BASE_URL?: string;
 MINIMAX_MODEL?: string;
 FREE_TIER_DAILY_LIMIT?: string;
 RATE_LIMIT?: KVNamespace; // CF KV，存每日调用次数
 SITE_URL?: string;
}

// ============================================
// CORS头（允许前端跨域调用）
// ============================================
const corsHeaders = {
 "Access-Control-Allow-Origin": "*", //生产环境改成 SITE_URL
 "Access-Control-Allow-Methods": "POST, OPTIONS",
 "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================
//限流检查
// ============================================
async function checkRateLimit(env: Env, clientIP: string): Promise<{ allowed: boolean; remaining: number }> {
 const limit = parseInt(env.FREE_TIER_DAILY_LIMIT || "50");
 if (!env.RATE_LIMIT) {
 //没 KV绑定 → 不限流（开发环境）
 return { allowed: true, remaining: limit };
 }

 const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
 const key = `rate:${today}:${clientIP}`;
 const current = parseInt((await env.RATE_LIMIT.get(key)) || "0");

 if (current >= limit) {
 return { allowed: false, remaining:0 };
 }

 await env.RATE_LIMIT.put(key, String(current +1), {
 expirationTtl:60 *60 *24 *2, //2 天后过期（跨过当天即可）
 });

 return { allowed: true, remaining: limit - current -1 };
}

// ============================================
//调 Claude API（流式）
// ============================================
async function callClaude(
 prompt: string,
 apiKey: string,
 model: string
): Promise<ReadableStream> {
 const resp = await fetch("https://api.anthropic.com/v1/messages", {
 method: "POST",
 headers: {
 "x-api-key": apiKey,
 "anthropic-version": "2023-06-01",
 "content-type": "application/json",
 },
 body: JSON.stringify({
 model,
 max_tokens:2048,
 stream: true,
 messages: [{ role: "user", content: prompt }],
 }),
 });

 if (!resp.ok) {
 const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
 throw new Error(`Claude API ${resp.status}: ${err.error?.message || resp.statusText}`);
 }

 if (!resp.body) throw new Error("Claude API无响应");

 //把 Anthropic SSE流转换成纯文本流
 const reader = resp.body.getReader();
 const decoder = new TextDecoder();

 return new ReadableStream({
 async start(controller) {
 let buffer = "";
 try {
 while (true) {
 const { done, value } = await reader.read();
 if (done) break;
 buffer += decoder.decode(value, { stream: true });
 const lines = buffer.split("\n");
 buffer = lines.pop() || "";
 for (const line of lines) {
 if (line.startsWith("data: ")) {
 const data = line.slice(6).trim();
 if (data === "[DONE]") break;
 try {
 const json = JSON.parse(data);
 if (json.type === "content_block_delta" && json.delta?.text) {
 controller.enqueue(new TextEncoder().encode(json.delta.text));
 }
 } catch {}
 }
 }
 }
 } catch (err) {
 controller.error(err);
 } finally {
 controller.close();
 }
 },
 });
 }

// ============================================
//调 OpenAI API（流式）
// ============================================
async function callOpenAI(
 prompt: string,
 apiKey: string,
 model: string
): Promise<ReadableStream> {
 const resp = await fetch("https://api.openai.com/v1/chat/completions", {
 method: "POST",
 headers: {
 Authorization: `Bearer ${apiKey}`,
 "Content-Type": "application/json",
 },
 body: JSON.stringify({
 model,
 max_tokens:2048,
 stream: true,
 messages: [{ role: "user", content: prompt }],
 }),
 });

 if (!resp.ok) {
 const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
 throw new Error(`OpenAI API ${resp.status}: ${err.error?.message || resp.statusText}`);
 }

 if (!resp.body) throw new Error("OpenAI API无响应");

 // OpenAI SSE →纯文本
 const reader = resp.body.getReader();
 const decoder = new TextDecoder();

 return new ReadableStream({
 async start(controller) {
 let buffer = "";
 try {
 while (true) {
 const { done, value } = await reader.read();
 if (done) break;
 buffer += decoder.decode(value, { stream: true });
 const lines = buffer.split("\n");
 buffer = lines.pop() || "";
 for (const line of lines) {
 if (line.startsWith("data: ")) {
 const data = line.slice(6).trim();
 if (data === "[DONE]") break;
 try {
 const json = JSON.parse(data);
 const text = json.choices?.[0]?.delta?.content;
 if (text) controller.enqueue(new TextEncoder().encode(text));
 } catch {}
 }
 }
 }
 } catch (err) {
 controller.error(err);
 } finally {
 controller.close();
 }
 },
 });
 }


// ============================================
// 调 OpenAI 兼容协议 API（MiniMax 等）
// ============================================
async function callOpenAICompatible(
 prompt: string,
 apiKey: string,
 baseUrl: string,
 model: string,
 modelName: string
): Promise<ReadableStream> {
 const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
 method: "POST",
 headers: {
 Authorization: `Bearer ${apiKey}`,
 "Content-Type": "application/json",
 },
 body: JSON.stringify({
 model,
 max_tokens:2048,
 stream: true,
 messages: [
 { role: "system", content: "你是婉音老师课程体系下的内容营销专家，擅长写朋友圈文案、内容营销、用户故事。" },
 { role: "user", content: prompt },
 ],
 }),
 });

 if (!resp.ok) {
 const errText = await resp.text();
 throw new Error(`${modelName} API ${resp.status}: ${errText.slice(0,200)}`);
 }

 if (!resp.body) throw new Error(`${modelName} API无响应`);

 const reader = resp.body.getReader();
 const decoder = new TextDecoder();

 return new ReadableStream({
 async start(controller) {
 let buffer = "";
 try {
 while (true) {
 const { done, value } = await reader.read();
 if (done) break;
 buffer += decoder.decode(value, { stream: true });
 const lines = buffer.split("\n");
 buffer = lines.pop() || "";
 for (const line of lines) {
 if (line.startsWith("data: ")) {
 const data = line.slice(6).trim();
 if (data === "[DONE]") break;
 try {
 const json = JSON.parse(data);
 const text = json.choices?.[0]?.delta?.content;
 if (text) controller.enqueue(new TextEncoder().encode(text));
 } catch {}
 }
 }
 }
 } catch (err) {
 controller.error(err);
 } finally {
 controller.close();
 }
 },
 });
}

// ============================================
// 主入口
// ============================================
export async function onRequestPost(context: {
 request: Request;
 env: Env;
}): Promise<Response> {
 const { request, env } = context;

 //1. CORS预检
 if (request.method === "OPTIONS") {
 return new Response(null, { headers: corsHeaders });
 }

 try {
 //2.解析请求体
 const body = await request.json();
 const { prompt, title, variables } = body;

 if (!prompt || typeof prompt !== "string") {
 return new Response(
 JSON.stringify({ error: "缺少 prompt 参数" }),
 { status:400, headers: { "Content-Type": "application/json", ...corsHeaders } }
 );
 }

 //3.限流检查（按 IP）
 const clientIP =
 request.headers.get("CF-Connecting-IP") ||
 request.headers.get("X-Forwarded-For") ||
 "unknown";
 const rateCheck = await checkRateLimit(env, clientIP);
 if (!rateCheck.allowed) {
 return new Response(
 JSON.stringify({
 error: `今日免费额度已用完（${env.FREE_TIER_DAILY_LIMIT}次/天）。明天再来，或输入你自己的 API key（BYOK）。`,
 }),
 {
 status:429,
 headers: {
 "Content-Type": "application/json",
 "X-RateLimit-Remaining": "0",
 ...corsHeaders,
 },
 }
 );
 }

 //4. 选择模型
 let stream: ReadableStream;
 let modelUsed = "claude";

 if (env.MINIMAX_API_KEY) {
 modelUsed = "minimax";
 stream = await callOpenAICompatible(
 prompt,
 env.MINIMAX_API_KEY,
 env.MINIMAX_BASE_URL || "https://api.minimax.chat/v1",
 env.MINIMAX_MODEL || "MiniMax-M3",
 "MiniMax"
 );
 } else if (env.ANTHROPIC_API_KEY) {
 stream = await callClaude(
 prompt,
 env.ANTHROPIC_API_KEY,
 env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001"
 );
 } else if (env.OPENAI_API_KEY) {
 modelUsed = "openai";
 stream = await callOpenAI(
 prompt,
 env.OPENAI_API_KEY,
 env.OPENAI_MODEL || "gpt-4o-mini"
 );
 } else {
 return new Response(
 JSON.stringify({ error: "服务端未配置 API key。请联系管理员。" }),
 {
 status:500,
 headers: { "Content-Type": "application/json", ...corsHeaders },
 }
 );
 }

 //5. 流式返回
 return new Response(stream, {
 headers: {
 "Content-Type": "text/event-stream",
 "Cache-Control": "no-cache",
 "Connection": "keep-alive",
 "X-Model-Used": modelUsed,
 "X-RateLimit-Remaining": String(rateCheck.remaining),
 ...corsHeaders,
 },
 });
 } catch (err: any) {
 console.error("[/api/generate]", err);
 return new Response(
 JSON.stringify({ error: err.message || "Internal Server Error" }),
 {
 status:500,
 headers: { "Content-Type": "application/json", ...corsHeaders },
 }
 );
 }
}

// GET方法：返回使用说明
export async function onRequestGet(): Promise<Response> {
 return new Response(
 JSON.stringify({
 name: "pyq.huanyan.org AI Generate API",
 version: "1.0.0",
 usage: "POST /api/generate with { prompt, title, variables }",
 }),
 {
 headers: {
 "Content-Type": "application/json",
 ...corsHeaders,
 },
 }
 );
}
