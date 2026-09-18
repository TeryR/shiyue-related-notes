var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// test/verify-tags.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/utils.ts
function cosineSimilarity(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// src/bm25.ts
var STOPWORDS = /* @__PURE__ */ new Set([
  "\u7684",
  "\u4E86",
  "\u662F",
  "\u5728",
  "\u548C",
  "\u6709",
  "\u4E0E",
  "\u5C31",
  "\u90FD",
  "\u800C",
  "\u53CA",
  "\u4E5F",
  "\u8FD9",
  "\u90A3",
  "\u4E00",
  "\u4E0D",
  "\u5F88",
  "\u4F1A",
  "\u8981",
  "\u5BF9",
  "\u4E3A",
  "\u4ECE",
  "\u5230",
  "\u6211\u4EEC",
  "\u4ED6\u4EEC",
  "\u8FD9\u4E2A",
  "\u90A3\u4E2A",
  "\u4E00\u4E2A",
  "\u4E00\u4E9B",
  "\u53EF\u4EE5",
  "\u9700\u8981",
  "\u5E94\u8BE5",
  "\u6BD4\u8F83",
  "\u8FD8\u6709",
  "\u7136\u540E",
  "\u4F46\u662F",
  "\u56E0\u4E3A",
  "\u6240\u4EE5",
  "\u5982\u679C",
  "\u867D\u7136",
  "\u5173\u4E8E",
  "\u5BF9\u4E8E",
  "\u76EE\u524D",
  "\u6700\u8FD1",
  "\u73B0\u5728",
  "\u8FDB\u884C",
  "\u5F00\u59CB",
  "\u7EE7\u7EED",
  "\u4FDD\u6301",
  "\u4F7F\u7528",
  "\u8BB0\u5F55",
  "\u5B9E\u8DF5",
  "\u6574\u7406",
  "\u5185\u5BB9",
  "\u60C5\u51B5",
  "\u7ED3\u679C",
  "\u65B9\u9762",
  "\u90E8\u5206",
  "\u95EE\u9898",
  "\u65B9\u6CD5",
  "\u4E3B\u8981",
  "\u91CD\u8981",
  "\u76F8\u5BF9",
  "\u6574\u4F53",
  "\u4EE5\u53CA",
  "\u5E76\u4E14",
  "\u6216\u8005",
  "\u8FD8\u662F",
  "\u6CA1\u6709",
  "\u4EC0\u4E48",
  "\u600E\u4E48",
  "\u600E\u6837",
  "\u5982\u4F55",
  "\u4E3A\u4EC0\u4E48",
  "\u65F6\u5019",
  "\u5730\u65B9",
  "\u4E1C\u897F",
  "\u4E8B\u60C5",
  "\u5927\u5BB6",
  "\u81EA\u5DF1",
  "\u54B1\u4EEC",
  "\u4E2D",
  "\u4E0A",
  "\u4E0B",
  "\u91CC",
  "\u540E",
  "\u524D",
  "\u7B49",
  "\u7B49\u7B49",
  "\u4E4B",
  "\u5176",
  "\u6216",
  "\u53C8",
  "\u518D",
  "\u4FBF",
  "\u66FE",
  "\u88AB",
  "\u628A",
  "\u8BA9",
  "\u4F7F",
  "\u6BCF",
  "\u5404",
  "\u67D0",
  "\u7B2C",
  "\u6708",
  "\u5E74",
  "\u65E5",
  "\u81EA\u52A8",
  "\u4E00\u4E0B",
  "\u4E0D\u4E86",
  "\u8D77\u6765",
  "\u51FA\u6765",
  "\u8FC7\u6765",
  "\u8FD9\u4E2A",
  "\u90A3\u4E2A",
  "\u4E0E",
  "\u53CA",
  "\u4E14",
  "\u82E5",
  "\u5219",
  "\u5373",
  "\u65E2",
  "\u867D",
  "\u4EA6",
  "\u52FF",
  "\u6BCB",
  "\u77E3",
  "\u7109",
  "\u4E4E",
  "\u54C9",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "be",
  "with",
  "at",
  "by",
  "it",
  "this",
  "that",
  "as",
  "from",
  "not",
  "can",
  "will",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "but",
  "so",
  "if",
  "then",
  "than",
  "about",
  "into"
]);
function isStopTerm(t) {
  return STOPWORDS.has(t);
}
function tokenize(text, filterStopwords = true) {
  const out = [];
  const cn = text.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const seg of cn) {
    if (seg.length === 1) {
      if (!filterStopwords || !STOPWORDS.has(seg)) out.push(seg);
      continue;
    }
    for (let i = 0; i < seg.length - 1; i++) {
      const t = seg.slice(i, i + 2);
      if (!filterStopwords || !STOPWORDS.has(t)) out.push(t);
    }
  }
  const en = text.match(/[a-zA-Z0-9_]+/g) ?? [];
  for (const w of en) {
    const lw = w.toLowerCase();
    if (!filterStopwords || !STOPWORDS.has(lw)) out.push(lw);
  }
  return out;
}
var BM25Index = class {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.df = /* @__PURE__ */ new Map();
    // term → 含该词的块数
    this.tf = /* @__PURE__ */ new Map();
    // term → chunkKey → 词频
    this.len = /* @__PURE__ */ new Map();
    // chunkKey → 词项总数
    this.n = 0;
    // 块总数
    this.avgLen = 0;
  }
  /** 添加或替换一个块 */
  addChunk(chunkKey2, text) {
    this.removeChunk(chunkKey2);
    const terms = tokenize(text);
    if (terms.length === 0) return;
    const tfMap = /* @__PURE__ */ new Map();
    for (const t of terms) tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    for (const [t, f] of tfMap) {
      if (!this.tf.has(t)) this.tf.set(t, /* @__PURE__ */ new Map());
      this.tf.get(t).set(chunkKey2, f);
      this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.len.set(chunkKey2, terms.length);
    this.n++;
    this.avgLen = (this.avgLen * (this.n - 1) + terms.length) / this.n;
  }
  /** 删除一个块 */
  removeChunk(chunkKey2) {
    const oldLen = this.len.get(chunkKey2);
    if (oldLen === void 0) return;
    for (const [t, m] of this.tf) {
      if (m.delete(chunkKey2)) {
        this.df.set(t, this.df.get(t) - 1);
        if (this.df.get(t) <= 0) {
          this.df.delete(t);
          this.tf.delete(t);
        }
      }
    }
    this.len.delete(chunkKey2);
    this.n--;
    if (this.n > 0) {
      this.avgLen = (this.avgLen * (this.n + 1) - oldLen) / this.n;
    } else {
      this.avgLen = 0;
    }
  }
  /** 删除某笔记的全部块 */
  removeDoc(notePath) {
    for (const key of [...this.len.keys()]) {
      if (key.startsWith(notePath + "#")) this.removeChunk(key);
    }
  }
  /** 查询：返回块级 topK */
  search(query, topK = 50) {
    const terms = tokenize(query);
    if (terms.length === 0) return [];
    const scores = /* @__PURE__ */ new Map();
    const queryTf = /* @__PURE__ */ new Map();
    for (const t of terms) queryTf.set(t, (queryTf.get(t) ?? 0) + 1);
    const idf = (term) => {
      const df = this.df.get(term) ?? 0;
      return Math.log(1 + (this.n - df + 0.5) / (df + 0.5));
    };
    for (const [term, qf] of queryTf) {
      const posting = this.tf.get(term);
      if (!posting) continue;
      const idfVal = idf(term);
      for (const [key, tfVal] of posting) {
        const dl = this.len.get(key) ?? 1;
        const denom = tfVal + this.k1 * (1 - this.b + this.b * (dl / (this.avgLen || 1)));
        const s = idfVal * (tfVal * (this.k1 + 1) / denom) * (1 + Math.log(1 + qf));
        scores.set(key, (scores.get(key) ?? 0) + s);
      }
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK).map(([chunkKey2, score]) => ({ chunkKey: chunkKey2, score }));
  }
  get size() {
    return this.n;
  }
  /** 词项的文档频率（含该词的块数）；不存在返回 0 */
  dfOf(term) {
    return this.df.get(term) ?? 0;
  }
};

// src/indexer.ts
var FORMAT_VERSION = 2;
function chunkKey(path2, idx) {
  return `${path2}#${idx}`;
}
function createIndex(signature) {
  return {
    meta: { signature, formatVersion: FORMAT_VERSION, updated: Date.now() },
    docs: {},
    chunks: {}
  };
}
var SemanticIndex = class _SemanticIndex {
  constructor(signature, existing) {
    this.bm25 = new BM25Index();
    this.version = 0;
    this.cache = /* @__PURE__ */ new Map();
    this.termCache = /* @__PURE__ */ new Map();
    if (existing && existing.meta.formatVersion === FORMAT_VERSION) {
      this.data = existing;
    } else {
      this.data = createIndex(signature);
    }
    this.rebuildBM25();
  }
  /* ---------------- 基础 ---------------- */
  get meta() {
    return this.data.meta;
  }
  get docCount() {
    return Object.keys(this.data.docs).length;
  }
  get chunkCount() {
    return Object.keys(this.data.chunks).length;
  }
  get paths() {
    return Object.keys(this.data.docs);
  }
  getEntry(path2) {
    return this.data.docs[path2];
  }
  /** 取某笔记某一块（增量比对用） */
  getChunk(path2, idx) {
    return this.data.chunks[chunkKey(path2, idx)];
  }
  isUpToDate(path2, contentHash) {
    const d = this.data.docs[path2];
    return !!d && d.hash === contentHash;
  }
  /** 计算文档聚合向量（块向量平均） */
  aggregate(embeddings) {
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
  upsertNote(path2, docHash, chunks) {
    const oldKeys = new Set(
      Object.keys(this.data.chunks).filter((k) => k.startsWith(path2 + "#"))
    );
    const usedKeys = /* @__PURE__ */ new Set();
    const chunkEmbeddings = [];
    for (const c of chunks) {
      const key = chunkKey(path2, c.idx);
      const old = this.data.chunks[key];
      if (old && old.hash === c.hash) {
        usedKeys.add(key);
        oldKeys.delete(key);
        chunkEmbeddings.push(old.embedding);
        continue;
      }
      if (old) {
        this.bm25.removeChunk(key);
        oldKeys.delete(key);
      }
      this.data.chunks[key] = {
        notePath: path2,
        idx: c.idx,
        hash: c.hash,
        updated: Date.now(),
        embedding: c.embedding,
        text: c.text
      };
      this.bm25.addChunk(key, c.text);
      usedKeys.add(key);
      chunkEmbeddings.push(c.embedding);
    }
    for (const key of oldKeys) {
      this.bm25.removeChunk(key);
      delete this.data.chunks[key];
    }
    this.data.docs[path2] = {
      hash: docHash,
      updated: Date.now(),
      embedding: this.aggregate(chunkEmbeddings),
      chunkCount: chunkEmbeddings.length
    };
    this.data.meta.updated = Date.now();
    this.bump();
  }
  /** 删除一篇笔记 */
  remove(path2) {
    for (const key of Object.keys(this.data.chunks)) {
      if (key.startsWith(path2 + "#")) {
        this.bm25.removeChunk(key);
        delete this.data.chunks[key];
      }
    }
    delete this.data.docs[path2];
    this.data.meta.updated = Date.now();
    this.bump();
  }
  bump() {
    this.version++;
    if (this.cache.size > 200) this.cache.clear();
    if (this.termCache.size > 0) this.termCache.clear();
  }
  /* ---------------- 查询 ---------------- */
  /** 文档级相似（侧边栏 / Smart View / 对话引用） */
  similarTo(path2, k, minScore) {
    const cacheKey = `${path2}|${k}|${Math.round(minScore * 1e3)}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.v === this.version) return hit.results;
    const self = this.data.docs[path2];
    if (!self) return [];
    const out = [];
    for (const [p, d] of Object.entries(this.data.docs)) {
      if (p === path2) continue;
      const score = cosineSimilarity(self.embedding, d.embedding);
      if (score >= minScore) out.push({ path: p, score });
    }
    out.sort((a, b) => b.score - a.score);
    const results = out.slice(0, k);
    this.cache.set(cacheKey, { v: this.version, results });
    return results;
  }
  /** 查询向量 → 文档级相似（语义搜索 UI 已改用 hybridSearch） */
  async similarToQuery(queryVector, k, minScore, excludePaths = /* @__PURE__ */ new Set()) {
    const out = [];
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
  hybridSearch(queryVector, queryText, k, minRrf = 0, vectorTopK = 50, bm25TopK = 30) {
    const RRF_K = 60;
    const W_VEC = 1;
    const W_BM25 = 0.5;
    const vecRanks = [];
    for (const [key, c] of Object.entries(this.data.chunks)) {
      const s = cosineSimilarity(queryVector, c.embedding);
      if (s > 0) vecRanks.push({ key, cosine: s });
    }
    vecRanks.sort((a, b) => b.cosine - a.cosine);
    const vecTop = vecRanks.slice(0, vectorTopK);
    const bm25Top = this.bm25.search(queryText, bm25TopK);
    const noteAgg = /* @__PURE__ */ new Map();
    const addHit = (key, rank, cosine, bm25Score, weight) => {
      const hashIdx = key.lastIndexOf("#");
      const path2 = key.slice(0, hashIdx);
      const idx = parseInt(key.slice(hashIdx + 1), 10);
      const chunk = this.data.chunks[key];
      if (!chunk) return;
      const rrf = weight / (RRF_K + rank);
      let agg = noteAgg.get(path2);
      if (!agg) {
        agg = { rrf: 0, hits: /* @__PURE__ */ new Map() };
        noteAgg.set(path2, agg);
      }
      agg.rrf += rrf;
      const hit = agg.hits.get(idx) ?? {
        idx,
        text: chunk.text,
        cosine: 0,
        bm25: 0,
        rrf: 0
      };
      hit.cosine = Math.max(hit.cosine, cosine);
      hit.bm25 = Math.max(hit.bm25, bm25Score);
      hit.rrf += rrf;
      agg.hits.set(idx, hit);
    };
    vecTop.forEach((v, i) => addHit(v.key, i + 1, v.cosine, 0, W_VEC));
    bm25Top.forEach((b, i) => addHit(b.chunkKey, i + 1, 0, b.score, W_BM25));
    const maxRrf = (W_VEC + W_BM25) / (RRF_K + 1);
    const results = [...noteAgg.entries()].map(([path2, agg]) => ({
      path: path2,
      score: Math.min(1, agg.rrf / maxRrf),
      chunkHits: [...agg.hits.values()].sort((a, b) => b.rrf - a.rrf).slice(0, 3)
    })).filter((r) => r.score >= minRrf).sort((a, b) => b.score - a.score).slice(0, k);
    return results;
  }
  /** 全量重建 BM25 倒排（加载后调用；构建期间检索降级为纯向量） */
  rebuildBM25() {
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
  commonTerms(pathA, pathB, topN = 3) {
    const cacheKey = `terms|${pathA}|${pathB}`;
    const cached = this.termCache.get(cacheKey);
    if (cached) return cached;
    const textOf = (prefix) => {
      const parts = [];
      for (const [key, c] of Object.entries(this.data.chunks)) {
        if (!key.startsWith(prefix + "#")) continue;
        parts.push(c.text);
      }
      return parts.join("\n");
    };
    const ta = textOf(pathA);
    const tb = textOf(pathB);
    const result = [];
    if (ta && tb) {
      const FUNC_CHARS = new Set(
        "\u7684\u4E86\u662F\u5728\u6211\u4F60\u4ED6\u5979\u5B83\u8FD9\u90A3\u5C31\u90FD\u4E5F\u5F88\u4E0D\u4E0E\u53CA\u6216\u628A\u88AB\u8BA9\u4F7F\u4ECE\u5230\u5BF9\u4E3A\u7B49\u4E4B\u5176\u4EEC\u5417\u5462\u5427\u554A\u5440\u54E6\u55EF\u4E2A\u8FC7\u7ED9\u8DDF\u6BD4\u8FD8\u53C8\u518D\u4FBF\u66FE\u6BCF\u5404\u67D0\u7B2C\u8981\u80FD\u53EF\u4EE5\u4F1A\u5E94\u8BE5\u9700\u8981\u53EF\u80FD\u4E00\u5B9A\u66F4\u6700\u592A\u82E5\u6709\u88AB\u95EE\u8BF4\u770B\u60F3\u89C9\u542C\u4ECE\u5982\u679C\u5219\u4F46\u867D\u7136\u867D\u7136\u867D\u7136\u867D\u7136".split("")
      );
      const bSet = /* @__PURE__ */ new Set();
      for (const seg of tb.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
        for (let len = 2; len <= 6 && len <= seg.length; len++) {
          for (let i = 0; i + len <= seg.length; i++) bSet.add(seg.slice(i, i + len));
        }
      }
      const countIn = (text, s) => {
        let n = 0;
        let i = text.indexOf(s);
        while (i !== -1) {
          n++;
          i = text.indexOf(s, i + 1);
        }
        return n;
      };
      const scored = [];
      const seen = /* @__PURE__ */ new Set();
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
  get bm25Ready() {
    return this.bm25.size === this.chunkCount;
  }
  /* ---------------- 持久化 ---------------- */
  toJSON() {
    return this.data;
  }
  static fromJSON(signature, json) {
    return new _SemanticIndex(signature, json ?? void 0);
  }
  stats() {
    return {
      docs: this.docCount,
      chunks: this.chunkCount,
      signature: this.data.meta.signature,
      updated: this.data.meta.updated
    };
  }
};

// src/settings.ts
var DEFAULT_SETTINGS = {
  embeddingProvider: "openai",
  chatProvider: "openai",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiApiKey: "",
  embeddingModel: "text-embedding-3-small",
  chatModel: "gpt-4o-mini",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "bge-m3",
  ollamaChatModel: "qwen2.5:7b",
  anthropicBaseUrl: "https://api.anthropic.com",
  anthropicApiKey: "",
  anthropicModel: "claude-3-5-haiku-latest",
  maxResults: 5,
  minSimilarity: 0.4,
  excludedFolders: [],
  autoIndex: true,
  embedMaxChars: 800,
  noteMaxChars: 16e3,
  batchSize: 32,
  requestTimeoutSec: 60,
  chatMaxContextNotes: 5,
  retryAttempts: 3,
  tuneUpPaths: [],
  tuneDownPaths: []
};
function embeddingSignature(s) {
  if (s.embeddingProvider === "ollama") {
    return `ollama|${s.ollamaBaseUrl}|${s.ollamaModel}`;
  }
  return `openai|${s.openaiBaseUrl}|${s.embeddingModel}`;
}

// test/verify-tags.ts
var VAULT = path.join(__dirname, "vault");
var INDEX = path.join(VAULT, ".obsidian", "plugins", "shiyue-related-notes", "embeddings.json");
function main() {
  const settings = { ...DEFAULT_SETTINGS, embeddingProvider: "ollama", ollamaModel: "bge-m3" };
  const sig = embeddingSignature(settings);
  const json = JSON.parse(fs.readFileSync(INDEX, "utf8"));
  const index = SemanticIndex.fromJSON(sig, json);
  console.log(`\u7D22\u5F15\uFF1A${index.docCount} \u7BC7 / ${index.chunkCount} \u5757
`);
  const cases = [
    ["\u4E2D\u6587\u8BDD\u9898\u5E93/\u5496\u5561\u6587\u5316\u4E0E\u624B\u51B2/\u624B\u51B2\u5496\u5561\u5165\u95E8\u7B14\u8BB0.md", "\u4E2D\u6587\u8BDD\u9898\u5E93/\u5496\u5561\u6587\u5316\u4E0E\u624B\u51B2/\u610F\u5F0F\u6D53\u7F29\u4E0E\u5976\u5496.md"],
    ["\u4E2D\u6587\u8BDD\u9898\u5E93/\u5496\u5561\u6587\u5316\u4E0E\u624B\u51B2/\u624B\u51B2\u5496\u5561\u5165\u95E8\u7B14\u8BB0.md", "\u4E2D\u6587\u8BDD\u9898\u5E93/\u5065\u5EB7\u996E\u98DF\u4E0E\u8425\u517B/\u51CF\u8102\u671F\u7684\u86CB\u767D\u8D28\u6444\u5165.md"],
    ["\u4E2D\u6587\u8BDD\u9898\u5E93/\u5386\u53F2\u4EBA\u7269\u4E0E\u738B\u671D/\u5510\u592A\u5B97\u4E0E\u8D1E\u89C2\u4E4B\u6CBB.md", "\u4E2D\u6587\u8BDD\u9898\u5E93/\u5386\u53F2\u4EBA\u7269\u4E0E\u738B\u671D/\u660E\u592A\u7956\u6731\u5143\u748B\u7684\u6CBB\u56FD\u7B56\u7565.md"]
  ];
  let ok = 0;
  for (const [a, b] of cases) {
    const terms = index.commonTerms(a, b, 3);
    const aName = a.split("/").pop();
    const bName = b.split("/").pop();
    console.log(`${aName} \u2194 ${bName}`);
    console.log(`  \u5171\u540C\u4E3B\u9898\u8BCD\uFF1A${terms.length ? terms.join(" \xB7 ") : "\uFF08\u65E0\uFF09"}`);
    if (terms.length > 0) ok++;
  }
  console.log(`
${ok}/${cases.length} \u7EC4\u63D0\u53D6\u5230\u5171\u540C\u4E3B\u9898\u8BCD`);
  process.exit(ok >= 2 ? 0 : 1);
}
main();
