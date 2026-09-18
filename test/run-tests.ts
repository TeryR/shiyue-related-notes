/**
 * 自动化测试 v3：真实 bge-m3 嵌入（本机 Ollama）+ 索引 v2 全链路
 *
 * 结构：
 *   A. 准确率索引（89 篇测试笔记集：72 中文 + 4 干扰 + 13 英文）
 *      —— 文档级 top-5 命中率（验收线 ≥70%）、混合检索命中率（新）、英文、增量、持久化
 *   B. 全量索引（1209 篇）—— 压测性能、混合检索性能
 *
 * 运行：node test/run-tests.cjs
 */

import * as fs from "fs";
import * as path from "path";
import { SemanticIndex } from "../src/indexer";
import { OllamaEmbeddingProvider } from "../src/embedder";
import { DEFAULT_SETTINGS, embeddingSignature, SCZSettings } from "../src/settings";
import {
  preprocessText,
  hashString,
  cosineSimilarity,
  isExcludedPath,
} from "../src/utils";
import { chunkText } from "../src/chunker";

const VAULT = path.join(__dirname, "vault");
const ZH_ROOT = path.join(VAULT, "中文话题库");

interface NoteInfo {
  path: string;
  topic: string | null;
  text: string;
  hash: string;
  /** 分块后的块（文本+哈希） */
  chunks: { idx: number; text: string; hash: string }[];
}

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

function info(name: string, detail: string): void {
  console.log(`  ℹ️  ${name}（${detail}）`);
}

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

const NOTE_MAX = 16000;
const CHUNK_MAX = 800;

function readNotes(): {
  zh: NoteInfo[];
  outliers: NoteInfo[];
  en: NoteInfo[];
  stress: NoteInfo[];
} {
  const make = (rel: string, topic: string | null): NoteInfo => {
    const abs = path.join(VAULT, rel);
    const raw = fs.readFileSync(abs, "utf8");
    const text = preprocessText(raw, NOTE_MAX);
    const chunks = chunkText(raw, CHUNK_MAX, 100)
      .map((c) => {
        const t = preprocessText(c.text, CHUNK_MAX + 200);
        return t ? { idx: c.index, text: t, hash: hashString(t) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { path: rel, topic, text, hash: hashString(text), chunks };
  };

  const zh: NoteInfo[] = [];
  const outliers: NoteInfo[] = [];
  const en: NoteInfo[] = [];
  const stress: NoteInfo[] = [];

  for (const topicDir of fs.readdirSync(ZH_ROOT, { withFileTypes: true })) {
    if (!topicDir.isDirectory()) continue;
    for (const f of walkMd(path.join(ZH_ROOT, topicDir.name))) {
      const n = make(`中文话题库/${topicDir.name}/${f.rel}`, topicDir.name);
      if (topicDir.name === "干扰笔记") outliers.push(n);
      else zh.push(n);
    }
  }
  const enRoot = path.join(VAULT, "英文库");
  for (const f of walkMd(enRoot)) {
    en.push(make(`英文库/${f.rel}`, "英文"));
  }
  const stressRoot = path.join(VAULT, "压测库");
  for (const f of walkMd(stressRoot)) {
    stress.push(make(`压测库/${f.rel}`, f.rel.split("/")[0]));
  }
  return { zh, outliers, en, stress };
}

async function buildIndex(
  provider: OllamaEmbeddingProvider,
  notes: NoteInfo[],
  label: string
): Promise<{ index: SemanticIndex; ms: number }> {
  const index = SemanticIndex.fromJSON(embeddingSignature({ ...DEFAULT_SETTINGS, embeddingProvider: "ollama", ollamaModel: "bge-m3" } as SCZSettings), null);
  const t0 = Date.now();
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    // 块级批量嵌入（每篇的块一次请求）
    const vecs = await provider.embed(n.chunks.map((c) => c.text));
    index.upsertNote(
      n.path,
      n.hash,
      n.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: vecs[j] }))
    );
    if ((i + 1) % 16 === 0 || i === notes.length - 1) {
      process.stdout.write(`\r  ${label} 索引进度 ${i + 1}/${notes.length}`);
    }
  }
  process.stdout.write("\n");
  return { index, ms: Date.now() - t0 };
}

async function main(): Promise<void> {
  console.log("═══ 智能关联（Smart Connections 中文版）自动化测试 v3（分块+混合检索）═══\n");

  /* ---------- 0. 静态检查 ---------- */
  console.log("【0】基础工具检查");
  check("isExcludedPath 精确匹配", isExcludedPath("附件", ["附件"]) === true);
  check("isExcludedPath 子路径匹配", isExcludedPath("附件/图片/a.md", ["附件"]) === true);
  check("isExcludedPath 非排除", isExcludedPath("笔记/a.md", ["附件"]) === false);
  check("纯代码块预处理后为空（跳过索引）", preprocessText("```js\nconst x = 1;\n```", 4000) === "");
  const mdText = preprocessText("# 标题\n\n[链接](https://x.com) 正文**加粗**", 4000);
  check("Markdown 预处理去语法", mdText.includes("链接") && mdText.includes("正文") && mdText.includes("加粗") && !mdText.includes("https://x.com"));
  check("哈希稳定性", hashString("你好世界") === hashString("你好世界"));
  check("哈希区分内容", hashString("你好世界") !== hashString("你好世界！"));
  check("余弦：相同向量≈1", Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);

  /* ---------- 1. 收集测试库 ---------- */
  console.log("\n【1】测试库");
  const { zh, outliers, en, stress } = readNotes();
  const accSet = [...zh, ...outliers, ...en];
  const all = [...accSet, ...stress];
  check("中文话题库 ≥ 30 篇", zh.length >= 30, `${zh.length} 篇（12 话题 × 6 篇）`);
  check("包含相似与不相似话题", new Set(zh.map((n) => n.topic)).size >= 8, `${new Set(zh.map((n) => n.topic)).size} 个话题`);
  check("压测库 ≥ 1000 篇", stress.length >= 1000, `${stress.length} 篇`);
  const totalChunks = all.reduce((s, n) => s + n.chunks.length, 0);
  info("全库分块总数", `${totalChunks} 块（每篇平均 ${(totalChunks / all.length).toFixed(1)} 块）`);

  const settings: SCZSettings = {
    ...DEFAULT_SETTINGS,
    embeddingProvider: "ollama",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "bge-m3",
    batchSize: 16,
    requestTimeoutSec: 120,
  };
  const provider = new OllamaEmbeddingProvider(
    settings.ollamaBaseUrl,
    "bge-m3",
    16,
    120,
    3
  );

  /* ---------- 2. 准确率索引 ---------- */
  console.log("\n【2】准确率索引（bge-m3，分块 v2）");
  const acc = await buildIndex(provider, accSet, "准确率集");
  const accIndex = acc.index;
  check("测试集索引完成", accIndex.docCount === accSet.length, `${accSet.length} 篇 / ${accIndex.chunkCount} 块，${(acc.ms / 1000).toFixed(1)} 秒`);
  check("BM25 就绪", accIndex.bm25Ready);

  /* ---------- 3. 中文准确率（文档级） ---------- */
  console.log("\n【3】中文 top-5 命中率（文档级，验收线 ≥70%）");
  let hit5Sum = 0;
  let coverage = 0;
  const perTopic: Record<string, { sum: number; n: number }> = {};
  for (const n of zh) {
    const results = accIndex.similarTo(n.path, 5, 0.4);
    const same = results.filter((r) => {
      const peer = zh.find((z) => z.path === r.path);
      return peer?.topic === n.topic;
    }).length;
    hit5Sum += same / 5;
    if (same >= 1) coverage++;
    perTopic[n.topic] = perTopic[n.topic] || { sum: 0, n: 0 };
    perTopic[n.topic].sum += same / 5;
    perTopic[n.topic].n++;
  }
  const hit5 = hit5Sum / zh.length;
  const cov = coverage / zh.length;
  console.log(`  top-5 平均命中率：${(hit5 * 100).toFixed(1)}%`);
  check("top-5 平均命中率 ≥ 70%", hit5 >= 0.7, `${(hit5 * 100).toFixed(1)}%`);
  check("命中覆盖率 ≥ 90%", cov >= 0.9, `${(cov * 100).toFixed(1)}%`);

  /* ---------- 3b. 混合检索命中率（新验收线） ---------- */
  console.log("\n【3b】混合检索命中率（向量+BM25+RRF，top-5 同话题占比 ≥70%）");
  let hySum = 0;
  for (const n of zh) {
    const q = n.text.slice(0, 200); // 用笔记开头模拟用户查询
    const qvec = (await provider.embed([preprocessText(q, 500)]))[0];
    const results = accIndex.hybridSearch(qvec, q, 5, 0);
    const same = results.filter((r) => {
      const peer = zh.find((z) => z.path === r.path);
      return peer?.topic === n.topic;
    }).length;
    hySum += same / 5;
  }
  const hyHit = hySum / zh.length;
  check("混合检索 top-5 命中率 ≥ 70%", hyHit >= 0.7, `${(hyHit * 100).toFixed(1)}%`);

  /* ---------- 4. 英文不退化 ---------- */
  console.log("\n【4】英文笔记关联质量");
  let enHit = 0;
  for (const n of en) {
    const results = accIndex.similarTo(n.path, 5, 0.4);
    enHit += results.filter((r) => r.path.startsWith("英文库/")).length / 5;
  }
  const enHit5 = enHit / en.length;
  check("英文 top-5 内英文笔记占比 ≥ 70%", enHit5 >= 0.7, `${(enHit5 * 100).toFixed(1)}%`);

  /* ---------- 5. 干扰笔记 ---------- */
  console.log("\n【5】干扰笔记（跨话题，不参与命中率）");
  for (const n of outliers) {
    const results = accIndex.similarTo(n.path, 5, 0.4);
    const top = results.slice(0, 3).map((r) => r.path.split("/")[1] ?? r.path).join("、");
    console.log(`  ${n.path.split("/").pop()}: ${top}`);
  }
  check("干扰笔记正常返回推荐", outliers.every((n) => accIndex.similarTo(n.path, 5, 0.4).length > 0));

  /* ---------- 6. 增量更新（块级） ---------- */
  console.log("\n【6】增量更新（块级：新增/修改/删除）");
  const newPath = "中文话题库/咖啡文化与手冲/增量测试笔记.md";
  const newContent = "# 增量测试笔记\n\n今天试了一款新的耶加雪菲豆子，手冲参数：粉水比1比15，水温90度，闷蒸30秒。冲出来的咖啡风味很干净，有花香和柑橘酸，回甘明显。研磨度比上次调细了一档，萃取时间刚好2分钟。\n";
  fs.writeFileSync(path.join(VAULT, newPath), newContent);
  const newNote = readNotes().zh.find((n) => n.path === newPath);
  check("新笔记读取成功", !!newNote && newNote.chunks.length >= 1);
  const before = accIndex.docCount;
  const nv = (await provider.embed(newNote!.chunks.map((c) => c.text)));
  accIndex.upsertNote(
    newNote!.path,
    newNote!.hash,
    newNote!.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: nv[j] }))
  );
  check("新增笔记后计数 +1", accIndex.docCount === before + 1, `${before} → ${accIndex.docCount}`);
  const coffeePeers = accIndex.similarTo("中文话题库/咖啡文化与手冲/手冲咖啡入门笔记.md", 5, 0.4);
  check("新笔记出现在同话题笔记的 top-5", coffeePeers.some((r) => r.path === newPath));

  // 修改内容（整篇变化 → 全部块变化）
  const modified = "# 增量测试笔记（已修改）\n\n这周开始用间歇性断食配合蛋白质摄入，体重记录：周一68.2，周五67.4。\n";
  fs.writeFileSync(path.join(VAULT, newPath), modified);
  const modNote = readNotes().zh.find((n) => n.path === newPath)!;
  check("内容修改后哈希变化", modNote.hash !== newNote!.hash);
  const mv = await provider.embed(modNote.chunks.map((c) => c.text));
  accIndex.upsertNote(
    modNote.path,
    modNote.hash,
    modNote.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: mv[j] }))
  );
  check("修改后计数不变", accIndex.docCount === before + 1);

  accIndex.remove(newPath);
  check("删除笔记后计数 -1", accIndex.docCount === before, `${before + 1} → ${accIndex.docCount}`);
  check("删除后不再出现在推荐中", !accIndex.similarTo("中文话题库/咖啡文化与手冲/手冲咖啡入门笔记.md", 5, 0.4).some((r) => r.path === newPath));
  fs.unlinkSync(path.join(VAULT, newPath)); // 清理，保证测试库可复现

  /* ---------- 7. 持久化往返 ---------- */
  console.log("\n【7】持久化（序列化 → 恢复）");
  const json = accIndex.toJSON();
  const restored = SemanticIndex.fromJSON(embeddingSignature(settings), json);
  check("恢复后文档/块一致", restored.docCount === accIndex.docCount && restored.chunkCount === accIndex.chunkCount, `${restored.docCount} 篇 / ${restored.chunkCount} 块`);
  check("签名一致", restored.meta.signature === embeddingSignature(settings));
  check("恢复后 BM25 重建", restored.bm25Ready);
  const p1 = "中文话题库/历史人物与王朝/唐太宗与贞观之治.md";
  const a = accIndex.getEntry(p1);
  const b = restored.getEntry(p1);
  check("恢复后聚合向量一致", !!a && !!b && cosineSimilarity(a.embedding, b.embedding) > 0.9999);
  check("恢复后推荐一致", JSON.stringify(accIndex.similarTo(p1, 5, 0.4)) === JSON.stringify(restored.similarTo(p1, 5, 0.4)));
  const qv = (await provider.embed(["贞观之治 唐太宗 治国"]))[0];
  check("恢复后混合检索一致", JSON.stringify(accIndex.hybridSearch(qv, "贞观之治 唐太宗 治国", 5, 0)) === JSON.stringify(restored.hybridSearch(qv, "贞观之治 唐太宗 治国", 5, 0)));
  const corrupted = SemanticIndex.fromJSON(embeddingSignature(settings), { meta: { signature: "x", formatVersion: 1, updated: 0 }, docs: {}, chunks: {} } as never);
  check("v1 数据安全重建", corrupted.docCount === 0);

  /* ---------- 8. 全量索引 + 压测 ---------- */
  console.log("\n【8】全量索引（1209 篇）与压测");
  const full = await buildIndex(provider, all, "全量");
  const fullIndex = full.index;
  check("全量索引完成", fullIndex.docCount === all.length, `${all.length} 篇 / ${fullIndex.chunkCount} 块，${(full.ms / 1000).toFixed(1)} 秒`);

  const stressPaths = fullIndex.paths.filter((p) => p.startsWith("压测库/"));
  check("压测库全部入索引", stressPaths.length === stress.length, `${stressPaths.length} 篇`);
  const samplePaths = stressPaths.slice(0, 200);
  const times: number[] = [];
  for (const p of samplePaths) {
    const tq = performance.now();
    fullIndex.similarTo(p, 5, 0.4);
    times.push(performance.now() - tq);
  }
  times.sort((x, y) => x - y);
  const qAvg = times.reduce((s, t) => s + t, 0) / times.length;
  const qMax = times[times.length - 1];
  check("文档级查询平均耗时 < 100ms", qAvg < 100, `平均 ${qAvg.toFixed(2)}ms / 最大 ${qMax.toFixed(2)}ms`);

  // 混合检索性能（真实查询）
  const hyTimes: number[] = [];
  const hyQ = (await provider.embed(["咖啡 手冲 参数"]) )[0];
  for (let i = 0; i < 30; i++) {
    const tq = performance.now();
    fullIndex.hybridSearch(hyQ, "咖啡 手冲 参数", 5, 0);
    hyTimes.push(performance.now() - tq);
  }
  hyTimes.sort((x, y) => x - y);
  const hyAvg = hyTimes.reduce((s, t) => s + t, 0) / hyTimes.length;
  check("混合检索平均耗时 < 200ms", hyAvg < 200, `平均 ${hyAvg.toFixed(1)}ms / 最大 ${hyTimes[hyTimes.length - 1].toFixed(1)}ms`);

  const fullJson = fullIndex.toJSON();
  const jsonSizeMB = Buffer.byteLength(JSON.stringify(fullJson)) / 1024 / 1024;
  check("索引 JSON 体积可接受", jsonSizeMB < 100, `${jsonSizeMB.toFixed(1)}MB`);

  /* 混合命中率（全库竞争，信息性） */
  let mixedSum = 0;
  for (const n of zh) {
    const q = n.text.slice(0, 150);
    const qv2 = (await provider.embed([preprocessText(q, 500)]))[0];
    const results = fullIndex.hybridSearch(qv2, q, 5, 0);
    const same = results.filter((r) => {
      const peer = zh.find((z) => z.path === r.path);
      return peer?.topic === n.topic;
    }).length;
    mixedSum += same / 5;
  }
  info("全库混合检索命中率（信息性）", `${((mixedSum / zh.length) * 100).toFixed(1)}%，top-5 名额与 1130 篇他主题笔记竞争`);

  /* ---------- 9. 嵌入语义正确性 ---------- */
  console.log("\n【9】嵌入语义正确性（bge-m3）");
  const [va, vb, vc] = await provider.embed(["苹果香蕉水果", "香蕉苹果橙子", "量子物理与相对论"]);
  const sameTopicSim = cosineSimilarity(va, vb);
  const diffTopicSim = cosineSimilarity(va, vc);
  check("同主题文本相似度 > 跨主题", sameTopicSim > diffTopicSim, `同主题 ${sameTopicSim.toFixed(3)} vs 跨主题 ${diffTopicSim.toFixed(3)}`);
  const [vx, vy] = await provider.embed(["今天天气很好适合出去走走", "今天天气很好适合出去走走"]);
  check("相同文本余弦 ≈ 1", cosineSimilarity(vx, vy) > 0.999, cosineSimilarity(vx, vy).toFixed(4));

  /* ---------- 汇总 ---------- */
  console.log(`\n══════════════════════════════════`);
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  console.log(`测试集索引 ${(acc.ms / 1000).toFixed(1)}s；全量 ${(full.ms / 1000).toFixed(1)}s`);
  console.log(`中文 top-5 ${(hit5 * 100).toFixed(1)}%；混合检索 ${(hyHit * 100).toFixed(1)}%；英文 ${(enHit5 * 100).toFixed(1)}%`);
  console.log(`文档查询 ${qAvg.toFixed(2)}ms；混合检索 ${hyAvg.toFixed(1)}ms；索引体积 ${jsonSizeMB.toFixed(1)}MB`);
  console.log(`══════════════════════════════════`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("测试运行异常：", e);
  process.exit(1);
});
