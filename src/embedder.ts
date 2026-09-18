/**
 * 嵌入与对话提供方（纯逻辑，不依赖 Obsidian，便于测试）
 * 支持：OpenAI 兼容接口 / Ollama 本地模型
 */

import type { SCZSettings } from "./settings";
import { sleep } from "./utils";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 把 API 错误翻译成中文提示 */
export function describeApiError(status: number, bodyText: string): string {
  const body = (bodyText || "").slice(0, 300);
  if (status === 401 || status === 403) {
    return `API Key 无效或已过期（HTTP ${status}），请在设置中检查密钥`;
  }
  if (status === 404) {
    return `模型不存在或接口地址有误（HTTP 404）：${body}`;
  }
  if (status === 429) {
    return `请求过于频繁（HTTP 429），已自动重试，请稍后再试`;
  }
  if (status >= 500) {
    return `服务端错误（HTTP ${status}）：${body}`;
  }
  return `请求失败（HTTP ${status}）：${body}`;
}

/** 嵌入错误分类：决定重试策略 */
export type EmbedErrorKind = "retryable" | "optimizable" | "fatal" | "other";

export function classifyEmbedError(msg: string): EmbedErrorKind {
  if (/context length|input length|too long|exceeds|maximum length/i.test(msg)) {
    return "optimizable"; // 超长：自动降级截断后重试（在 indexFile 内处理）
  }
  if (/401|403|API Key 无效|密钥无效/.test(msg)) {
    return "fatal"; // 认证失败：重试无意义，直接提示修复
  }
  if (/404|找不到模型|模型不存在|ollama pull/.test(msg)) {
    return "fatal"; // 模型/地址配置错误：直接提示修复
  }
  if (/429|服务端错误|HTTP 5\d\d|网络请求失败|超时|fetch failed|ECONN|socket|timeout|temporary/i.test(msg)) {
    return "retryable"; // 瞬时错误：退避重试
  }
  return "other";
}

/** 带超时与重试的 fetch（仅用于非流式请求） */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutSec: number,
  attempts = 3
): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutSec * 1000);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
        await sleep(1000 * Math.pow(2, i));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (i < attempts - 1) {
        await sleep(1000 * Math.pow(2, i));
        continue;
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (msg.includes("abort")) {
    throw new Error(`请求超时（${timeoutSec} 秒）`);
  }
  throw new Error(`网络请求失败：${msg}`);
}

/** 拼接 baseUrl 与路径，避免重复斜杠 */
export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

/** 用户常把完整端点填进地址框（如 .../v1/chat/completions）；拼接前自动剥除已知端点后缀，两种填法都能工作 */
function stripKnownSuffix(base: string, suffixes: string[]): string {
  let b = base.replace(/\/+$/, "");
  for (const suf of suffixes) {
    if (b.toLowerCase().endsWith(suf.toLowerCase())) {
      b = b.slice(0, -suf.length).replace(/\/+$/, "");
    }
  }
  return b;
}

/* ==================== 嵌入 ==================== */

export interface EmbeddingProvider {
  /** 显示名，用于索引元信息 */
  readonly displayName: string;
  /** 批量计算嵌入 */
  embed(texts: string[]): Promise<number[][]>;
  /** 测试连接：返回是否成功、提示、向量维度 */
  test(): Promise<{ ok: boolean; message: string; dims?: number }>;
}

/** OpenAI 兼容嵌入接口 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly displayName = "OpenAI 兼容接口";

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
    private batchSize: number,
    private timeoutSec: number,
    private attempts = 3
  ) {}

  async embedOne(text: string): Promise<number[]> {
    const res = await this.rawEmbed([text]);
    return res[0];
  }

  private async rawEmbed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("尚未配置 API Key，请在设置中填写");
    }
    const url = joinUrl(stripKnownSuffix(this.baseUrl, ["/embeddings"]), "embeddings");
    const res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: texts }),
      },
      this.timeoutSec,
      this.attempts
    );
    if (!res.ok) {
      throw new Error(describeApiError(res.status, await res.text()));
    }
    const json = await res.json();
    const data: { embedding: number[]; index: number }[] = json?.data ?? [];
    data.sort((a, b) => a.index - b.index);
    if (data.length !== texts.length) {
      throw new Error("接口返回的向量数量与请求不一致，请检查模型名称是否正确");
    }
    return data.map((d) => d.embedding);
  }

  /** 分批请求，按 settings.batchSize 分块 */
  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    const chunk = Math.max(1, this.batchSize || 32);
    for (let i = 0; i < texts.length; i += chunk) {
      const part = texts.slice(i, i + chunk);
      const vecs = await this.rawEmbed(part);
      out.push(...vecs);
    }
    return out;
  }

  async test(): Promise<{ ok: boolean; message: string; dims?: number }> {
    try {
      const vec = await this.embedOne("测试：你好，世界");
      return {
        ok: true,
        message: `连接成功，模型「${this.model}」，向量维度 ${vec.length}`,
        dims: vec.length,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: `连接失败：${msg}` };
    }
  }
}

/** Ollama 本地嵌入接口 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly displayName = "Ollama 本地模型";

  constructor(
    private baseUrl: string,
    private model: string,
    private batchSize: number,
    private timeoutSec: number,
    private attempts = 3
  ) {}

  private async rawEmbed(texts: string[]): Promise<number[][]> {
    const url = joinUrl(this.baseUrl, "api/embed");    const res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: texts }),
      },
      this.timeoutSec,
      this.attempts
    );
    if (res.status === 404 || res.status === 400) {
      // 旧版接口 /api/embeddings（单条）
      const out: number[][] = [];
      for (const t of texts) {
        const r2 = await fetchWithRetry(
          joinUrl(this.baseUrl, "api/embeddings"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: this.model, prompt: t }),
          },
          this.timeoutSec,
          this.attempts
        );
        if (!r2.ok) {
          throw new Error(
            `Ollama 接口调用失败：${describeApiError(r2.status, await r2.text())}`
          );
        }
        const j2 = await r2.json();
        out.push(j2.embedding as number[]);
      }
      return out;
    }
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404 && body.includes("model")) {
        throw new Error(`Ollama 中找不到模型「${this.model}」，请先运行：ollama pull ${this.model}`);
      }
      throw new Error(describeApiError(res.status, body));
    }
    const json = await res.json();
    const emb = json?.embeddings as number[][] | undefined;
    if (!emb || emb.length !== texts.length) {
      throw new Error("Ollama 返回的向量数量与请求不一致");
    }
    return emb;
  }

  async embedOne(text: string): Promise<number[]> {
    const res = await this.rawEmbed([text]);
    return res[0];
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    const chunk = Math.max(1, this.batchSize || 32);
    for (let i = 0; i < texts.length; i += chunk) {
      const part = texts.slice(i, i + chunk);
      const vecs = await this.rawEmbed(part);
      out.push(...vecs);
    }
    return out;
  }

  async test(): Promise<{ ok: boolean; message: string; dims?: number }> {
    try {
      const vec = await this.embedOne("测试：你好，世界");
      return {
        ok: true,
        message: `连接成功，模型「${this.model}」，向量维度 ${vec.length}`,
        dims: vec.length,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: `连接失败：${msg}` };
    }
  }
}

/** 根据设置创建嵌入提供方 */
export function createEmbeddingProvider(s: SCZSettings): EmbeddingProvider {
  if (s.embeddingProvider === "ollama") {
    return new OllamaEmbeddingProvider(
      s.ollamaBaseUrl,
      s.ollamaModel,
      s.batchSize,
      s.requestTimeoutSec,
      s.retryAttempts
    );
  }
  return new OpenAIEmbeddingProvider(
    s.openaiBaseUrl,
    s.openaiApiKey,
    s.embeddingModel,
    s.batchSize,
    s.requestTimeoutSec,
    s.retryAttempts
  );
}

/* ==================== 对话（Smart Chat / 改写 / 生成笔记） ==================== */

export interface ChatStreamResult {
  /** 流式输出回调，返回是否继续 */
  onDelta(delta: string): void;
  signal: AbortSignal;
}

/** Anthropic 兼容对话（Messages API，流式） */
async function anthropicChatStream(
  s: SCZSettings,
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  signal: AbortSignal,
  modelOverride?: string
): Promise<string> {
  const timeoutMs = s.requestTimeoutSec * 1000;
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const msgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal.addEventListener("abort", onAbort);
  try {
    const res = await fetch(joinUrl(s.anthropicBaseUrl, "v1/messages"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": s.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelOverride || s.anthropicModel,
        max_tokens: 4096,
        system: system || undefined,
        messages: msgs,
        stream: true,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error("Anthropic API Key 无效或已过期，请在设置中检查");
      }
      if (res.status === 404) {
        throw new Error(`模型不存在或接口地址有误（HTTP 404）：${body.slice(0, 200)}`);
      }
      throw new Error(describeApiError(res.status, body));
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("无法读取流式响应");
    const decoder = new TextDecoder();
    let full = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        try {
          const j = JSON.parse(data);
          if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) {
            full += j.delta.text;
            onDelta(j.delta.text);
          }
        } catch {
          /* 忽略无法解析的行 */
        }
      }
    }
    return full;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/**
 * 流式对话。按 chatProvider 分发：Ollama 本地 / OpenAI 兼容 / Anthropic 兼容。
 */
export async function chatStream(
  s: SCZSettings,
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  signal: AbortSignal,
  modelOverride?: string
): Promise<string> {
  if (s.chatProvider === "anthropic") {
    return anthropicChatStream(s, messages, onDelta, signal, modelOverride);
  }
  if (s.chatProvider === "ollama") {
    const res = await fetch(joinUrl(s.ollamaBaseUrl, "api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelOverride || s.ollamaChatModel,
        messages,
        stream: true,
      }),
      signal,
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404 && body.includes("model")) {
        throw new Error(
          `Ollama 中找不到对话模型「${modelOverride || s.ollamaChatModel}」，请先运行：ollama pull ${modelOverride || s.ollamaChatModel}`
        );
      }
      throw new Error(describeApiError(res.status, body));
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("无法读取流式响应");
    const decoder = new TextDecoder();
    let full = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const j = JSON.parse(line);
          const delta: string = j?.message?.content ?? "";
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          /* 忽略无法解析的行 */
        }
      }
    }
    return full;
  }

  // OpenAI 兼容 SSE（对话专用连接：chatOpenai* 留空时沿用嵌入的地址/Key）
  // 地址容错：用户若填了完整端点（.../chat/completions），自动剥除后拼接
  const chatBase = stripKnownSuffix(s.chatOpenaiBaseUrl || s.openaiBaseUrl, ["/chat/completions"]);
  const chatKey = s.chatOpenaiApiKey || s.openaiApiKey;
  const timeoutMs = s.requestTimeoutSec * 1000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal.addEventListener("abort", onAbort);
  try {
    const res = await fetch(joinUrl(chatBase, "chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chatKey}`,
      },
      body: JSON.stringify({
        model: modelOverride || s.chatModel,
        messages,
        stream: true,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(describeApiError(res.status, await res.text()));
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("无法读取流式响应");
    const decoder = new TextDecoder();
    let full = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const delta: string = j?.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          /* 忽略 */
        }
      }
    }
    return full;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
