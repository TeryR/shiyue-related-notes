/**
 * 语义索引 v2（纯逻辑，不依赖 Obsidian）
 * - 块级索引：每篇笔记切成语义块，每块独立向量（结构感知分块 + 重叠）
 * - 文档级聚合向量：块向量平均（供侧边栏/相似笔记）
 * - 混合检索：块向量 top-K + BM25 关键词 top-K → RRF 融合 → 笔记级排序
 * - 增量：块级哈希比对，只重嵌变化的块
 */

import { cosineSimilarity } from "./utils";
import { BM25Index, isStopTerm } from "./bm25";

export interface DocEntry {
  /** 整篇内容哈希 */
  hash: string;
  updated: number;
  /** 文档聚合向量（块向量平均） */
  embedding: number[];
  chunkCount: number;
}

export interface ChunkEntry {
  notePath: string;
  idx: number;
  hash: string;
  updated: number;
  embedding: number[];
  /** 块文本（BM25 与命中展示用） */
  text: string;
}

export interface IndexDataV2 {
  meta: { signature: string; formatVersion: number; updated: number };
  docs: Record<string, DocEntry>;
  chunks: Record<string, ChunkEntry>;
}

export interface SimResult {
  path: string;
  score: number;
}

export interface ChunkHit {
  idx: number;
  text: string;
  /** 语义相似度（0-1） */
  cosine: number;
  /** BM25 分数 */
  bm25: number;
  /** RRF 融合分 */
  rrf: number;
}

export interface HybridResult {
  path: string;
  /** RRF 融合分（0-1 归一化展示用） */
  score: number;
  chunkHits: ChunkHit[];
}

export const FORMAT_VERSION = 2;

function chunkKey(path: string, idx: number): string {
  return `${path}#${idx}`;
}

export function createIndex(signature: string): IndexDataV2 {
  return {
    meta: { signature, formatVersion: FORMAT_VERSION, updated: Date.now() },
    docs: {},
    chunks: {},
  };
}

export class SemanticIndex {
  private data: IndexDataV2;
  private bm25 = new BM25Index();
  private version = 0;
  private cache = new Map<string, { v: number; results: SimResult[] }>();
  private termCache = new Map<string, string[]>();

  constructor(signature: string, existing?: IndexDataV2 | null) {
    if (existing && existing.meta.formatVersion === FORMAT_VERSION) {
      this.data = existing;
    } else {
      this.data = createIndex(signature);
    }
    // BM25 倒排由块文本重建（内存，约 1-2 秒/万块）
    this.rebuildBM25();
  }

  /* ---------------- 基础 ---------------- */

  get meta() {
    return this.data.meta;
  }

  get docCount(): number {
    return Object.keys(this.data.docs).length;
  }

  get chunkCount(): number {
    return Object.keys(this.data.chunks).length;
  }

  get paths(): string[] {
    return Object.keys(this.data.docs);
  }

  getEntry(path: string): DocEntry | undefined {
    return this.data.docs[path];
  }

  /** 取某笔记某一块（增量比对用） */
  getChunk(path: string, idx: number): ChunkEntry | undefined {
    return this.data.chunks[chunkKey(path, idx)];
  }

  isUpToDate(path: string, contentHash: string): boolean {
    const d = this.data.docs[path];
    return !!d && d.hash === contentHash;
  }

  /** 计算文档聚合向量（块向量平均） */
  private aggregate(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    const dim = embeddings[0].length;
    const sum = new Array(dim).fill(0);
    for (const e of embeddings) {
      for (let i = 0; i < dim; i++) sum[i] += e[i];
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += sum[i] * sum[i];
    norm = Math.sqrt(norm);
    return norm > 0 ? sum.map((x) => x / norm) : sum;
  }

  /* ---------------- 写操作 ---------------- */

  /**
   * 新增/更新一篇笔记（块级增量：hash 相同的块复用，只替换变化的）
   * @param chunks 该笔记的全部块（idx/text/hash/embedding）
   */
  upsertNote(
    path: string,
    docHash: string,
    chunks: { idx: number; text: string; hash: string; embedding: number[] }[]
  ): void {
    const oldKeys = new Set(
      Object.keys(this.data.chunks).filter((k) => k.startsWith(path + "#"))
    );
    const usedKeys = new Set<string>();
    const chunkEmbeddings: number[][] = [];

    for (const c of chunks) {
      const key = chunkKey(path, c.idx);
      const old = this.data.chunks[key];
      if (old && old.hash === c.hash) {
        // 内容未变：复用（BM25 也无需重建，因为 text 相同）
        usedKeys.add(key);
        oldKeys.delete(key);
        chunkEmbeddings.push(old.embedding);
        continue;
      }
      if (old) {
        // 内容变化：移除旧 BM25
        this.bm25.removeChunk(key);
        oldKeys.delete(key);
      }
      this.data.chunks[key] = {
        notePath: path,
        idx: c.idx,
        hash: c.hash,
        updated: Date.now(),
        embedding: c.embedding,
        text: c.text,
      };
      this.bm25.addChunk(key, c.text);
      usedKeys.add(key);
      chunkEmbeddings.push(c.embedding);
    }

    // 删除笔记中被移除的块
    for (const key of oldKeys) {
      this.bm25.removeChunk(key);
      delete this.data.chunks[key];
    }

    this.data.docs[path] = {
      hash: docHash,
      updated: Date.now(),
      embedding: this.aggregate(chunkEmbeddings),
      chunkCount: chunkEmbeddings.length,
    };
    this.data.meta.updated = Date.now();
    this.bump();
  }

  /** 删除一篇笔记 */
  remove(path: string): void {
    for (const key of Object.keys(this.data.chunks)) {
      if (key.startsWith(path + "#")) {
        this.bm25.removeChunk(key);
        delete this.data.chunks[key];
      }
    }
    delete this.data.docs[path];
    this.data.meta.updated = Date.now();
    this.bump();
  }

  private bump(): void {
    this.version++;
    if (this.cache.size > 200) this.cache.clear();
    if (this.termCache.size > 0) this.termCache.clear();
  }

  /* ---------------- 查询 ---------------- */

  /** 文档级相似（侧边栏 / Smart View / 对话引用） */
  similarTo(path: string, k: number, minScore: number): SimResult[] {
    const cacheKey = `${path}|${k}|${Math.round(minScore * 1000)}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.v === this.version) return hit.results;

    const self = this.data.docs[path];
    if (!self) return [];
    const out: SimResult[] = [];
    for (const [p, d] of Object.entries(this.data.docs)) {
      if (p === path) continue;
      const score = cosineSimilarity(self.embedding, d.embedding);
      if (score >= minScore) out.push({ path: p, score });
    }
    out.sort((a, b) => b.score - a.score);
    const results = out.slice(0, k);
    this.cache.set(cacheKey, { v: this.version, results });
    return results;
  }

  /** 查询向量 → 文档级相似（语义搜索 UI 已改用 hybridSearch） */
  async similarToQuery(
    queryVector: number[],
    k: number,
    minScore: number,
    excludePaths: Set<string> = new Set()
  ): Promise<SimResult[]> {
    const out: SimResult[] = [];
    for (const [p, d] of Object.entries(this.data.docs)) {
      if (excludePaths.has(p)) continue;
      const score = cosineSimilarity(queryVector, d.embedding);
      if (score >= minScore) out.push({ path: p, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, k);
  }

  /**
   * 混合检索：向量块级 top-K + BM25 块级 top-K → 加权 RRF 融合 → 笔记级排序
   * 权重：向量路 1.0（主）、BM25 路 0.5（辅），避免关键词长尾噪声挤掉语义正确结果
   */
  hybridSearch(
    queryVector: number[],
    queryText: string,
    k: number,
    minRrf = 0,
    vectorTopK = 50,
    bm25TopK = 30
  ): HybridResult[] {
    const RRF_K = 60;
    const W_VEC = 1.0;
    const W_BM25 = 0.5;

    // 1. 块级向量 top-K
    const vecRanks: { key: string; cosine: number }[] = [];
    for (const [key, c] of Object.entries(this.data.chunks)) {
      const s = cosineSimilarity(queryVector, c.embedding);
      if (s > 0) vecRanks.push({ key, cosine: s });
    }
    vecRanks.sort((a, b) => b.cosine - a.cosine);
    const vecTop = vecRanks.slice(0, vectorTopK);

    // 2. 块级 BM25 top-K
    const bm25Top = this.bm25.search(queryText, bm25TopK);

    // 3. 加权 RRF 融合 → 笔记聚合
    const noteAgg = new Map<string, { rrf: number; hits: Map<number, ChunkHit> }>();
    const addHit = (key: string, rank: number, cosine: number, bm25Score: number, weight: number) => {
      const hashIdx = key.lastIndexOf("#");
      const path = key.slice(0, hashIdx);
      const idx = parseInt(key.slice(hashIdx + 1), 10);
      const chunk = this.data.chunks[key];
      if (!chunk) return;
      const rrf = weight / (RRF_K + rank);
      let agg = noteAgg.get(path);
      if (!agg) {
        agg = { rrf: 0, hits: new Map() };
        noteAgg.set(path, agg);
      }
      agg.rrf += rrf;
      const hit = agg.hits.get(idx) ?? {
        idx,
        text: chunk.text,
        cosine: 0,
        bm25: 0,
        rrf: 0,
      };
      hit.cosine = Math.max(hit.cosine, cosine);
      hit.bm25 = Math.max(hit.bm25, bm25Score);
      hit.rrf += rrf;
      agg.hits.set(idx, hit);
    };
    vecTop.forEach((v, i) => addHit(v.key, i + 1, v.cosine, 0, W_VEC));
    bm25Top.forEach((b, i) => addHit(b.chunkKey, i + 1, 0, b.score, W_BM25));

    // 4. 排序与归一化（加权 rrf 理论最大 ≈ (1+0.5)/61）
    const maxRrf = (W_VEC + W_BM25) / (RRF_K + 1);
    const results: HybridResult[] = [...noteAgg.entries()]
      .map(([path, agg]) => ({
        path,
        score: Math.min(1, agg.rrf / maxRrf),
        chunkHits: [...agg.hits.values()].sort((a, b) => b.rrf - a.rrf).slice(0, 3),
      }))
      .filter((r) => r.score >= minRrf)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return results;
  }

  /** 全量重建 BM25 倒排（加载后调用；构建期间检索降级为纯向量） */
  rebuildBM25(): void {
    this.bm25 = new BM25Index();
    for (const [key, c] of Object.entries(this.data.chunks)) {
      this.bm25.addChunk(key, c.text);
    }
  }

  /**
   * 两篇笔记的共同关键主题词（「为什么相关」标签）
   * 按 idf × 联合频次加权排序，返回互不重叠的 topN 个词
   */
  /**
   * 两篇笔记的共同关键主题词（「为什么相关」标签）
   * 短语级提取：从两篇共同出现的 2-6 字中文片段中，过滤功能字搭配与停用词，
   * 按「共现频次 × 长度奖励」排序，输出互不重叠的完整词组（如「手冲咖啡」「粉水比」）
   */
  commonTerms(pathA: string, pathB: string, topN = 3): string[] {
    const cacheKey = `terms|${pathA}|${pathB}`;
    const cached = this.termCache.get(cacheKey);
    if (cached) return cached;

    const textOf = (prefix: string): string => {
      const parts: string[] = [];
      for (const [key, c] of Object.entries(this.data.chunks)) {
        if (!key.startsWith(prefix + "#")) continue;
        parts.push(c.text);
      }
      return parts.join("\n");
    };
    const ta = textOf(pathA);
    const tb = textOf(pathB);
    const result: string[] = [];
    if (ta && tb) {
      // 功能字黑名单：候选片段含任一此字即丢弃（虚词/代词/常用动词，不构成主题标签）
      const FUNC_CHARS = new Set(
        "的了是在我你他她它这那就都也很不与及或把被让使从到对为等之其们吗呢吧啊呀哦嗯个过给跟比还又再便曾每各某第要能可以会应该需要可能一定更最太若有被问说看想觉听从如果则但虽然虽然虽然虽然".split("")
      );
      // B 侧 2-6 字中文子串集合
      const bSet = new Set<string>();
      for (const seg of tb.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
        for (let len = 2; len <= 6 && len <= seg.length; len++) {
          for (let i = 0; i + len <= seg.length; i++) bSet.add(seg.slice(i, i + len));
        }
      }
      const countIn = (text: string, s: string): number => {
        let n = 0;
        let i = text.indexOf(s);
        while (i !== -1) {
          n++;
          i = text.indexOf(s, i + 1);
        }
        return n;
      };
      const scored: { t: string; s: number }[] = [];
      const seen = new Set<string>();
      for (const seg of ta.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
        for (let len = 2; len <= 6 && len <= seg.length; len++) {
          for (let i = 0; i + len <= seg.length; i++) {
            const s = seg.slice(i, i + len);
            if (seen.has(s)) continue;
            seen.add(s);
            if (isStopTerm(s)) continue;
            let bad = false;
            for (const ch of s) {
              if (FUNC_CHARS.has(ch)) {
                bad = true;
                break;
              }
            }
            if (bad) continue;
            if (!bSet.has(s)) continue;
            const fa = countIn(ta, s);
            const fb = countIn(tb, s);
            if (fa < 1 || fb < 1) continue;
            const lenBonus = len >= 3 && len <= 4 ? 2 : len === 2 ? 0.8 : 1.5;
            scored.push({ t: s, s: (fa + fb) * lenBonus });
          }
        }
      }
      scored.sort((a, b) => b.s - a.s);
      // 包含关系去重：保留高分的长片段（「手冲咖啡」优先于其子串「咖啡」），不同词组可并存
      for (const { t } of scored) {
        if (result.some((p) => p.includes(t) || t.includes(p))) continue;
        result.push(t);
        if (result.length >= topN) break;
      }
    }
    this.termCache.set(cacheKey, result);
    if (this.termCache.size > 300) this.termCache.clear();
    return result;
  }

  get bm25Ready(): boolean {
    return this.bm25.size === this.chunkCount;
  }

  /* ---------------- 持久化 ---------------- */

  toJSON(): IndexDataV2 {
    return this.data;
  }

  static fromJSON(signature: string, json: IndexDataV2 | null | undefined): SemanticIndex {
    return new SemanticIndex(signature, json ?? undefined);
  }

  stats(): { docs: number; chunks: number; signature: string; updated: number } {
    return {
      docs: this.docCount,
      chunks: this.chunkCount,
      signature: this.data.meta.signature,
      updated: this.data.meta.updated,
    };
  }
}
