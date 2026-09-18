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

// src/bm25.ts
function tokenize(text) {
  const out = [];
  const cn = text.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const seg of cn) {
    if (seg.length === 1) {
      out.push(seg);
      continue;
    }
    for (let i = 0; i < seg.length - 1; i++) {
      out.push(seg.slice(i, i + 2));
    }
  }
  const en = text.match(/[a-zA-Z0-9_]+/g) ?? [];
  for (const w of en) out.push(w.toLowerCase());
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
   * 混合检索：向量块级 top-K + BM25 块级 top-K → RRF 融合 → 笔记级排序
   */
  hybridSearch(queryVector, queryText, k, minRrf = 0, vectorTopK = 50, bm25TopK = 50) {
    const RRF_K = 60;
    const vecRanks = [];
    for (const [key, c] of Object.entries(this.data.chunks)) {
      const s = cosineSimilarity(queryVector, c.embedding);
      if (s > 0) vecRanks.push({ key, cosine: s });
    }
    vecRanks.sort((a, b) => b.cosine - a.cosine);
    const vecTop = vecRanks.slice(0, vectorTopK);
    const bm25Top = this.bm25.search(queryText, bm25TopK);
    const noteAgg = /* @__PURE__ */ new Map();
    const addHit = (key, rank, cosine, bm25Score) => {
      const hashIdx = key.lastIndexOf("#");
      const path = key.slice(0, hashIdx);
      const idx = parseInt(key.slice(hashIdx + 1), 10);
      const chunk = this.data.chunks[key];
      if (!chunk) return;
      const rrf = 1 / (RRF_K + rank);
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
    vecTop.forEach((v, i) => addHit(v.key, i + 1, v.cosine, 0));
    bm25Top.forEach((b, i) => addHit(b.chunkKey, i + 1, 0, b.score));
    const maxRrf = 2 / (RRF_K + 1);
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

// test/unit-test.ts
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
console.log("\u30101\u3011\u5206\u5757\u5668");
{
  const short = "\u8FD9\u662F\u4E00\u7BC7\u5F88\u77ED\u7684\u7B14\u8BB0\u3002";
  check("\u77ED\u6587\u672C \u2192 1 \u5757", chunkText(short, 800, 100).length === 1);
  check("\u7A7A\u6587\u672C \u2192 0 \u5757", chunkText("   ", 800, 100).length === 0);
  const long = Array.from({ length: 30 }, (_, i) => `\u7B2C${i + 1}\u6BB5\uFF1A\u8FD9\u91CC\u8BA8\u8BBA\u5065\u5EB7\u996E\u98DF\u4E0E\u86CB\u767D\u8D28\u6444\u5165\u7684\u5173\u7CFB\uFF0C\u4EE5\u53CA\u8FD0\u52A8\u8BAD\u7EC3\u5BF9\u808C\u8089\u6062\u590D\u7684\u5F71\u54CD\u3002`).join("\n\n");
  const chunks = chunkText(long, 300, 50);
  check("\u957F\u6587\u672C\u5207\u51FA\u591A\u5757", chunks.length >= 4, `${chunks.length} \u5757`);
  check("\u6BCF\u5757\u4E0D\u8D85\u8FC7\u76EE\u6807+\u91CD\u53E0", chunks.every((c) => c.text.length <= 300 + 50), `\u6700\u957F ${Math.max(...chunks.map((c) => c.text.length))}`);
  check("\u76F8\u90BB\u5757\u6709\u91CD\u53E0", chunks.length > 1 && chunks[1].text.startsWith(chunks[0].text.slice(-50)), "\u91CD\u53E0\u751F\u6548");
  check("\u5185\u5BB9\u5B8C\u6574\u8986\u76D6\uFF08\u9996\u5757\u542B\u5F00\u5934/\u672B\u5757\u542B\u7ED3\u5C3E\uFF09", chunks[0].text.includes("\u7B2C1\u6BB5") && chunks[chunks.length - 1].text.includes("\u7B2C30\u6BB5"));
  const longSentence = "\u8FD9\u662F\u4E00\u53E5\u975E\u5E38\u975E\u5E38\u957F\u7684\u53E5\u5B50\uFF0C\u6CA1\u6709\u6362\u884C\uFF0C\u4E00\u76F4\u6301\u7EED\u4E0D\u65AD\u5730\u8BF4\u4E0B\u53BB\uFF0C\u8C08\u8BBA\u5F88\u591A\u5185\u5BB9\uFF0C\u5305\u62EC\u5065\u5EB7\u996E\u98DF\u3001\u8FD0\u52A8\u8BAD\u7EC3\u3001\u5FC3\u7406\u8C03\u8282\u3001\u65C5\u884C\u6444\u5F71\u7B49\u7B49\u8BDD\u9898\uFF0C\u957F\u5EA6\u8D85\u8FC7\u5355\u5757\u9650\u5236\uFF0C\u9700\u8981\u6309\u6807\u70B9\u5207\u5206\u6210\u591A\u4E2A\u53E5\u5B50\u5757\u3002".repeat(8);
  const sc = chunkText(longSentence, 200, 50);
  check("\u8D85\u957F\u6BB5\u843D\u6309\u53E5\u8FB9\u754C\u5207\u5206", sc.length >= 3, `${sc.length} \u5757`);
}
console.log("\n\u30102\u3011BM25");
{
  const idx = new BM25Index();
  idx.addChunk("\u5496\u5561#0", "\u624B\u51B2\u5496\u5561\u7684\u53C2\u6570\uFF1A\u7C89\u6C34\u6BD41\u6BD415\uFF0C\u6C34\u6E2990\u5EA6\uFF0C\u95F7\u84B830\u79D2\u3002\u5496\u5561\u8C46\u70D8\u7119\u5EA6\u5F71\u54CD\u98CE\u5473\u3002");
  idx.addChunk("\u5065\u8EAB#0", "\u6DF1\u8E72\u8BAD\u7EC3\u8981\u70B9\uFF1A\u819D\u76D6\u4E0E\u811A\u5C16\u65B9\u5411\u4E00\u81F4\uFF0C\u6838\u5FC3\u6536\u7D27\u3002\u5065\u8EAB\u529B\u91CF\u8BAD\u7EC3\u8BB0\u5F55\u3002");
  idx.addChunk("\u5496\u5561#1", "\u610F\u5F0F\u6D53\u7F29\u8403\u53D6\uFF1A18\u514B\u7C89\u51FA36\u514B\u6DB2\uFF0C\u5976\u6CE1\u8981\u7EF5\u5BC6\u3002\u62FF\u94C1\u5496\u5561\u5236\u4F5C\u3002");
  check("\u4E2D\u6587\u67E5\u8BE2\u547D\u4E2D\u5496\u5561\u5757", idx.search("\u5496\u5561 \u624B\u51B2", 5).some((h) => h.chunkKey.startsWith("\u5496\u5561")), `top=${idx.search("\u5496\u5561 \u624B\u51B2", 5).map((h) => h.chunkKey).join(",")}`);
  check("\u4E0D\u76F8\u5173\u67E5\u8BE2\u4E0D\u547D\u4E2D", idx.search("\u91CF\u5B50\u7269\u7406\u76F8\u5BF9\u8BBA", 5).length === 0);
  idx.removeChunk("\u5496\u5561#1");
  check("\u5220\u9664\u5757\u540E\u4E0D\u518D\u547D\u4E2D", !idx.search("\u62FF\u94C1 \u5496\u5561", 5).some((h) => h.chunkKey === "\u5496\u5561#1"));
  check("tokenize \u4E2D\u6587 bigram", tokenize("\u5496\u5561\u70D8\u7119").includes("\u5496\u5561") && tokenize("\u5496\u5561\u70D8\u7119").includes("\u70D8\u7119"));
  check("tokenize \u82F1\u6587\u5C0F\u5199", tokenize("Hello World").includes("hello"));
}
console.log("\n\u30103\u3011\u7D22\u5F15 v2\uFF08\u5757\u7EA7 + \u805A\u5408 + \u6DF7\u5408\u68C0\u7D22\uFF09");
{
  const idx = new SemanticIndex("test|sig");
  const chunksOf = (text) => {
    const cs = chunkText(text, 300, 50);
    return cs.map((c) => ({ idx: c.index, text: c.text, hash: hashString(c.text), embedding: pseudoVec(c.text) }));
  };
  const noteA = Array.from({ length: 8 }, (_, i) => `\u5496\u5561\u6BB5\u843D${i}\uFF1A\u624B\u51B2\u53C2\u6570\u3001\u7C89\u6C34\u6BD4\u3001\u6C34\u6E29\u3001\u95F7\u84B8\u65F6\u95F4\u3001\u7814\u78E8\u5EA6\u3002`).join("\n\n");
  const noteB = "\u5065\u8EAB\u8BAD\u7EC3\uFF1A\u6DF1\u8E72\u3001\u786C\u62C9\u3001\u6709\u6C27\u3001\u5FC3\u7387\u3001\u62C9\u4F38\u6062\u590D\u3002";
  const noteC = "\u8BFB\u4E66\u7B14\u8BB0\uFF1A\u8BA4\u77E5\u5FC3\u7406\u5B66\u3001\u60C5\u7EEA\u7BA1\u7406\u3001\u6B63\u5FF5\u51A5\u60F3\u3002";
  const chunks = chunksOf(noteA);
  idx.upsertNote("\u5496\u5561.md", hashString(noteA), chunks);
  idx.upsertNote("\u5065\u8EAB.md", hashString(noteB), chunksOf(noteB));
  idx.upsertNote("\u5FC3\u7406.md", hashString(noteC), chunksOf(noteC));
  check("\u6587\u6863\u8BA1\u6570 3", idx.docCount === 3, `${idx.docCount}`);
  check("\u5757\u8BA1\u6570\u6B63\u786E\uFF08\u8D2A\u5FC3\u5408\u5E76\uFF09", idx.chunkCount >= 2 && idx.chunkCount <= 4, `${idx.chunkCount} \u5757`);
  check("BM25 \u5C31\u7EEA", idx.bm25Ready);
  check("\u6587\u6863\u805A\u5408\u5411\u91CF\u5B58\u5728", idx.getEntry("\u5496\u5561.md")?.embedding.length === 64);
  const noteA2 = Array.from({ length: 8 }, (_, i) => `\u5496\u5561\u6BB5\u843D${i}\uFF1A\u624B\u51B2\u53C2\u6570\u3001\u7C89\u6C34\u6BD4\u3001\u6C34\u6E29\u3001\u95F7\u84B8\u65F6\u95F4\u3001\u7814\u78E8\u5EA6\u3002`).join("\n\n") + "\n\n" + "\u5173\u4E8E\u62C9\u82B1\u7684\u65B0\u7B14\u8BB0\u5185\u5BB9\uFF1A".repeat(28) + "\u3002";
  const chunks2 = chunksOf(noteA2);
  check("\u65B0\u589E\u5185\u5BB9\u5757\u6570\u589E\u52A0", chunks2.length > chunks.length, `${chunks.length} \u2192 ${chunks2.length}`);
  const beforeChunks = idx.chunkCount;
  idx.upsertNote("\u5496\u5561.md", hashString(noteA2), chunks2);
  check("\u65B0\u589E\u5757\u540E\u5757\u6570\u6B63\u786E", idx.chunkCount === beforeChunks + (chunks2.length - chunks.length), `${beforeChunks} \u2192 ${idx.chunkCount}`);
  check("\u6587\u6863\u805A\u5408\u5411\u91CF\u5DF2\u66F4\u65B0", idx.getEntry("\u5496\u5561.md")?.chunkCount === chunks2.length);
  check("\u672A\u53D8\u5316\u7B14\u8BB0\u8DF3\u8FC7", idx.isUpToDate("\u5065\u8EAB.md", hashString(noteB)));
  const q = "\u624B\u51B2\u5496\u5561\u7C89\u6C34\u6BD4\u548C\u6C34\u6E29\u53C2\u6570";
  const qvec = pseudoVec(q);
  const hybrid = idx.hybridSearch(qvec, q, 3, 0);
  check("\u6DF7\u5408\u68C0\u7D22\u547D\u4E2D\u5496\u5561\u7B14\u8BB0", hybrid.length > 0 && hybrid[0].path === "\u5496\u5561.md", hybrid.map((h) => `${h.path}(${h.score.toFixed(2)})`).join(","));
  check("\u547D\u4E2D\u5757\u5E26\u6587\u672C", hybrid[0].chunkHits.length > 0 && hybrid[0].chunkHits[0].text.includes("\u5496\u5561"), `\u5757${hybrid[0].chunkHits[0]?.idx}`);
  const bm25Only = idx.hybridSearch(new Array(64).fill(0.01), "\u7C89\u6C34\u6BD4 \u95F7\u84B8 \u7814\u78E8\u5EA6", 3, 0);
  check("\u5173\u952E\u8BCD\u8DEF\u72EC\u7ACB\u547D\u4E2D\uFF08BM25\uFF09", bm25Only.some((h) => h.path === "\u5496\u5561.md"), bm25Only.map((h) => h.path).join(","));
  const psychChunks = chunksOf(noteC).length;
  idx.remove("\u5FC3\u7406.md");
  const expectedAfterDelete = beforeChunks + (chunks2.length - chunks.length) - psychChunks;
  check("\u5220\u9664\u540E\u8BA1\u6570", idx.docCount === 2 && idx.chunkCount === expectedAfterDelete, `${idx.docCount} \u7BC7 / ${idx.chunkCount} \u5757\uFF08\u671F\u671B ${expectedAfterDelete}\uFF09`);
  check("\u5220\u9664\u540E BM25 \u6E05\u7406", !idx.hybridSearch(new Array(64).fill(0.01), "\u6B63\u5FF5\u51A5\u60F3", 5, 0).some((h) => h.path === "\u5FC3\u7406.md"));
  const json = idx.toJSON();
  const restored = SemanticIndex.fromJSON("test|sig", json);
  check("\u6062\u590D\u540E\u6587\u6863/\u5757\u4E00\u81F4", restored.docCount === idx.docCount && restored.chunkCount === idx.chunkCount);
  check("\u6062\u590D\u540E BM25 \u91CD\u5EFA", restored.bm25Ready);
  check("\u6062\u590D\u540E\u6DF7\u5408\u68C0\u7D22\u4E00\u81F4", JSON.stringify(restored.hybridSearch(qvec, q, 3, 0)) === JSON.stringify(idx.hybridSearch(qvec, q, 3, 0)));
  const old = SemanticIndex.fromJSON("test|sig", { meta: { signature: "x", formatVersion: 1, updated: 0 }, docs: {}, chunks: {} });
  check("v1 \u6570\u636E\u5B89\u5168\u91CD\u5EFA", old.docCount === 0 && old.chunkCount === 0);
}
console.log(`
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
console.log(`\u901A\u8FC7 ${passed} \u9879\uFF0C\u5931\u8D25 ${failed} \u9879`);
console.log(`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
process.exit(failed === 0 ? 0 : 1);
