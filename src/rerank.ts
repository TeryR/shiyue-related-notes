/**
 * 重排序（Rerank）客户端（纯逻辑，可单测/mock）
 * 支持两类端点：
 *  - Ollama（新版）：POST {base}/api/rerank  body: {model, query, documents}
 *  - OpenAI 兼容（Cohere/Jina/硅基流动风格）：POST {base}/rerank
 *      body: {model, query, documents, top_n}   header: Authorization Bearer
 *  两类响应统一为 {results: [{index, relevance_score}]}
 */

export interface RerankConfig {
  provider: "ollama" | "openai-compat";
  baseUrl: string;
  apiKey: string;
  model: string;
  topK: number;
  timeoutSec: number;
}

export interface RerankHit {
  index: number;
  score: number;
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

/** 地址容错：用户若填了完整端点（.../rerank），自动剥除后拼接 */
function stripRerankSuffix(base: string): string {
  let b = base.replace(/\/+$/, "");
  if (b.toLowerCase().endsWith("/rerank")) b = b.slice(0, -"/rerank".length).replace(/\/+$/, "");
  return b;
}

export async function rerank(
  cfg: RerankConfig,
  query: string,
  documents: string[]
): Promise<RerankHit[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (cfg.timeoutSec || 60) * 1000);
  try {
    let url: string;
    let body: Record<string, unknown>;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.provider === "ollama") {
      url = joinUrl(stripRerankSuffix(cfg.baseUrl), "api/rerank");
      body = { model: cfg.model, query, documents };
    } else {
      url = joinUrl(stripRerankSuffix(cfg.baseUrl), "rerank");
      if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
      body = { model: cfg.model, query, documents, top_n: Math.min(documents.length, cfg.topK || 50) };
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 404) {
        throw new Error(
          `端点不支持重排序（HTTP 404）：${url}。请确认服务版本支持 rerank，或改用其他端点。`
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`重排序 API Key 无效或未填（HTTP ${res.status}）`);
      }
      throw new Error(`重排序请求失败（HTTP ${res.status}）：${text}`);
    }
    const json = (await res.json()) as { results?: { index: number; relevance_score?: number; score?: number }[] };
    const results = json?.results;
    if (!Array.isArray(results)) throw new Error("重排序响应格式异常（缺少 results）");
    return results
      .map((r) => ({ index: r.index, score: r.relevance_score ?? r.score ?? 0 }))
      .sort((a, b) => b.score - a.score);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort/i.test(msg)) throw new Error(`重排序请求超时（${cfg.timeoutSec || 60} 秒）`);
    throw e instanceof Error ? e : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}
