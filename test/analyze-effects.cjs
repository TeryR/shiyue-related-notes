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

// test/analyze-effects.ts
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

// src/indexer.ts
var FORMAT_VERSION = 1;
function createIndex(signature) {
  return {
    meta: { signature, formatVersion: FORMAT_VERSION, updated: Date.now() },
    notes: {}
  };
}
var SemanticIndex = class _SemanticIndex {
  constructor(signature, existing) {
    /** 内容哈希 → 路径，用于快速判断内容是否变化 */
    this.hashToPath = /* @__PURE__ */ new Map();
    /** 结果缓存：key = 路径 + 版本号 */
    this.cache = /* @__PURE__ */ new Map();
    this.version = 0;
    if (existing && existing.meta.formatVersion === FORMAT_VERSION) {
      this.data = existing;
    } else {
      this.data = createIndex(signature);
    }
    this.rebuildMaps();
  }
  rebuildMaps() {
    this.hashToPath.clear();
    this.cache.clear();
    for (const [path2, entry] of Object.entries(this.data.notes)) {
      this.hashToPath.set(entry.hash, path2);
    }
  }
  get meta() {
    return this.data.meta;
  }
  get count() {
    return Object.keys(this.data.notes).length;
  }
  get paths() {
    return Object.keys(this.data.notes);
  }
  has(path2) {
    return path2 in this.data.notes;
  }
  getEntry(path2) {
    return this.data.notes[path2];
  }
  /** 内容未变化（哈希相同）时返回 true */
  isUpToDate(path2, contentHash) {
    const e = this.data.notes[path2];
    return !!e && e.hash === contentHash;
  }
  /** 新增或更新一条笔记的向量 */
  upsert(path2, contentHash, embedding) {
    const existed = path2 in this.data.notes;
    this.data.notes[path2] = {
      hash: contentHash,
      updated: Date.now(),
      embedding
    };
    this.hashToPath.set(contentHash, path2);
    this.data.meta.updated = Date.now();
    this.bump();
    if (!existed) this.cleanupDuplicateHashes(path2);
  }
  /** 删除一条笔记 */
  remove(path2) {
    const e = this.data.notes[path2];
    if (e) {
      this.hashToPath.delete(e.hash);
    }
    delete this.data.notes[path2];
    this.data.meta.updated = Date.now();
    this.bump();
  }
  /** 清理指向同一哈希的旧条目（内容复制粘贴场景） */
  cleanupDuplicateHashes(path2) {
    const e = this.data.notes[path2];
    if (!e) return;
    for (const [p, entry] of Object.entries(this.data.notes)) {
      if (p !== path2 && entry.hash === e.hash) {
        this.remove(p);
      }
    }
  }
  bump() {
    this.version++;
    if (this.cache.size > 200) this.cache.clear();
  }
  /** 查询与 path 最相似的 k 条（不含自身），按分数降序 */
  similarTo(path2, k, minScore) {
    const cacheKey = `${path2}|${k}|${Math.round(minScore * 1e3)}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.version === this.version) return hit.results;
    const self = this.data.notes[path2];
    if (!self) return [];
    const out = [];
    for (const [p, entry] of Object.entries(this.data.notes)) {
      if (p === path2) continue;
      const score = cosineSimilarity(self.embedding, entry.embedding);
      if (score >= minScore) {
        out.push({ path: p, score });
      }
    }
    out.sort((a, b) => b.score - a.score);
    const results = out.slice(0, k);
    this.cache.set(cacheKey, { version: this.version, results });
    return results;
  }
  /** 用查询文本（先转成向量再比较）找最相似的笔记 */
  async similarToQuery(queryVector, k, minScore, excludePaths = /* @__PURE__ */ new Set()) {
    const out = [];
    for (const [p, entry] of Object.entries(this.data.notes)) {
      if (excludePaths.has(p)) continue;
      const score = cosineSimilarity(queryVector, entry.embedding);
      if (score >= minScore) {
        out.push({ path: p, score });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, k);
  }
  /** 序列化（用于持久化） */
  toJSON() {
    return this.data;
  }
  /** 从磁盘数据恢复 */
  static fromJSON(signature, json) {
    return new _SemanticIndex(signature, json ?? void 0);
  }
  /** 统计信息 */
  stats() {
    return {
      total: this.count,
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
  constructor(baseUrl, model, batchSize, timeoutSec) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.batchSize = batchSize;
    this.timeoutSec = timeoutSec;
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
      this.timeoutSec
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
          this.timeoutSec
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
  provider: "openai",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiApiKey: "",
  embeddingModel: "text-embedding-3-small",
  chatModel: "gpt-4o-mini",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "bge-m3",
  ollamaChatModel: "qwen2.5:7b",
  maxResults: 5,
  minSimilarity: 0.4,
  excludedFolders: [],
  autoIndex: true,
  embedMaxChars: 4e3,
  batchSize: 32,
  requestTimeoutSec: 60,
  chatMaxContextNotes: 5
};
function embeddingSignature(s) {
  if (s.provider === "ollama") {
    return `ollama|${s.ollamaBaseUrl}|${s.ollamaModel}`;
  }
  return `openai|${s.openaiBaseUrl}|${s.embeddingModel}`;
}

// test/analyze-effects.ts
var VAULT = path.join(__dirname, "vault");
var ZH_ROOT = path.join(VAULT, "\u4E2D\u6587\u8BDD\u9898\u5E93");
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
function collect() {
  const out = [];
  for (const topicDir of fs.readdirSync(ZH_ROOT, { withFileTypes: true })) {
    if (!topicDir.isDirectory()) continue;
    for (const f of walkMd(path.join(ZH_ROOT, topicDir.name))) {
      const raw = fs.readFileSync(f.file, "utf8");
      const text = preprocessText(raw, 4e3);
      out.push({
        path: `\u4E2D\u6587\u8BDD\u9898\u5E93/${topicDir.name}/${f.rel}`,
        topic: topicDir.name,
        text,
        hash: hashString(text)
      });
    }
  }
  const enRoot = path.join(VAULT, "\u82F1\u6587\u5E93");
  for (const f of walkMd(enRoot)) {
    const raw = fs.readFileSync(f.file, "utf8");
    const text = preprocessText(raw, 4e3);
    out.push({ path: `\u82F1\u6587\u5E93/${f.rel}`, topic: "\u82F1\u6587", text, hash: hashString(text) });
  }
  return out;
}
function fmt(x) {
  return x.toFixed(3);
}
async function main() {
  console.log("\u2550\u2550\u2550 \u6548\u679C\u6DF1\u5EA6\u5206\u6790\uFF08bge-m3 \u771F\u5B9E\u5D4C\u5165\uFF09\u2550\u2550\u2550\n");
  const notes = collect();
  const zh = notes.filter((n) => n.topic && n.topic !== "\u82F1\u6587" && n.topic !== "\u5E72\u6270\u7B14\u8BB0");
  const sig = embeddingSignature({
    ...DEFAULT_SETTINGS,
    provider: "ollama",
    ollamaModel: "bge-m3"
  });
  const provider = new OllamaEmbeddingProvider("http://127.0.0.1:11434", "bge-m3", 16, 120);
  const index = SemanticIndex.fromJSON(sig, null);
  const t0 = Date.now();
  for (let i = 0; i < notes.length; i += 16) {
    const chunk = notes.slice(i, i + 16);
    const vecs = await provider.embed(chunk.map((n) => n.text));
    for (let j = 0; j < chunk.length; j++) index.upsert(chunk[j].path, chunk[j].hash, vecs[j]);
    process.stdout.write(`\r  \u5D4C\u5165 ${Math.min(i + 16, notes.length)}/${notes.length}`);
  }
  process.stdout.write(`
  \u5D4C\u5165\u8017\u65F6\uFF1A${((Date.now() - t0) / 1e3).toFixed(1)} \u79D2

`);
  console.log("\u3010A\u3011\u5411\u91CF\u5316\u533A\u5206\u5EA6\uFF08\u4F59\u5F26\u76F8\u4F3C\u5EA6\u5206\u5E03\uFF09");
  const samePairs = [];
  const crossPairs = [];
  for (const a of zh) {
    for (const b of zh) {
      if (a.path >= b.path || a.topic !== b.topic) continue;
      samePairs.push(cosineSimilarity(index.getEntry(a.path).embedding, index.getEntry(b.path).embedding));
    }
  }
  for (let i = 0; i < 600; i++) {
    const a = zh[Math.floor(Math.random() * zh.length)];
    let b = zh[Math.floor(Math.random() * zh.length)];
    let guard = 0;
    while (b.topic === a.topic && guard++ < 20) b = zh[Math.floor(Math.random() * zh.length)];
    if (a.topic !== b.topic) {
      crossPairs.push(cosineSimilarity(index.getEntry(a.path).embedding, index.getEntry(b.path).embedding));
    }
  }
  const stats = (arr) => {
    const sorted = [...arr].sort((x, y) => x - y);
    return {
      min: sorted[0],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      med: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      max: sorted[sorted.length - 1],
      mean: arr.reduce((s, x) => s + x, 0) / arr.length
    };
  };
  const ss = stats(samePairs);
  const cs = stats(crossPairs);
  console.log(`  \u540C\u8BDD\u9898\u5BF9\uFF08n=${samePairs.length}\uFF09\uFF1A\u5747\u503C ${fmt(ss.mean)}\uFF0C\u4E2D\u4F4D ${fmt(ss.med)}\uFF0Cp25 ${fmt(ss.p25)}\uFF0Cp75 ${fmt(ss.p75)}\uFF0C\u8303\u56F4 ${fmt(ss.min)}~${fmt(ss.max)}`);
  console.log(`  \u8DE8\u8BDD\u9898\u5BF9\uFF08n=${crossPairs.length}\uFF09\uFF1A\u5747\u503C ${fmt(cs.mean)}\uFF0C\u4E2D\u4F4D ${fmt(cs.med)}\uFF0Cp25 ${fmt(cs.p25)}\uFF0Cp75 ${fmt(cs.p75)}\uFF0C\u8303\u56F4 ${fmt(cs.min)}~${fmt(cs.max)}`);
  const overlap = samePairs.filter((x) => x < cs.med).length / samePairs.length;
  console.log(`  \u533A\u5206\u5EA6\uFF1A\u540C\u8BDD\u9898\u5747\u503C\u9AD8\u4E8E\u8DE8\u8BDD\u9898 ${fmt(ss.mean - cs.mean)}\uFF1B\u540C\u8BDD\u9898\u5BF9\u4E2D\u5206\u6570\u4F4E\u4E8E\u8DE8\u8BDD\u9898\u4E2D\u4F4D\u6570\u7684\u5360\u6BD4 ${(overlap * 100).toFixed(1)}%`);
  console.log("");
  const top1s = [];
  const top5mins = [];
  for (const n of zh) {
    const r = index.similarTo(n.path, 5, 0);
    if (r.length > 0) top1s.push(r[0].score);
    top5mins.push(r.length > 0 ? r[Math.min(r.length, 5) - 1].score : 0);
  }
  top1s.sort((a, b) => a - b);
  top5mins.sort((a, b) => a - b);
  const med = (a) => a[Math.floor(a.length / 2)];
  console.log(`  top-1 \u5206\u6570\uFF1A\u4E2D\u4F4D ${fmt(med(top1s))}\uFF0Cp25 ${fmt(top1s[Math.floor(top1s.length * 0.25)])}\uFF0C\u6700\u4F4E ${fmt(top1s[0])}`);
  console.log(`  top-5 \u7B2C 5 \u540D\u5206\u6570\uFF1A\u4E2D\u4F4D ${fmt(med(top5mins))}\uFF0Cp25 ${fmt(top5mins[Math.floor(top5mins.length * 0.25)])}\uFF0C\u6700\u4F4E ${fmt(top5mins[0])}`);
  console.log("");
  console.log("\u3010B\u3011\u9608\u503C\u654F\u611F\u6027\uFF08minSimilarity \u5BF9 top-5 \u547D\u4E2D\u7387\u7684\u5F71\u54CD\uFF09");
  for (const t of [0.2, 0.3, 0.4, 0.5, 0.6]) {
    let hit = 0;
    let empty = 0;
    for (const n of zh) {
      const r = index.similarTo(n.path, 5, t);
      const same = r.filter((x) => {
        const peer = zh.find((z) => z.path === x.path);
        return peer?.topic === n.topic;
      }).length;
      hit += same / 5;
      if (r.length === 0) empty++;
    }
    console.log(`  \u9608\u503C ${t}\uFF1A\u547D\u4E2D\u7387 ${(hit / zh.length * 100).toFixed(1)}%\uFF0C\u65E0\u7ED3\u679C\u7B14\u8BB0 ${empty} \u7BC7`);
  }
  console.log("");
  console.log("\u3010C\u3011\u7D22\u5F15\u8FD0\u884C\u6548\u7387");
  const restored = SemanticIndex.fromJSON(sig, index.toJSON());
  let upToDate = 0;
  for (const n of notes) if (restored.isUpToDate(n.path, n.hash)) upToDate++;
  console.log(`  \u91CD\u542F\u590D\u7528\u7387\uFF1A${upToDate}/${notes.length} = ${(upToDate / notes.length * 100).toFixed(1)}%\uFF08\u65E0\u9700\u91CD\u65B0\u5D4C\u5165\uFF0C\u76F4\u63A5\u547D\u4E2D\u7F13\u5B58\uFF09`);
  const modNote = zh[0];
  const changedHash = hashString(modNote.text + "\u3010\u4FEE\u6539\u3011");
  let needReembed = 0;
  for (const n of notes) if (!restored.isUpToDate(n.path, n.hash)) needReembed++;
  console.log(`  \u589E\u91CF\u573A\u666F\uFF081 \u7BC7\u4FEE\u6539\uFF09\uFF1A89 \u7BC7\u7B14\u8BB0\u4E2D\u9700\u91CD\u65B0\u5D4C\u5165 ${needReembed} \u7BC7\uFF0C\u8DF3\u8FC7\u7387 ${((notes.length - needReembed) / notes.length * 100).toFixed(1)}%`);
  console.log(`  \u4FEE\u6539\u7684\u7B14\u8BB0\uFF08${modNote.path.split("/").pop()}\uFF09\uFF1Ahash \u53D8\u5316 \u2192 \u5224\u5B9A\u4E3A\u9700\u91CD\u65B0\u5D4C\u5165\uFF1A${!restored.isUpToDate(modNote.path, changedHash)}`);
  const jsonSize = Buffer.byteLength(JSON.stringify(index.toJSON())) / 1024;
  console.log(`  \u5411\u91CF\u5B58\u50A8\uFF1A${notes.length} \u7BC7 \xD7 ${index.getEntry(notes[0].path).embedding.length} \u7EF4 = ${jsonSize.toFixed(0)} KB\uFF08JSON\uFF09\uFF0C\u672C\u5730\u8BFB\u5199\u77AC\u65F6\u5B8C\u6210`);
  console.log("");
  console.log("\u3010D\u3011\u771F\u5B9E\u63A8\u8350\u62BD\u67E5\uFF083 \u7BC7\u7B14\u8BB0\u7684 top-3\uFF09");
  const samples = [
    "\u4E2D\u6587\u8BDD\u9898\u5E93/\u5496\u5561\u6587\u5316\u4E0E\u624B\u51B2/\u624B\u51B2\u5496\u5561\u5165\u95E8\u7B14\u8BB0.md",
    "\u4E2D\u6587\u8BDD\u9898\u5E93/\u5386\u53F2\u4EBA\u7269\u4E0E\u738B\u671D/\u5510\u592A\u5B97\u4E0E\u8D1E\u89C2\u4E4B\u6CBB.md",
    "\u4E2D\u6587\u8BDD\u9898\u5E93/\u7F16\u7A0B\u4E0E\u8F6F\u4EF6\u5F00\u53D1/TypeScript \u7C7B\u578B\u7CFB\u7EDF\u7B14\u8BB0.md"
  ];
  for (const p of samples) {
    const r = index.similarTo(p, 3, 0.3);
    console.log(`  ${p.split("/").pop()}:`);
    for (const x of r) {
      console.log(`    ${(x.score * 100).toFixed(0)}%  ${x.path}`);
    }
  }
  console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
}
main().catch((e) => {
  console.error("\u5206\u6790\u5F02\u5E38\uFF1A", e);
  process.exit(1);
});
