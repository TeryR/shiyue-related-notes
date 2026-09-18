/**
 * BM25 关键词检索（纯逻辑，可单测）
 * - 中文：连续中文片段按字符 bigram 切分（无词典的中文检索标准做法）
 * - 英文/数字：小写单词
 * - 停用词过滤：高频虚词与模板词不参与索引与查询（提升精确度）
 * - 块级索引：每块为一条文档，查询按块评分，聚合到笔记取块最高分
 */

/** 停用词（高频虚词 + 模板词），索引与查询两端一致过滤 */
const STOPWORDS = new Set([
  "的", "了", "是", "在", "和", "有", "与", "就", "都", "而", "及", "也", "这", "那", "一", "不",
  "很", "会", "要", "对", "为", "从", "到", "我们", "他们", "这个", "那个", "一个", "一些", "可以",
  "需要", "应该", "比较", "还有", "然后", "但是", "因为", "所以", "如果", "虽然", "关于", "对于",
  "目前", "最近", "现在", "进行", "开始", "继续", "保持", "使用", "记录", "实践", "整理", "内容",
  "情况", "结果", "方面", "部分", "问题", "方法", "主要", "重要", "相对", "整体", "以及", "并且",
  "或者", "还是", "没有", "什么", "怎么", "怎样", "如何", "为什么", "时候", "地方", "东西", "事情",
  "大家", "自己", "咱们", "中", "上", "下", "里", "后", "前", "等", "等等", "之", "其", "或",
  "又", "再", "便", "曾", "被", "把", "让", "使", "每", "各", "某", "第", "月", "年", "日",
  "自动", "一下", "不了", "起来", "出来", "过来", "这个", "那个",
  "与", "及", "且", "若", "则", "即", "既", "虽", "亦", "勿", "毋", "矣", "焉", "乎", "哉",
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "was", "were",
  "be", "with", "at", "by", "it", "this", "that", "as", "from", "not", "can", "will", "have",
  "has", "had", "do", "does", "did", "but", "so", "if", "then", "than", "about", "into",
]);

/** 是否为停用词项（供标签提取等场景复用同一份过滤） */
export function isStopTerm(t: string): boolean {
  return STOPWORDS.has(t);
}

export function tokenize(text: string, filterStopwords = true): string[] {
  const out: string[] = [];
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

export interface BM25Hit {
  /** 块 key：`${notePath}#${chunkIdx}` */
  chunkKey: string;
  score: number;
}

export class BM25Index {
  private df = new Map<string, number>(); // term → 含该词的块数
  private tf = new Map<string, Map<string, number>>(); // term → chunkKey → 词频
  private len = new Map<string, number>(); // chunkKey → 词项总数
  private n = 0; // 块总数
  private avgLen = 0;

  constructor(
    private k1 = 1.5,
    private b = 0.75
  ) {}

  /** 添加或替换一个块 */
  addChunk(chunkKey: string, text: string): void {
    this.removeChunk(chunkKey); // 先删旧（幂等）
    const terms = tokenize(text);
    if (terms.length === 0) return;
    const tfMap = new Map<string, number>();
    for (const t of terms) tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    for (const [t, f] of tfMap) {
      if (!this.tf.has(t)) this.tf.set(t, new Map());
      this.tf.get(t)!.set(chunkKey, f);
      this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.len.set(chunkKey, terms.length);
    this.n++;
    this.avgLen = (this.avgLen * (this.n - 1) + terms.length) / this.n;
  }

  /** 删除一个块 */
  removeChunk(chunkKey: string): void {
    const oldLen = this.len.get(chunkKey);
    if (oldLen === undefined) return;
    for (const [t, m] of this.tf) {
      if (m.delete(chunkKey)) {
        this.df.set(t, this.df.get(t)! - 1);
        if (this.df.get(t)! <= 0) {
          this.df.delete(t);
          this.tf.delete(t);
        }
      }
    }
    this.len.delete(chunkKey);
    this.n--;
    if (this.n > 0) {
      this.avgLen = (this.avgLen * (this.n + 1) - oldLen) / this.n;
    } else {
      this.avgLen = 0;
    }
  }

  /** 删除某笔记的全部块 */
  removeDoc(notePath: string): void {
    for (const key of [...this.len.keys()]) {
      if (key.startsWith(notePath + "#")) this.removeChunk(key);
    }
  }

  /** 查询：返回块级 topK */
  search(query: string, topK = 50): BM25Hit[] {
    const terms = tokenize(query);
    if (terms.length === 0) return [];
    const scores = new Map<string, number>();
    const queryTf = new Map<string, number>();
    for (const t of terms) queryTf.set(t, (queryTf.get(t) ?? 0) + 1);

    const idf = (term: string): number => {
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
        const s = idfVal * ((tfVal * (this.k1 + 1)) / denom) * (1 + Math.log(1 + qf));
        scores.set(key, (scores.get(key) ?? 0) + s);
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([chunkKey, score]) => ({ chunkKey, score }));
  }

  get size(): number {
    return this.n;
  }

  /** 词项的文档频率（含该词的块数）；不存在返回 0 */
  dfOf(term: string): number {
    return this.df.get(term) ?? 0;
  }
}
