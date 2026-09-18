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

// test/run-tests.ts
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
function isExcludedPath(path2, excludedFolders) {
  for (const folder of excludedFolders) {
    if (folder && (path2 === folder || path2.startsWith(folder + "/"))) {
      return true;
    }
  }
  return false;
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

// test/run-tests.ts
var VAULT = path.join(__dirname, "vault");
var ZH_ROOT = path.join(VAULT, "\u4E2D\u6587\u8BDD\u9898\u5E93");
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
function info(name, detail) {
  console.log(`  \u2139\uFE0F  ${name}\uFF08${detail}\uFF09`);
}
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
var NOTE_MAX = 16e3;
var CHUNK_MAX = 800;
function readNotes() {
  const make = (rel, topic) => {
    const abs = path.join(VAULT, rel);
    const raw = fs.readFileSync(abs, "utf8");
    const text = preprocessText(raw, NOTE_MAX);
    const chunks = chunkText(raw, CHUNK_MAX, 100).map((c) => {
      const t = preprocessText(c.text, CHUNK_MAX + 200);
      return t ? { idx: c.index, text: t, hash: hashString(t) } : null;
    }).filter((x) => x !== null);
    return { path: rel, topic, text, hash: hashString(text), chunks };
  };
  const zh = [];
  const outliers = [];
  const en = [];
  const stress = [];
  for (const topicDir of fs.readdirSync(ZH_ROOT, { withFileTypes: true })) {
    if (!topicDir.isDirectory()) continue;
    for (const f of walkMd(path.join(ZH_ROOT, topicDir.name))) {
      const n = make(`\u4E2D\u6587\u8BDD\u9898\u5E93/${topicDir.name}/${f.rel}`, topicDir.name);
      if (topicDir.name === "\u5E72\u6270\u7B14\u8BB0") outliers.push(n);
      else zh.push(n);
    }
  }
  const enRoot = path.join(VAULT, "\u82F1\u6587\u5E93");
  for (const f of walkMd(enRoot)) {
    en.push(make(`\u82F1\u6587\u5E93/${f.rel}`, "\u82F1\u6587"));
  }
  const stressRoot = path.join(VAULT, "\u538B\u6D4B\u5E93");
  for (const f of walkMd(stressRoot)) {
    stress.push(make(`\u538B\u6D4B\u5E93/${f.rel}`, f.rel.split("/")[0]));
  }
  return { zh, outliers, en, stress };
}
async function buildIndex(provider, notes, label) {
  const index = SemanticIndex.fromJSON(embeddingSignature({ ...DEFAULT_SETTINGS, embeddingProvider: "ollama", ollamaModel: "bge-m3" }), null);
  const t0 = Date.now();
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const vecs = await provider.embed(n.chunks.map((c) => c.text));
    index.upsertNote(
      n.path,
      n.hash,
      n.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: vecs[j] }))
    );
    if ((i + 1) % 16 === 0 || i === notes.length - 1) {
      process.stdout.write(`\r  ${label} \u7D22\u5F15\u8FDB\u5EA6 ${i + 1}/${notes.length}`);
    }
  }
  process.stdout.write("\n");
  return { index, ms: Date.now() - t0 };
}
async function main() {
  console.log("\u2550\u2550\u2550 \u667A\u80FD\u5173\u8054\uFF08Smart Connections \u4E2D\u6587\u7248\uFF09\u81EA\u52A8\u5316\u6D4B\u8BD5 v3\uFF08\u5206\u5757+\u6DF7\u5408\u68C0\u7D22\uFF09\u2550\u2550\u2550\n");
  console.log("\u30100\u3011\u57FA\u7840\u5DE5\u5177\u68C0\u67E5");
  check("isExcludedPath \u7CBE\u786E\u5339\u914D", isExcludedPath("\u9644\u4EF6", ["\u9644\u4EF6"]) === true);
  check("isExcludedPath \u5B50\u8DEF\u5F84\u5339\u914D", isExcludedPath("\u9644\u4EF6/\u56FE\u7247/a.md", ["\u9644\u4EF6"]) === true);
  check("isExcludedPath \u975E\u6392\u9664", isExcludedPath("\u7B14\u8BB0/a.md", ["\u9644\u4EF6"]) === false);
  check("\u7EAF\u4EE3\u7801\u5757\u9884\u5904\u7406\u540E\u4E3A\u7A7A\uFF08\u8DF3\u8FC7\u7D22\u5F15\uFF09", preprocessText("```js\nconst x = 1;\n```", 4e3) === "");
  const mdText = preprocessText("# \u6807\u9898\n\n[\u94FE\u63A5](https://x.com) \u6B63\u6587**\u52A0\u7C97**", 4e3);
  check("Markdown \u9884\u5904\u7406\u53BB\u8BED\u6CD5", mdText.includes("\u94FE\u63A5") && mdText.includes("\u6B63\u6587") && mdText.includes("\u52A0\u7C97") && !mdText.includes("https://x.com"));
  check("\u54C8\u5E0C\u7A33\u5B9A\u6027", hashString("\u4F60\u597D\u4E16\u754C") === hashString("\u4F60\u597D\u4E16\u754C"));
  check("\u54C8\u5E0C\u533A\u5206\u5185\u5BB9", hashString("\u4F60\u597D\u4E16\u754C") !== hashString("\u4F60\u597D\u4E16\u754C\uFF01"));
  check("\u4F59\u5F26\uFF1A\u76F8\u540C\u5411\u91CF\u22481", Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);
  console.log("\n\u30101\u3011\u6D4B\u8BD5\u5E93");
  const { zh, outliers, en, stress } = readNotes();
  const accSet = [...zh, ...outliers, ...en];
  const all = [...accSet, ...stress];
  check("\u4E2D\u6587\u8BDD\u9898\u5E93 \u2265 30 \u7BC7", zh.length >= 30, `${zh.length} \u7BC7\uFF0812 \u8BDD\u9898 \xD7 6 \u7BC7\uFF09`);
  check("\u5305\u542B\u76F8\u4F3C\u4E0E\u4E0D\u76F8\u4F3C\u8BDD\u9898", new Set(zh.map((n) => n.topic)).size >= 8, `${new Set(zh.map((n) => n.topic)).size} \u4E2A\u8BDD\u9898`);
  check("\u538B\u6D4B\u5E93 \u2265 1000 \u7BC7", stress.length >= 1e3, `${stress.length} \u7BC7`);
  const totalChunks = all.reduce((s, n) => s + n.chunks.length, 0);
  info("\u5168\u5E93\u5206\u5757\u603B\u6570", `${totalChunks} \u5757\uFF08\u6BCF\u7BC7\u5E73\u5747 ${(totalChunks / all.length).toFixed(1)} \u5757\uFF09`);
  const settings = {
    ...DEFAULT_SETTINGS,
    embeddingProvider: "ollama",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "bge-m3",
    batchSize: 16,
    requestTimeoutSec: 120
  };
  const provider = new OllamaEmbeddingProvider(
    settings.ollamaBaseUrl,
    "bge-m3",
    16,
    120,
    3
  );
  console.log("\n\u30102\u3011\u51C6\u786E\u7387\u7D22\u5F15\uFF08bge-m3\uFF0C\u5206\u5757 v2\uFF09");
  const acc = await buildIndex(provider, accSet, "\u51C6\u786E\u7387\u96C6");
  const accIndex = acc.index;
  check("\u6D4B\u8BD5\u96C6\u7D22\u5F15\u5B8C\u6210", accIndex.docCount === accSet.length, `${accSet.length} \u7BC7 / ${accIndex.chunkCount} \u5757\uFF0C${(acc.ms / 1e3).toFixed(1)} \u79D2`);
  check("BM25 \u5C31\u7EEA", accIndex.bm25Ready);
  console.log("\n\u30103\u3011\u4E2D\u6587 top-5 \u547D\u4E2D\u7387\uFF08\u6587\u6863\u7EA7\uFF0C\u9A8C\u6536\u7EBF \u226570%\uFF09");
  let hit5Sum = 0;
  let coverage = 0;
  const perTopic = {};
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
  console.log(`  top-5 \u5E73\u5747\u547D\u4E2D\u7387\uFF1A${(hit5 * 100).toFixed(1)}%`);
  check("top-5 \u5E73\u5747\u547D\u4E2D\u7387 \u2265 70%", hit5 >= 0.7, `${(hit5 * 100).toFixed(1)}%`);
  check("\u547D\u4E2D\u8986\u76D6\u7387 \u2265 90%", cov >= 0.9, `${(cov * 100).toFixed(1)}%`);
  console.log("\n\u30103b\u3011\u6DF7\u5408\u68C0\u7D22\u547D\u4E2D\u7387\uFF08\u5411\u91CF+BM25+RRF\uFF0Ctop-5 \u540C\u8BDD\u9898\u5360\u6BD4 \u226570%\uFF09");
  let hySum = 0;
  for (const n of zh) {
    const q = n.text.slice(0, 200);
    const qvec = (await provider.embed([preprocessText(q, 500)]))[0];
    const results = accIndex.hybridSearch(qvec, q, 5, 0);
    const same = results.filter((r) => {
      const peer = zh.find((z) => z.path === r.path);
      return peer?.topic === n.topic;
    }).length;
    hySum += same / 5;
  }
  const hyHit = hySum / zh.length;
  check("\u6DF7\u5408\u68C0\u7D22 top-5 \u547D\u4E2D\u7387 \u2265 70%", hyHit >= 0.7, `${(hyHit * 100).toFixed(1)}%`);
  console.log("\n\u30104\u3011\u82F1\u6587\u7B14\u8BB0\u5173\u8054\u8D28\u91CF");
  let enHit = 0;
  for (const n of en) {
    const results = accIndex.similarTo(n.path, 5, 0.4);
    enHit += results.filter((r) => r.path.startsWith("\u82F1\u6587\u5E93/")).length / 5;
  }
  const enHit5 = enHit / en.length;
  check("\u82F1\u6587 top-5 \u5185\u82F1\u6587\u7B14\u8BB0\u5360\u6BD4 \u2265 70%", enHit5 >= 0.7, `${(enHit5 * 100).toFixed(1)}%`);
  console.log("\n\u30105\u3011\u5E72\u6270\u7B14\u8BB0\uFF08\u8DE8\u8BDD\u9898\uFF0C\u4E0D\u53C2\u4E0E\u547D\u4E2D\u7387\uFF09");
  for (const n of outliers) {
    const results = accIndex.similarTo(n.path, 5, 0.4);
    const top = results.slice(0, 3).map((r) => r.path.split("/")[1] ?? r.path).join("\u3001");
    console.log(`  ${n.path.split("/").pop()}: ${top}`);
  }
  check("\u5E72\u6270\u7B14\u8BB0\u6B63\u5E38\u8FD4\u56DE\u63A8\u8350", outliers.every((n) => accIndex.similarTo(n.path, 5, 0.4).length > 0));
  console.log("\n\u30106\u3011\u589E\u91CF\u66F4\u65B0\uFF08\u5757\u7EA7\uFF1A\u65B0\u589E/\u4FEE\u6539/\u5220\u9664\uFF09");
  const newPath = "\u4E2D\u6587\u8BDD\u9898\u5E93/\u5496\u5561\u6587\u5316\u4E0E\u624B\u51B2/\u589E\u91CF\u6D4B\u8BD5\u7B14\u8BB0.md";
  const newContent = "# \u589E\u91CF\u6D4B\u8BD5\u7B14\u8BB0\n\n\u4ECA\u5929\u8BD5\u4E86\u4E00\u6B3E\u65B0\u7684\u8036\u52A0\u96EA\u83F2\u8C46\u5B50\uFF0C\u624B\u51B2\u53C2\u6570\uFF1A\u7C89\u6C34\u6BD41\u6BD415\uFF0C\u6C34\u6E2990\u5EA6\uFF0C\u95F7\u84B830\u79D2\u3002\u51B2\u51FA\u6765\u7684\u5496\u5561\u98CE\u5473\u5F88\u5E72\u51C0\uFF0C\u6709\u82B1\u9999\u548C\u67D1\u6A58\u9178\uFF0C\u56DE\u7518\u660E\u663E\u3002\u7814\u78E8\u5EA6\u6BD4\u4E0A\u6B21\u8C03\u7EC6\u4E86\u4E00\u6863\uFF0C\u8403\u53D6\u65F6\u95F4\u521A\u597D2\u5206\u949F\u3002\n";
  fs.writeFileSync(path.join(VAULT, newPath), newContent);
  const newNote = readNotes().zh.find((n) => n.path === newPath);
  check("\u65B0\u7B14\u8BB0\u8BFB\u53D6\u6210\u529F", !!newNote && newNote.chunks.length >= 1);
  const before = accIndex.docCount;
  const nv = await provider.embed(newNote.chunks.map((c) => c.text));
  accIndex.upsertNote(
    newNote.path,
    newNote.hash,
    newNote.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: nv[j] }))
  );
  check("\u65B0\u589E\u7B14\u8BB0\u540E\u8BA1\u6570 +1", accIndex.docCount === before + 1, `${before} \u2192 ${accIndex.docCount}`);
  const coffeePeers = accIndex.similarTo("\u4E2D\u6587\u8BDD\u9898\u5E93/\u5496\u5561\u6587\u5316\u4E0E\u624B\u51B2/\u624B\u51B2\u5496\u5561\u5165\u95E8\u7B14\u8BB0.md", 5, 0.4);
  check("\u65B0\u7B14\u8BB0\u51FA\u73B0\u5728\u540C\u8BDD\u9898\u7B14\u8BB0\u7684 top-5", coffeePeers.some((r) => r.path === newPath));
  const modified = "# \u589E\u91CF\u6D4B\u8BD5\u7B14\u8BB0\uFF08\u5DF2\u4FEE\u6539\uFF09\n\n\u8FD9\u5468\u5F00\u59CB\u7528\u95F4\u6B47\u6027\u65AD\u98DF\u914D\u5408\u86CB\u767D\u8D28\u6444\u5165\uFF0C\u4F53\u91CD\u8BB0\u5F55\uFF1A\u5468\u4E0068.2\uFF0C\u5468\u4E9467.4\u3002\n";
  fs.writeFileSync(path.join(VAULT, newPath), modified);
  const modNote = readNotes().zh.find((n) => n.path === newPath);
  check("\u5185\u5BB9\u4FEE\u6539\u540E\u54C8\u5E0C\u53D8\u5316", modNote.hash !== newNote.hash);
  const mv = await provider.embed(modNote.chunks.map((c) => c.text));
  accIndex.upsertNote(
    modNote.path,
    modNote.hash,
    modNote.chunks.map((c, j) => ({ idx: c.idx, text: c.text, hash: c.hash, embedding: mv[j] }))
  );
  check("\u4FEE\u6539\u540E\u8BA1\u6570\u4E0D\u53D8", accIndex.docCount === before + 1);
  accIndex.remove(newPath);
  check("\u5220\u9664\u7B14\u8BB0\u540E\u8BA1\u6570 -1", accIndex.docCount === before, `${before + 1} \u2192 ${accIndex.docCount}`);
  check("\u5220\u9664\u540E\u4E0D\u518D\u51FA\u73B0\u5728\u63A8\u8350\u4E2D", !accIndex.similarTo("\u4E2D\u6587\u8BDD\u9898\u5E93/\u5496\u5561\u6587\u5316\u4E0E\u624B\u51B2/\u624B\u51B2\u5496\u5561\u5165\u95E8\u7B14\u8BB0.md", 5, 0.4).some((r) => r.path === newPath));
  fs.unlinkSync(path.join(VAULT, newPath));
  console.log("\n\u30107\u3011\u6301\u4E45\u5316\uFF08\u5E8F\u5217\u5316 \u2192 \u6062\u590D\uFF09");
  const json = accIndex.toJSON();
  const restored = SemanticIndex.fromJSON(embeddingSignature(settings), json);
  check("\u6062\u590D\u540E\u6587\u6863/\u5757\u4E00\u81F4", restored.docCount === accIndex.docCount && restored.chunkCount === accIndex.chunkCount, `${restored.docCount} \u7BC7 / ${restored.chunkCount} \u5757`);
  check("\u7B7E\u540D\u4E00\u81F4", restored.meta.signature === embeddingSignature(settings));
  check("\u6062\u590D\u540E BM25 \u91CD\u5EFA", restored.bm25Ready);
  const p1 = "\u4E2D\u6587\u8BDD\u9898\u5E93/\u5386\u53F2\u4EBA\u7269\u4E0E\u738B\u671D/\u5510\u592A\u5B97\u4E0E\u8D1E\u89C2\u4E4B\u6CBB.md";
  const a = accIndex.getEntry(p1);
  const b = restored.getEntry(p1);
  check("\u6062\u590D\u540E\u805A\u5408\u5411\u91CF\u4E00\u81F4", !!a && !!b && cosineSimilarity(a.embedding, b.embedding) > 0.9999);
  check("\u6062\u590D\u540E\u63A8\u8350\u4E00\u81F4", JSON.stringify(accIndex.similarTo(p1, 5, 0.4)) === JSON.stringify(restored.similarTo(p1, 5, 0.4)));
  const qv = (await provider.embed(["\u8D1E\u89C2\u4E4B\u6CBB \u5510\u592A\u5B97 \u6CBB\u56FD"]))[0];
  check("\u6062\u590D\u540E\u6DF7\u5408\u68C0\u7D22\u4E00\u81F4", JSON.stringify(accIndex.hybridSearch(qv, "\u8D1E\u89C2\u4E4B\u6CBB \u5510\u592A\u5B97 \u6CBB\u56FD", 5, 0)) === JSON.stringify(restored.hybridSearch(qv, "\u8D1E\u89C2\u4E4B\u6CBB \u5510\u592A\u5B97 \u6CBB\u56FD", 5, 0)));
  const corrupted = SemanticIndex.fromJSON(embeddingSignature(settings), { meta: { signature: "x", formatVersion: 1, updated: 0 }, docs: {}, chunks: {} });
  check("v1 \u6570\u636E\u5B89\u5168\u91CD\u5EFA", corrupted.docCount === 0);
  console.log("\n\u30108\u3011\u5168\u91CF\u7D22\u5F15\uFF081209 \u7BC7\uFF09\u4E0E\u538B\u6D4B");
  const full = await buildIndex(provider, all, "\u5168\u91CF");
  const fullIndex = full.index;
  check("\u5168\u91CF\u7D22\u5F15\u5B8C\u6210", fullIndex.docCount === all.length, `${all.length} \u7BC7 / ${fullIndex.chunkCount} \u5757\uFF0C${(full.ms / 1e3).toFixed(1)} \u79D2`);
  const stressPaths = fullIndex.paths.filter((p) => p.startsWith("\u538B\u6D4B\u5E93/"));
  check("\u538B\u6D4B\u5E93\u5168\u90E8\u5165\u7D22\u5F15", stressPaths.length === stress.length, `${stressPaths.length} \u7BC7`);
  const samplePaths = stressPaths.slice(0, 200);
  const times = [];
  for (const p of samplePaths) {
    const tq = performance.now();
    fullIndex.similarTo(p, 5, 0.4);
    times.push(performance.now() - tq);
  }
  times.sort((x, y) => x - y);
  const qAvg = times.reduce((s, t) => s + t, 0) / times.length;
  const qMax = times[times.length - 1];
  check("\u6587\u6863\u7EA7\u67E5\u8BE2\u5E73\u5747\u8017\u65F6 < 100ms", qAvg < 100, `\u5E73\u5747 ${qAvg.toFixed(2)}ms / \u6700\u5927 ${qMax.toFixed(2)}ms`);
  const hyTimes = [];
  const hyQ = (await provider.embed(["\u5496\u5561 \u624B\u51B2 \u53C2\u6570"]))[0];
  for (let i = 0; i < 30; i++) {
    const tq = performance.now();
    fullIndex.hybridSearch(hyQ, "\u5496\u5561 \u624B\u51B2 \u53C2\u6570", 5, 0);
    hyTimes.push(performance.now() - tq);
  }
  hyTimes.sort((x, y) => x - y);
  const hyAvg = hyTimes.reduce((s, t) => s + t, 0) / hyTimes.length;
  check("\u6DF7\u5408\u68C0\u7D22\u5E73\u5747\u8017\u65F6 < 200ms", hyAvg < 200, `\u5E73\u5747 ${hyAvg.toFixed(1)}ms / \u6700\u5927 ${hyTimes[hyTimes.length - 1].toFixed(1)}ms`);
  const fullJson = fullIndex.toJSON();
  const jsonSizeMB = Buffer.byteLength(JSON.stringify(fullJson)) / 1024 / 1024;
  check("\u7D22\u5F15 JSON \u4F53\u79EF\u53EF\u63A5\u53D7", jsonSizeMB < 100, `${jsonSizeMB.toFixed(1)}MB`);
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
  info("\u5168\u5E93\u6DF7\u5408\u68C0\u7D22\u547D\u4E2D\u7387\uFF08\u4FE1\u606F\u6027\uFF09", `${(mixedSum / zh.length * 100).toFixed(1)}%\uFF0Ctop-5 \u540D\u989D\u4E0E 1130 \u7BC7\u4ED6\u4E3B\u9898\u7B14\u8BB0\u7ADE\u4E89`);
  console.log("\n\u30109\u3011\u5D4C\u5165\u8BED\u4E49\u6B63\u786E\u6027\uFF08bge-m3\uFF09");
  const [va, vb, vc] = await provider.embed(["\u82F9\u679C\u9999\u8549\u6C34\u679C", "\u9999\u8549\u82F9\u679C\u6A59\u5B50", "\u91CF\u5B50\u7269\u7406\u4E0E\u76F8\u5BF9\u8BBA"]);
  const sameTopicSim = cosineSimilarity(va, vb);
  const diffTopicSim = cosineSimilarity(va, vc);
  check("\u540C\u4E3B\u9898\u6587\u672C\u76F8\u4F3C\u5EA6 > \u8DE8\u4E3B\u9898", sameTopicSim > diffTopicSim, `\u540C\u4E3B\u9898 ${sameTopicSim.toFixed(3)} vs \u8DE8\u4E3B\u9898 ${diffTopicSim.toFixed(3)}`);
  const [vx, vy] = await provider.embed(["\u4ECA\u5929\u5929\u6C14\u5F88\u597D\u9002\u5408\u51FA\u53BB\u8D70\u8D70", "\u4ECA\u5929\u5929\u6C14\u5F88\u597D\u9002\u5408\u51FA\u53BB\u8D70\u8D70"]);
  check("\u76F8\u540C\u6587\u672C\u4F59\u5F26 \u2248 1", cosineSimilarity(vx, vy) > 0.999, cosineSimilarity(vx, vy).toFixed(4));
  console.log(`
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  console.log(`\u901A\u8FC7 ${passed} \u9879\uFF0C\u5931\u8D25 ${failed} \u9879`);
  console.log(`\u6D4B\u8BD5\u96C6\u7D22\u5F15 ${(acc.ms / 1e3).toFixed(1)}s\uFF1B\u5168\u91CF ${(full.ms / 1e3).toFixed(1)}s`);
  console.log(`\u4E2D\u6587 top-5 ${(hit5 * 100).toFixed(1)}%\uFF1B\u6DF7\u5408\u68C0\u7D22 ${(hyHit * 100).toFixed(1)}%\uFF1B\u82F1\u6587 ${(enHit5 * 100).toFixed(1)}%`);
  console.log(`\u6587\u6863\u67E5\u8BE2 ${qAvg.toFixed(2)}ms\uFF1B\u6DF7\u5408\u68C0\u7D22 ${hyAvg.toFixed(1)}ms\uFF1B\u7D22\u5F15\u4F53\u79EF ${jsonSizeMB.toFixed(1)}MB`);
  console.log(`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("\u6D4B\u8BD5\u8FD0\u884C\u5F02\u5E38\uFF1A", e);
  process.exit(1);
});
