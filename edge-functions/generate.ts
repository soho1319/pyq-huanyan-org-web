/**
 * EdgeOne Edge Functions · 国内站 AI 生成 API
 *路径：/api/generate
 *
 *部署位置：vendor/quartz/edge-functions/generate.ts
 *EdgeOne Pages部署时会自动识别
 *
 * 支持模型（按优先级）：
 *1. minimax M3（默认，国内站主推）
 *2. DeepSeek（备选）
 *3. Kimi（备选）
 *4. OpenAI（备选，但需要翻墙）
 *
 *鉴权：API key存在 EdgeOne Secrets
 */

// ============================================
// EdgeOne Context类型定义
// ============================================
interface EdgeOneContext {
 request: Request;
 env: Record<string, string>;
 params?: Record<string, string>;
}

// ============================================
// CORS头
// ============================================
const corsHeaders = {
 "Access-Control-Allow-Origin": "*",
 "Access-Control-Allow-Methods": "POST, OPTIONS",
 "Access-Control-Allow-Headers": "Content-Type, Authorization",
 "Access-Control-Max-Age": "86400",
};

// ============================================
//内存限流（EdgeOne 没有 KV，用 Map简化）
// 生产环境建议用 Edge KV
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(env: Record<string, string>, clientIP: string) {
 const limit = parseInt(env.FREE_TIER_DAILY_LIMIT || "50");

 const now = Date.now();
 const today = new Date().toISOString().split("T")[0];
 const key = `${today}:${clientIP}`;

 const record = rateLimitMap.get(key);
 if (!record || record.resetAt < now) {
 rateLimitMap.set(key, { count:1, resetAt: now +24 *60 *60 *1000 });
 return { allowed: true, remaining: limit -1 };
 }

 if (record.count >= limit) {
 return { allowed: false, remaining:0 };
 }

 record.count++;
 return { allowed: true, remaining: limit - record.count };
}

// ============================================
//调 OpenAI兼容协议 API（minimax/DeepSeek/Kimi 都用这套）
// ============================================
async function callOpenAICompatible(
 prompt: string,
 apiKey: string,
 baseUrl: string,
 model: string,
 modelName: string
): Promise<ReadableStream> {
 const resp = await fetch(`${baseUrl}/chat/completions`, {
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
 {
 role: "system",
 content: "你是婉音老师课程体系下的内容营销专家，擅长写朋友圈文案、内容营销、用户故事。",
 },
 { role: "user", content: prompt },
 ],
 }),
 });

 if (!resp.ok) {
 const errText = await resp.text();
 throw new Error(`${modelName} API ${resp.status}: ${errText.slice(0,200)}`);
 }

 if (!resp.body) throw new Error(`${modelName} API无响应`);

 // SSE →纯文本
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
// 主入口（EdgeOne风格）
// ============================================
export async function onRequest(context: EdgeOneContext): Promise<Response> {
 const { request, env } = context;

 // CORS预检
 if (request.method === "OPTIONS") {
 return new Response(null, { headers: corsHeaders });
 }

 if (request.method !== "POST") {
 return new Response(JSON.stringify({ error: "Only POST allowed" }), {
 status:405,
 headers: { "Content-Type": "application/json", ...corsHeaders },
 });
 }

 try {
 const body = await request.json();
 const { prompt, title, variables } = body;

 if (!prompt || typeof prompt !== "string") {
 return new Response(
 JSON.stringify({ error: "缺少 prompt 参数" }),
 { status:400, headers: { "Content-Type": "application/json", ...corsHeaders } }
 );
 }

 //限流
 const clientIP =
 request.headers.get("X-Real-IP") ||
 request.headers.get("X-Forwarded-For") ||
 "unknown";
 const rateCheck = await checkRateLimit(env, clientIP);
 if (!rateCheck.allowed) {
 return new Response(
 JSON.stringify({
 error: `今日免费额度已用完（${env.FREE_TIER_DAILY_LIMIT ||50}次/天）。明天再来！`,
 }),
 {
 status:429,
 headers: { "Content-Type": "application/json", ...corsHeaders },
 }
 );
 }

 //选择模型（按优先级）
 let stream: ReadableStream;
 let modelUsed = "unknown";

 if (env.MINIMAX_API_KEY && env.MINIMAX_BASE_URL) {
 stream = await callOpenAICompatible(
 prompt,
 env.MINIMAX_API_KEY,
 env.MINIMAX_BASE_URL,
 env.MINIMAX_MODEL || "M3",
 "minimax M3"
 );
 modelUsed = "minimax-m3";
 } else if (env.DEEPSEEK_API_KEY) {
 stream = await callOpenAICompatible(
 prompt,
 env.DEEPSEEK_API_KEY,
 env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
 env.DEEPSEEK_MODEL || "deepseek-chat",
 "DeepSeek"
 );
 modelUsed = "deepseek";
 } else if (env.KIMI_API_KEY) {
 stream = await callOpenAICompatible(
 prompt,
 env.KIMI_API_KEY,
 env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
 env.KIMI_MODEL || "moonshot-v1-8k",
 "Kimi"
 );
 modelUsed = "kimi";
 } else if (env.OPENAI_API_KEY) {
 stream = await callOpenAICompatible(
 prompt,
 env.OPENAI_API_KEY,
 "https://api.openai.com/v1",
 env.OPENAI_MODEL || "gpt-4o-mini",
 "OpenAI"
 );
 modelUsed = "openai";
 } else {
 return new Response(
 JSON.stringify({ error: "服务端未配置 API key" }),
 {
 status:500,
 headers: { "Content-Type": "application/json", ...corsHeaders },
 }
 );
 }

 return new Response(stream, {
 headers: {
 "Content-Type": "text/event-stream",
 "Cache-Control": "no-cache",
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
