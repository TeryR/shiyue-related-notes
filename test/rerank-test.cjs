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

// test/rerank-test.ts
var http = __toESM(require("http"));

// src/rerank.ts
function joinUrl(base, path) {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}
async function rerank(cfg, query, documents) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (cfg.timeoutSec || 60) * 1e3);
  try {
    let url;
    let body;
    const headers = { "Content-Type": "application/json" };
    if (cfg.provider === "ollama") {
      url = joinUrl(cfg.baseUrl, "api/rerank");
      body = { model: cfg.model, query, documents };
    } else {
      url = joinUrl(cfg.baseUrl, "rerank");
      if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
      body = { model: cfg.model, query, documents, top_n: Math.min(documents.length, cfg.topK || 50) };
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 404) {
        throw new Error(
          `\u7AEF\u70B9\u4E0D\u652F\u6301\u91CD\u6392\u5E8F\uFF08HTTP 404\uFF09\uFF1A${url}\u3002\u8BF7\u786E\u8BA4\u670D\u52A1\u7248\u672C\u652F\u6301 rerank\uFF0C\u6216\u6539\u7528\u5176\u4ED6\u7AEF\u70B9\u3002`
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`\u91CD\u6392\u5E8F API Key \u65E0\u6548\u6216\u672A\u586B\uFF08HTTP ${res.status}\uFF09`);
      }
      throw new Error(`\u91CD\u6392\u5E8F\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${res.status}\uFF09\uFF1A${text}`);
    }
    const json = await res.json();
    const results = json?.results;
    if (!Array.isArray(results)) throw new Error("\u91CD\u6392\u5E8F\u54CD\u5E94\u683C\u5F0F\u5F02\u5E38\uFF08\u7F3A\u5C11 results\uFF09");
    return results.map((r) => ({ index: r.index, score: r.relevance_score ?? r.score ?? 0 })).sort((a, b) => b.score - a.score);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort/i.test(msg)) throw new Error(`\u91CD\u6392\u5E8F\u8BF7\u6C42\u8D85\u65F6\uFF08${cfg.timeoutSec || 60} \u79D2\uFF09`);
    throw e instanceof Error ? e : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

// src/utils.ts
function hashString(s) {
  let h1 = 3735928559;
  let h2 = 1103547991;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
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
function chunkKey(path, idx) {
  return `${path}#${idx}`;
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
  getEntry(path) {
    return this.data.docs[path];
  }
  /** 取某笔记某一块（增量比对用） */
  getChunk(path, idx) {
    return this.data.chunks[chunkKey(path, idx)];
  }
  isUpToDate(path, contentHash) {
    const d = this.data.docs[path];
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
  upsertNote(path, docHash, chunks) {
    const oldKeys = new Set(
      Object.keys(this.data.chunks).filter((k) => k.startsWith(path + "#"))
    );
    const usedKeys = /* @__PURE__ */ new Set();
    const chunkEmbeddings = [];
    for (const c of chunks) {
      const key = chunkKey(path, c.idx);
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
        notePath: path,
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
    this.data.docs[path] = {
      hash: docHash,
      updated: Date.now(),
      embedding: this.aggregate(chunkEmbeddings),
      chunkCount: chunkEmbeddings.length
    };
    this.data.meta.updated = Date.now();
    this.bump();
  }
  /** 删除一篇笔记 */
  remove(path) {
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
  bump() {
    this.version++;
    if (this.cache.size > 200) this.cache.clear();
    if (this.termCache.size > 0) this.termCache.clear();
  }
  /* ---------------- 查询 ---------------- */
  /** 文档级相似（侧边栏 / Smart View / 对话引用） */
  similarTo(path, k, minScore) {
    const cacheKey = `${path}|${k}|${Math.round(minScore * 1e3)}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.v === this.version) return hit.results;
    const self = this.data.docs[path];
    if (!self) return [];
    const out = [];
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
      const path = key.slice(0, hashIdx);
      const idx = parseInt(key.slice(hashIdx + 1), 10);
      const chunk = this.data.chunks[key];
      if (!chunk) return;
      const rrf = weight / (RRF_K + rank);
      let agg = noteAgg.get(path);
      if (!agg) {
        agg = { rrf: 0, hits: /* @__PURE__ */ new Map() };
        noteAgg.set(path, agg);
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
    const results = [...noteAgg.entries()].map(([path, agg]) => ({
      path,
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

// test/rerank-test.ts
var passed = 0;
var failed = 0;
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \u2705 ${name}${detail ? `\uFF08${detail}\uFF09` : ""}`);
  } else {
    failed++;
    console.log(`  \u274C ${name}${detail ? `\uFF08${detail}\uFF09` : ""}`);
  }
}
function pseudoVec(text) {
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
async function withServer(handler, fn) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => body += d);
    req.on("end", () => handler(req, body, res));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  try {
    await fn(port);
  } finally {
    server.close();
  }
}
async function main() {
  console.log("\u30101\u3011OpenAI \u517C\u5BB9 /rerank \u7AEF\u70B9");
  await withServer(
    (req, body, res) => {
      check("\u8BF7\u6C42\u8DEF\u5F84\u4E3A /rerank", req.url?.includes("/rerank") ?? false);
      check("Bearer \u8BA4\u8BC1\u5934\u5B58\u5728", (req.headers.authorization ?? "").startsWith("Bearer sk-test"));
      const parsed = JSON.parse(body);
      check("\u8BF7\u6C42\u4F53\u542B model/query/documents/top_n", !!parsed.model && !!parsed.query && Array.isArray(parsed.documents) && typeof parsed.top_n === "number");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ results: [{ index: 1, relevance_score: 0.95 }, { index: 0, relevance_score: 0.3 }] }));
    },
    async (port) => {
      const cfg = { provider: "openai-compat", baseUrl: `http://127.0.0.1:${port}`, apiKey: "sk-test", model: "test-rerank", topK: 5, timeoutSec: 10 };
      const hits = await rerank(cfg, "\u5496\u5561", ["\u624B\u51B2\u5496\u5561\u7684\u53C2\u6570", "\u6DF1\u8E72\u8BAD\u7EC3\u8981\u70B9"]);
      check("\u54CD\u5E94\u89E3\u6790\u6B63\u786E", hits.length === 2 && hits[0].index === 1 && hits[0].score === 0.95);
    }
  );
  console.log("\n\u30102\u3011Ollama /api/rerank \u7AEF\u70B9");
  await withServer(
    (req, body, res) => {
      check("\u8BF7\u6C42\u8DEF\u5F84\u4E3A /api/rerank", req.url?.includes("/api/rerank") ?? false);
      check("\u65E0 Bearer \u5934\uFF08Ollama \u672C\u5730\u65E0\u9700\u8BA4\u8BC1\uFF09", !req.headers.authorization);
      const parsed = JSON.parse(body);
      check("\u8BF7\u6C42\u4F53\u542B model/query/documents\uFF08\u65E0 top_n\uFF09", !!parsed.model && !!parsed.query && Array.isArray(parsed.documents) && parsed.top_n === void 0);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ results: [{ index: 0, relevance_score: 0.8 }] }));
    },
    async (port) => {
      const cfg = { provider: "ollama", baseUrl: `http://127.0.0.1:${port}`, apiKey: "", model: "bge-reranker-v2-m3", topK: 5, timeoutSec: 10 };
      const hits = await rerank(cfg, "\u5496\u5561", ["a", "b"]);
      check("Ollama \u54CD\u5E94\u89E3\u6790\u6B63\u786E", hits.length === 1 && hits[0].score === 0.8);
    }
  );
  console.log("\n\u30103\u3011\u9519\u8BEF\u5904\u7406");
  await withServer(
    (req, body, res) => {
      res.statusCode = 404;
      res.end("not found");
    },
    async (port) => {
      try {
        await rerank({ provider: "ollama", baseUrl: `http://127.0.0.1:${port}`, apiKey: "", model: "x", topK: 5, timeoutSec: 10 }, "q", ["a"]);
        check("404 \u8FD4\u56DE\u660E\u786E\u9519\u8BEF", false);
      } catch (e) {
        check("404 \u8FD4\u56DE\u660E\u786E\u9519\u8BEF", e.message.includes("\u7AEF\u70B9\u4E0D\u652F\u6301"));
      }
    }
  );
  console.log("\n\u30104\u3011\u68C0\u7D22\u7BA1\u7EBF\uFF1Arerank \u7CBE\u6392\u7FFB\u8F6C\u6DF7\u5408\u6392\u5E8F");
  {
    const index = SemanticIndex.fromJSON("test", null);
    const docs = [
      { path: "\u5496\u5561.md", text: "\u624B\u51B2\u5496\u5561\u7684\u53C2\u6570\uFF1A\u7C89\u6C34\u6BD4\u3001\u6C34\u6E29\u3001\u95F7\u84B8\u3002", hash: hashString("a") },
      { path: "\u5065\u8EAB.md", text: "\u6DF1\u8E72\u8BAD\u7EC3\uFF1A\u6838\u5FC3\u6536\u7D27\u3001\u819D\u76D6\u65B9\u5411\u3002", hash: hashString("b") },
      { path: "\u5386\u53F2.md", text: "\u5510\u592A\u5B97\u8D1E\u89C2\u4E4B\u6CBB\uFF1A\u7EB3\u8C0F\u3001\u8F7B\u5FAD\u8584\u8D4B\u3002", hash: hashString("c") }
    ];
    for (const d of docs) {
      index.upsertNote(d.path, d.hash, [{ idx: 0, text: d.text, hash: d.hash, embedding: pseudoVec(d.text) }]);
    }
    const q = "\u624B\u51B2\u5496\u5561 \u7C89\u6C34\u6BD4 \u6C34\u6E29";
    const qvec = pseudoVec(q);
    const candidates = index.hybridSearch(qvec, q, 5, 0);
    check("\u7C97\u6392\u547D\u4E2D\u5496\u5561", candidates[0]?.path === "\u5496\u5561.md", candidates.map((c) => c.path).join(","));
    await withServer(
      (req, body, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ results: [{ index: 2, relevance_score: 0.9 }, { index: 1, relevance_score: 0.5 }, { index: 0, relevance_score: 0.1 }] }));
      },
      async (port) => {
        const cfg = { provider: "openai-compat", baseUrl: `http://127.0.0.1:${port}`, apiKey: "k", model: "m", topK: 5, timeoutSec: 10 };
        const rr = await rerank(cfg, q, candidates.map((c) => c.chunkHits[0]?.text ?? ""));
        const reranked = [];
        const seen = /* @__PURE__ */ new Set();
        for (const h of rr) {
          if (seen.has(h.index)) continue;
          seen.add(h.index);
          const cand = candidates[h.index];
          if (cand) reranked.push({ ...cand, score: h.score });
        }
        check("rerank \u5206\u6570\u5DF2\u66FF\u6362 RRF \u5206\u6570", reranked.every((r) => r.score <= 1));
        check("\u91CD\u6392\u987A\u5E8F\u4E0E mock \u4E00\u81F4\uFF08\u9996\u6761\u4E3A\u7CBE\u6392\u6700\u9AD8\u5206\u7684\u6587\u6863\uFF09", reranked[0]?.path === candidates[2]?.path, `\u9996\u6761=${reranked[0]?.path}\uFF0C\u671F\u671B=${candidates[2]?.path}`);
      }
    );
  }
  console.log(`
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  console.log(`\u901A\u8FC7 ${passed} \u9879\uFF0C\u5931\u8D25 ${failed} \u9879`);
  console.log(`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("\u6D4B\u8BD5\u5F02\u5E38\uFF1A", e);
  process.exit(1);
});
