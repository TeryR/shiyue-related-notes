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

// test/hybrid-quick.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

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
function preprocessText(raw, maxChars) {
  let t = raw.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2").replace(/\[\[([^\]]*)\]\]/g, "$1").replace(/^#{1,6}\s*/gm, "").replace(/^>\s*/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+[.、]\s+/gm, "").replace(/^---+\s*$/gm, " ").replace(/\|/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (t.length > maxChars) {
    t = t.slice(0, maxChars);
  }
  return t;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

// src/embedder.ts
function describeApiError(status, bodyText) {
  const body = (bodyText || "").slice(0, 300);
  if (status === 401 || status === 403) {
    return `API Key \u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF08HTTP ${status}\uFF09\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u68C0\u67E5\u5BC6\u94A5`;
  }
  if (status === 404) {
    return `\u6A21\u578B\u4E0D\u5B58\u5728\u6216\u63A5\u53E3\u5730\u5740\u6709\u8BEF\uFF08HTTP 404\uFF09\uFF1A${body}`;
  }
  if (status === 429) {
    return `\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF08HTTP 429\uFF09\uFF0C\u5DF2\u81EA\u52A8\u91CD\u8BD5\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5`;
  }
  if (status >= 500) {
    return `\u670D\u52A1\u7AEF\u9519\u8BEF\uFF08HTTP ${status}\uFF09\uFF1A${body}`;
  }
  return `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${status}\uFF09\uFF1A${body}`;
}
async function fetchWithRetry(url, init, timeoutSec, attempts = 3) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutSec * 1e3);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
        await sleep(1e3 * Math.pow(2, i));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (i < attempts - 1) {
        await sleep(1e3 * Math.pow(2, i));
        continue;
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (msg.includes("abort")) {
    throw new Error(`\u8BF7\u6C42\u8D85\u65F6\uFF08${timeoutSec} \u79D2\uFF09`);
  }
  throw new Error(`\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\uFF1A${msg}`);
}
function joinUrl(base, path2) {
  return base.replace(/\/+$/, "") + "/" + path2.replace(/^\/+/, "");
}
var OllamaEmbeddingProvider = class {
  constructor(baseUrl, model, batchSize, timeoutSec, attempts = 3) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.batchSize = batchSize;
    this.timeoutSec = timeoutSec;
    this.attempts = attempts;
    this.displayName = "Ollama \u672C\u5730\u6A21\u578B";
  }
  async rawEmbed(texts) {
    const url = joinUrl(this.baseUrl, "api/embed");
    const res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: texts })
      },
      this.timeoutSec,
      this.attempts
    );
    if (res.status === 404 || res.status === 400) {
      const out = [];
      for (const t of texts) {
        const r2 = await fetchWithRetry(
          joinUrl(this.baseUrl, "api/embeddings"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: this.model, prompt: t })
          },
          this.timeoutSec,
          this.attempts
        );
        if (!r2.ok) {
          throw new Error(
            `Ollama \u63A5\u53E3\u8C03\u7528\u5931\u8D25\uFF1A${describeApiError(r2.status, await r2.text())}`
          );
        }
        const j2 = await r2.json();
        out.push(j2.embedding);
      }
      return out;
    }
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404 && body.includes("model")) {
        throw new Error(`Ollama \u4E2D\u627E\u4E0D\u5230\u6A21\u578B\u300C${this.model}\u300D\uFF0C\u8BF7\u5148\u8FD0\u884C\uFF1Aollama pull ${this.model}`);
      }
      throw new Error(describeApiError(res.status, body));
    }
    const json = await res.json();
    const emb = json?.embeddings;
    if (!emb || emb.length !== texts.length) {
      throw new Error("Ollama \u8FD4\u56DE\u7684\u5411\u91CF\u6570\u91CF\u4E0E\u8BF7\u6C42\u4E0D\u4E00\u81F4");
    }
    return emb;
  }
  async embedOne(text) {
    const res = await this.rawEmbed([text]);
    return res[0];
  }
  async embed(texts) {
    const out = [];
    const chunk = Math.max(1, this.batchSize || 32);
    for (let i = 0; i < texts.length; i += chunk) {
      const part = texts.slice(i, i + chunk);
      const vecs = await this.rawEmbed(part);
      out.push(...vecs);
    }
    return out;
  }
  async test() {
    try {
      const vec = await this.embedOne("\u6D4B\u8BD5\uFF1A\u4F60\u597D\uFF0C\u4E16\u754C");
      return {
        ok: true,
        message: `\u8FDE\u63A5\u6210\u529F\uFF0C\u6A21\u578B\u300C${this.model}\u300D\uFF0C\u5411\u91CF\u7EF4\u5EA6 ${vec.length}`,
        dims: vec.length
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: `\u8FDE\u63A5\u5931\u8D25\uFF1A${msg}` };
    }
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

// src/chunker.ts
function chunkText(text, maxChars = 800, overlap = 100) {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) {
    return [{ index: 0, text: clean }];
  }
  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const p of paragraphs) {
    if (p.length > maxChars) {
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      const sentences = p.split(/(?<=[。！？!?；;])\s*/).filter(Boolean);
      let sCur = "";
      for (const s of sentences) {
        if (s.length > maxChars) {
          if (sCur) {
            chunks.push(sCur);
            sCur = "";
          }
          for (let i = 0; i < s.length; i += maxChars - overlap) {
            chunks.push(s.slice(i, i + maxChars));
          }
        } else if ((sCur + s).length > maxChars) {
          chunks.push(sCur);
          sCur = s;
        } else {
          sCur += s;
        }
      }
      if (sCur) chunks.push(sCur);
    } else if ((cur + "\n" + p).length > maxChars) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n" + p : p;
    }
  }
  if (cur) chunks.push(cur);
  if (overlap > 0 && chunks.length > 1) {
    for (let i = chunks.length - 1; i > 0; i--) {
      const tail = chunks[i - 1].slice(-overlap);
      chunks[i] = tail + "\n" + chunks[i];
    }
  }
  return chunks.map((text2, index) => ({ index, text: text2 }));
}

// test/hybrid-quick.ts
var VAULT = path.join(__dirname, "vault");
var ZH_ROOT = path.join(VAULT, "\u4E2D\u6587\u8BDD\u9898\u5E93");
var NOTE_MAX = 16e3;
var CHUNK_MAX = 800;
function walkMd(dir, prefix = "") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...walkMd(full, rel));
    else if (ent.isFile() && ent.name.endsWith(".md")) out.push({ file: full, rel });
  }
  return out;
}
async function main() {
  const zh = [];
  const all = [];
  for (const topicDir of fs.readdirSync(ZH_ROOT, { withFileTypes: true })) {
    if (!topicDir.isDirectory()) continue;
    for (const f of walkMd(path.join(ZH_ROOT, topicDir.name))) {
      const rel = `\u4E2D\u6587\u8BDD\u9898\u5E93/${topicDir.name}/${f.rel}`;
      const raw = fs.readFileSync(path.join(VAULT, rel), "utf8");
      const text = preprocessText(raw, NOTE_MAX);
      const chunks = chunkText(raw, CHUNK_MAX, 100).map((c) => {
        const t = preprocessText(c.text, CHUNK_MAX + 200);
        return t ? { idx: c.index, text: t, hash: hashString(t) } : null;
      }).filter((x) => x !== null);
      const n = { path: rel, topic: topicDir.name, text, hash: hashString(text), chunks };
      all.push(n);
      if (topicDir.name !== "\u5E72\u6270\u7B14\u8BB0") zh.push(n);
    }
  }
  const enRoot = path.join(VAULT, "\u82F1\u6587\u5E93");
  for (const f of walkMd(enRoot)) {
    const rel = `\u82F1\u6587\u5E93/${f.rel}`;
    const raw = fs.readFileSync(path.join(VAULT, rel), "utf8");
    const text = preprocessText(raw, NOTE_MAX);
    const chunks = chunkText(raw, CHUNK_MAX, 100).map((c) => {
      const t = preprocessText(c.text, CHUNK_MAX + 200);
      return t ? { idx: c.index, text: t, hash: hashString(t) } : null;
    }).filter((x) => x !== null);
    all.push({ path: rel, topic: "\u82F1\u6587", text, hash: hashString(text), chunks });
  }
  const settings = { ...DEFAULT_SETTINGS, embeddingProvider: "ollama", ollamaModel: "bge-m3", batchSize: 16 };
  const provider = new OllamaEmbeddingProvider("http://127.0.0.1:11434", "bge-m3", 16, 120, 3);
  const index = SemanticIndex.fromJSON(embeddingSignature(settings), null);
  for (const n of all) {
    const vecs = await provider.embed(n.chunks.map((c) => c.text));
    index.upsertNote(n.path, n.hash, n.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: vecs[j] })));
  }
  console.log(`\u7D22\u5F15\u5B8C\u6210\uFF1A${index.docCount} \u7BC7 / ${index.chunkCount} \u5757`);
  let hySum = 0;
  let hyTitleSum = 0;
  let hyFullSum = 0;
  let docSum = 0;
  for (const n of zh) {
    const qA = n.text.slice(0, 200);
    const qvecA = (await provider.embed([preprocessText(qA, 500)]))[0];
    const sameA = index.hybridSearch(qvecA, qA, 5, 0).filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    hySum += sameA / 5;
    const qB = n.text;
    const qvecB = (await provider.embed([preprocessText(qB, 500)]))[0];
    const sameB = index.hybridSearch(qvecB, qB, 5, 0).filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    hyFullSum += sameB / 5;
    const qC = n.path.split("/").pop().replace(/\.md$/i, "");
    const qvecC = (await provider.embed([preprocessText(qC, 500)]))[0];
    const sameC = index.hybridSearch(qvecC, qC, 5, 0).filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    hyTitleSum += sameC / 5;
    const doc = index.similarTo(n.path, 5, 0.4);
    const sameD = doc.filter((r) => zh.find((z) => z.path === r.path)?.topic === n.topic).length;
    docSum += sameD / 5;
  }
  console.log(`\u6A21\u5F0FA \u5F00\u5934200\u5B57 \u6DF7\u5408\u68C0\u7D22\uFF1A${(hySum / zh.length * 100).toFixed(1)}%`);
  console.log(`\u6A21\u5F0FB \u6574\u7BC7\u6587\u672C \u6DF7\u5408\u68C0\u7D22\uFF1A${(hyFullSum / zh.length * 100).toFixed(1)}%`);
  console.log(`\u6A21\u5F0FC \u6807\u9898    \u6DF7\u5408\u68C0\u7D22\uFF1A${(hyTitleSum / zh.length * 100).toFixed(1)}%`);
  console.log(`\u6587\u6863\u7EA7 top-5 \u547D\u4E2D\u7387\uFF1A${(docSum / zh.length * 100).toFixed(1)}%`);
  process.exit(hyTitleSum / zh.length >= 0.7 && hyFullSum / zh.length >= 0.7 ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
