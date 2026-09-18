/**
 * 快速验证：混合检索命中率（停用词过滤后）——只跑 89 篇准确率集
 */
import * as fs from "fs";
import * as path from "path";
import { SemanticIndex } from "../src/indexer";
import { OllamaEmbeddingProvider } from "../src/embedder";
import { DEFAULT_SETTINGS, embeddingSignature, SCZSettings } from "../src/settings";
import { preprocessText, hashString } from "../src/utils";
import { chunkText } from "../src/chunker";

const VAULT = path.join(__dirname, "vault");
const ZH_ROOT = path.join(VAULT, "中文话题库");
const NOTE_MAX = 16000;
const CHUNK_MAX = 800;

function walkMd(dir: string, prefix = ""): { file: string; rel: string }[] {
  const out: { file: string; rel: string }[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...walkMd(full, rel));
    else if (ent.isFile() && ent.name.endsWith(".md")) out.push({ file: full, rel });
  }
  return out;
}

async function main(): Promise<void> {
  const zh: { path: string; topic: string; text: string; hash: string; chunks: { idx: number; text: string; hash: string }[] }[] = [];
  const all: typeof zh = [];
  for (const topicDir of fs.readdirSync(ZH_ROOT, { withFileTypes: true })) {
    if (!topicDir.isDirectory()) continue;
    for (const f of walkMd(path.join(ZH_ROOT, topicDir.name))) {
      const rel = `中文话题库/${topicDir.name}/${f.rel}`;
      const raw = fs.readFileSync(path.join(VAULT, rel), "utf8");
      const text = preprocessText(raw, NOTE_MAX);
      const chunks = chunkText(raw, CHUNK_MAX, 100)
        .map((c) => {
          const t = preprocessText(c.text, CHUNK_MAX + 200);
          return t ? { idx: c.index, text: t, hash: hashString(t) } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const n = { path: rel, topic: topicDir.name, text, hash: hashString(text), chunks };
      all.push(n);
      if (topicDir.name !== "干扰笔记") zh.push(n);
    }
  }
  const enRoot = path.join(VAULT, "英文库");
  for (const f of walkMd(enRoot)) {
    const rel = `英文库/${f.rel}`;
    const raw = fs.readFileSync(path.join(VAULT, rel), "utf8");
    const text = preprocessText(raw, NOTE_MAX);
    const chunks = chunkText(raw, CHUNK_MAX, 100)
      .map((c) => {
        const t = preprocessText(c.text, CHUNK_MAX + 200);
        return t ? { idx: c.index, text: t, hash: hashString(t) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    all.push({ path: rel, topic: "英文", text, hash: hashString(text), chunks });
  }

  const settings: SCZSettings = { ...DEFAULT_SETTINGS, embeddingProvider: "ollama", ollamaModel: "bge-m3", batchSize: 16 };
  const provider = new OllamaEmbeddingProvider("http://127.0.0.1:11434", "bge-m3", 16, 120, 3);
  const index = SemanticIndex.fromJSON(embeddingSignature(settings), null);
  for (const n of all) {
    const vecs = await provider.embed(n.chunks.map((c) => c.text));
    index.upsertNote(n.path, n.hash, n.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: vecs[j] })));
  }
  console.log(`索引完成：${index.docCount} 篇 / ${index.chunkCount} 块`);

  let hySum = 0;
  let hyTitleSum = 0;
  let hyFullSum = 0;
  let docSum = 0;
  for (const n of zh) {
    // 模式 A：开头 200 字
    const qA = n.text.slice(0, 200);
    const qvecA = (await provider.embed([preprocessText(qA, 500)]))[0];
    const sameA = index.hybridSearch(qvecA, qA, 5, 0).filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    hySum += sameA / 5;
    // 模式 B：整篇文本
    const qB = n.text;
    const qvecB = (await provider.embed([preprocessText(qB, 500)]))[0];
    const sameB = index.hybridSearch(qvecB, qB, 5, 0).filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    hyFullSum += sameB / 5;
    // 模式 C：标题（用户凭标题搜索的常见行为）
    const qC = n.path.split("/").pop()!.replace(/\.md$/i, "");
    const qvecC = (await provider.embed([preprocessText(qC, 500)]))[0];
    const sameC = index.hybridSearch(qvecC, qC, 5, 0).filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    hyTitleSum += sameC / 5;
    // 文档级
    const doc = index.similarTo(n.path, 5, 0.4);
    const sameD = doc.filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    docSum += sameD / 5;
  }
  console.log(`模式A 开头200字 混合检索：${((hySum / zh.length) * 100).toFixed(1)}%`);
  console.log(`模式B 整篇文本 混合检索：${((hyFullSum / zh.length) * 100).toFixed(1)}%`);
  console.log(`模式C 标题    混合检索：${((hyTitleSum / zh.length) * 100).toFixed(1)}%`);
  console.log(`文档级 top-5 命中率：${((docSum / zh.length) * 100).toFixed(1)}%`);
  process.exit(hyTitleSum / zh.length >= 0.7 && hyFullSum / zh.length >= 0.7 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
