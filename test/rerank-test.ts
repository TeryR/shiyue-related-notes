/**
 * 重排序模块单测：mock HTTP server 验证两种端点协议 + 错误处理 + 管线翻转
 */
import * as http from "http";
import { rerank, RerankConfig } from "../src/rerank";
import { SemanticIndex } from "../src/indexer";
import { hashString } from "../src/utils";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}${detail ? `（${detail}）` : ""}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? `（${detail}）` : ""}`);
  }
}

/** 伪向量：文本 hash → 64 维 */
function pseudoVec(text: string): number[] {
  const dim = 64;
  const v = new Array(dim).fill(0);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
    v[(h >>> 0) % dim] += 1;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

async function withServer(
  handler: (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void,
  fn: (port: number) => Promise<void>
): Promise<void> {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => handler(req, body, res));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  try {
    await fn(port);
  } finally {
    server.close();
  }
}

async function main(): Promise<void> {
  console.log("【1】OpenAI 兼容 /rerank 端点");
  await withServer(
    (req, body, res) => {
      // 验证请求格式
      check("请求路径为 /rerank", req.url?.includes("/rerank") ?? false);
      check("Bearer 认证头存在", (req.headers.authorization ?? "").startsWith("Bearer sk-test"));
      const parsed = JSON.parse(body);
      check("请求体含 model/query/documents/top_n", !!parsed.model && !!parsed.query && Array.isArray(parsed.documents) && typeof parsed.top_n === "number");
      // 返回翻转的结果（index 1 比 0 分高）
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ results: [{ index: 1, relevance_score: 0.95 }, { index: 0, relevance_score: 0.3 }] }));
    },
    async (port) => {
      const cfg: RerankConfig = { provider: "openai-compat", baseUrl: `http://127.0.0.1:${port}`, apiKey: "sk-test", model: "test-rerank", topK: 5, timeoutSec: 10 };
      const hits = await rerank(cfg, "咖啡", ["手冲咖啡的参数", "深蹲训练要点"]);
      check("响应解析正确", hits.length === 2 && hits[0].index === 1 && hits[0].score === 0.95);
    }
  );

  console.log("\n【2】Ollama /api/rerank 端点");
  await withServer(
    (req, body, res) => {
      check("请求路径为 /api/rerank", req.url?.includes("/api/rerank") ?? false);
      check("无 Bearer 头（Ollama 本地无需认证）", !req.headers.authorization);
      const parsed = JSON.parse(body);
      check("请求体含 model/query/documents（无 top_n）", !!parsed.model && !!parsed.query && Array.isArray(parsed.documents) && parsed.top_n === undefined);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ results: [{ index: 0, relevance_score: 0.8 }] }));
    },
    async (port) => {
      const cfg: RerankConfig = { provider: "ollama", baseUrl: `http://127.0.0.1:${port}`, apiKey: "", model: "bge-reranker-v2-m3", topK: 5, timeoutSec: 10 };
      const hits = await rerank(cfg, "咖啡", ["a", "b"]);
      check("Ollama 响应解析正确", hits.length === 1 && hits[0].score === 0.8);
    }
  );

  console.log("\n【3】错误处理");
  await withServer(
    (req, body, res) => {
      res.statusCode = 404;
      res.end("not found");
    },
    async (port) => {
      try {
        await rerank({ provider: "ollama", baseUrl: `http://127.0.0.1:${port}`, apiKey: "", model: "x", topK: 5, timeoutSec: 10 }, "q", ["a"]);
        check("404 返回明确错误", false);
      } catch (e) {
        check("404 返回明确错误", (e as Error).message.includes("端点不支持"));
      }
    }
  );

  console.log("\n【4】检索管线：rerank 精排翻转混合排序");
  {
    const index = SemanticIndex.fromJSON("test", null);
    const docs = [
      { path: "咖啡.md", text: "手冲咖啡的参数：粉水比、水温、闷蒸。", hash: hashString("a") },
      { path: "健身.md", text: "深蹲训练：核心收紧、膝盖方向。", hash: hashString("b") },
      { path: "历史.md", text: "唐太宗贞观之治：纳谏、轻徭薄赋。", hash: hashString("c") },
    ];
    for (const d of docs) {
      index.upsertNote(d.path, d.hash, [{ idx: 0, text: d.text, hash: d.hash, embedding: pseudoVec(d.text) }]);
    }
    // 查询：咖啡主题
    const q = "手冲咖啡 粉水比 水温";
    const qvec = pseudoVec(q);
    const candidates = index.hybridSearch(qvec, q, 5, 0);
    check("粗排命中咖啡", candidates[0]?.path === "咖啡.md", candidates.map((c) => c.path).join(","));

    // mock rerank：给出与粗排相反的排序（模拟精排纠正）——验证管线按 rerank 分数重排
    await withServer(
      (req, body, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ results: [{ index: 2, relevance_score: 0.9 }, { index: 1, relevance_score: 0.5 }, { index: 0, relevance_score: 0.1 }] }));
      },
      async (port) => {
        const cfg: RerankConfig = { provider: "openai-compat", baseUrl: `http://127.0.0.1:${port}`, apiKey: "k", model: "m", topK: 5, timeoutSec: 10 };
        const rr = await rerank(cfg, q, candidates.map((c) => c.chunkHits[0]?.text ?? ""));
        const reranked: typeof candidates = [];
        const seen = new Set<number>();
        for (const h of rr) {
          if (seen.has(h.index)) continue;
          seen.add(h.index);
          const cand = candidates[h.index];
          if (cand) reranked.push({ ...cand, score: h.score });
        }
        check("rerank 分数已替换 RRF 分数", reranked.every((r) => r.score <= 1));
        check("重排顺序与 mock 一致（首条为精排最高分的文档）", reranked[0]?.path === candidates[2]?.path, `首条=${reranked[0]?.path}，期望=${candidates[2]?.path}`);
      }
    );
  }

  console.log(`\n════════════════════════`);
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  console.log(`════════════════════════`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("测试异常：", e);
  process.exit(1);
});
