/**
 * 核心模块单测：分块器 / BM25 / 索引 v2（结构逻辑，无需嵌入模型）
 */

import { chunkText } from "../src/chunker";
import { BM25Index, tokenize } from "../src/bm25";
import { SemanticIndex } from "../src/indexer";
import { hashString, isExcludedPath } from "../src/utils";

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

/* 静态检查 */
check("隐藏目录自动排除（.trash 回收站）", isExcludedPath(".trash/已删除笔记.md", []) === true);
check("隐藏目录自动排除（.obsidian 配置）", isExcludedPath(".obsidian/plugins/x.md", []) === true);
check("隐藏目录不影响正常路径", isExcludedPath("笔记/a.md", []) === false);

/** 确定性伪向量：文本 hash → 固定 64 维向量 */
function pseudoVec(text: string): number[] {
  const dim = 64;
  const v = new Array(dim).fill(0);
  const tokens = tokenize(text);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[(h >>> 0) % dim] += 1;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

/* ==================== 1. 分块器 ==================== */
console.log("【1】分块器");
{
  const short = "这是一篇很短的笔记。";
  check("短文本 → 1 块", chunkText(short, 800, 100).length === 1);
  check("空文本 → 0 块", chunkText("   ", 800, 100).length === 0);

  const long = Array.from({ length: 30 }, (_, i) => `第${i + 1}段：这里讨论健康饮食与蛋白质摄入的关系，以及运动训练对肌肉恢复的影响。`).join("\n\n");
  const chunks = chunkText(long, 300, 50);
  check("长文本切出多块", chunks.length >= 4, `${chunks.length} 块`);
  check("每块不超过目标+重叠", chunks.every((c) => c.text.length <= 300 + 50), `最长 ${Math.max(...chunks.map((c) => c.text.length))}`);
  check("相邻块有重叠", chunks.length > 1 && chunks[1].text.startsWith(chunks[0].text.slice(-50)), "重叠生效");
  check("内容完整覆盖（首块含开头/末块含结尾）", chunks[0].text.includes("第1段") && chunks[chunks.length - 1].text.includes("第30段"));

  const longSentence = "这是一句非常非常长的句子，没有换行，一直持续不断地说下去，谈论很多内容，包括健康饮食、运动训练、心理调节、旅行摄影等等话题，长度超过单块限制，需要按标点切分成多个句子块。".repeat(8);
  const sc = chunkText(longSentence, 200, 50);
  check("超长段落按句边界切分", sc.length >= 3, `${sc.length} 块`);
}

/* ==================== 2. BM25 ==================== */
console.log("\n【2】BM25");
{
  const idx = new BM25Index();
  idx.addChunk("咖啡#0", "手冲咖啡的参数：粉水比1比15，水温90度，闷蒸30秒。咖啡豆烘焙度影响风味。");
  idx.addChunk("健身#0", "深蹲训练要点：膝盖与脚尖方向一致，核心收紧。健身力量训练记录。");
  idx.addChunk("咖啡#1", "意式浓缩萃取：18克粉出36克液，奶泡要绵密。拿铁咖啡制作。");
  check("中文查询命中咖啡块", idx.search("咖啡 手冲", 5).some((h) => h.chunkKey.startsWith("咖啡")), `top=${idx.search("咖啡 手冲", 5).map((h) => h.chunkKey).join(",")}`);
  check("不相关查询不命中", idx.search("量子物理相对论", 5).length === 0);
  idx.removeChunk("咖啡#1");
  check("删除块后不再命中", !idx.search("拿铁 咖啡", 5).some((h) => h.chunkKey === "咖啡#1"));
  check("tokenize 中文 bigram", tokenize("咖啡烘焙").includes("咖啡") && tokenize("咖啡烘焙").includes("烘焙"));
  check("tokenize 英文小写", tokenize("Hello World").includes("hello"));
}

/* ==================== 3. 索引 v2 ==================== */
console.log("\n【3】索引 v2（块级 + 聚合 + 混合检索）");
{
  const idx = new SemanticIndex("test|sig");
  const chunksOf = (text: string) => {
    const cs = chunkText(text, 300, 50);
    return cs.map((c) => ({ idx: c.index, text: c.text, hash: hashString(c.text), embedding: pseudoVec(c.text) }));
  };

  const noteA = Array.from({ length: 8 }, (_, i) => `咖啡段落${i}：手冲参数、粉水比、水温、闷蒸时间、研磨度。`).join("\n\n");
  const noteB = "健身训练：深蹲、硬拉、有氧、心率、拉伸恢复。";
  const noteC = "读书笔记：认知心理学、情绪管理、正念冥想。";

  const chunks = chunksOf(noteA);
  idx.upsertNote("咖啡.md", hashString(noteA), chunks);
  idx.upsertNote("健身.md", hashString(noteB), chunksOf(noteB));
  idx.upsertNote("心理.md", hashString(noteC), chunksOf(noteC));

  check("文档计数 3", idx.docCount === 3, `${idx.docCount}`);
  check("块计数正确（贪心合并）", idx.chunkCount >= 2 && idx.chunkCount <= 4, `${idx.chunkCount} 块`);
  check("BM25 就绪", idx.bm25Ready);
  check("文档聚合向量存在", idx.getEntry("咖啡.md")?.embedding.length === 64);

  // 块级增量：加一个 400 字符的新段落 → 必然新增一块；其余块复用
  const noteA2 =
    Array.from({ length: 8 }, (_, i) => `咖啡段落${i}：手冲参数、粉水比、水温、闷蒸时间、研磨度。`).join("\n\n") +
    "\n\n" +
    "关于拉花的新笔记内容：".repeat(28) +
    "。";
  const chunks2 = chunksOf(noteA2);
  check("新增内容块数增加", chunks2.length > chunks.length, `${chunks.length} → ${chunks2.length}`);
  const beforeChunks = idx.chunkCount;
  idx.upsertNote("咖啡.md", hashString(noteA2), chunks2);
  check("新增块后块数正确", idx.chunkCount === beforeChunks + (chunks2.length - chunks.length), `${beforeChunks} → ${idx.chunkCount}`);
  check("文档聚合向量已更新", idx.getEntry("咖啡.md")?.chunkCount === chunks2.length);

  // 未变化笔记 isUpToDate
  check("未变化笔记跳过", idx.isUpToDate("健身.md", hashString(noteB)));

  // 混合检索（伪向量 + BM25 双路）
  const q = "手冲咖啡粉水比和水温参数";
  const qvec = pseudoVec(q);
  const hybrid = idx.hybridSearch(qvec, q, 3, 0);
  check("混合检索命中咖啡笔记", hybrid.length > 0 && hybrid[0].path === "咖啡.md", hybrid.map((h) => `${h.path}(${h.score.toFixed(2)})`).join(","));
  check("命中块带文本", hybrid[0].chunkHits.length > 0 && hybrid[0].chunkHits[0].text.includes("咖啡"), `块${hybrid[0].chunkHits[0]?.idx}`);
  // BM25 单独也能命中（关键词路）
  const bm25Only = idx.hybridSearch(new Array(64).fill(0.01), "粉水比 闷蒸 研磨度", 3, 0);
  check("关键词路独立命中（BM25）", bm25Only.some((h) => h.path === "咖啡.md"), bm25Only.map((h) => h.path).join(","));

  // 删除
  const psychChunks = chunksOf(noteC).length;
  idx.remove("心理.md");
  const expectedAfterDelete = beforeChunks + (chunks2.length - chunks.length) - psychChunks;
  check("删除后计数", idx.docCount === 2 && idx.chunkCount === expectedAfterDelete, `${idx.docCount} 篇 / ${idx.chunkCount} 块（期望 ${expectedAfterDelete}）`);
  check("删除后 BM25 清理", !idx.hybridSearch(new Array(64).fill(0.01), "正念冥想", 5, 0).some((h) => h.path === "心理.md"));

  // 持久化往返
  const json = idx.toJSON();
  const restored = SemanticIndex.fromJSON("test|sig", json);
  check("恢复后文档/块一致", restored.docCount === idx.docCount && restored.chunkCount === idx.chunkCount);
  check("恢复后 BM25 重建", restored.bm25Ready);
  check("恢复后混合检索一致", JSON.stringify(restored.hybridSearch(qvec, q, 3, 0)) === JSON.stringify(idx.hybridSearch(qvec, q, 3, 0)));

  // 旧版本数据安全重建
  const old = SemanticIndex.fromJSON("test|sig", { meta: { signature: "x", formatVersion: 1, updated: 0 }, docs: {}, chunks: {} } as never);
  check("v1 数据安全重建", old.docCount === 0 && old.chunkCount === 0);
}

console.log(`\n════════════════════════`);
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
console.log(`════════════════════════`);
process.exit(failed === 0 ? 0 : 1);
