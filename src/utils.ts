/**
 * 工具函数（纯逻辑，不依赖 Obsidian）
 */

/** 稳定字符串哈希（cyrb53 变体，返回 16 位十六进制） */
export function hashString(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0")
  );
}

/** 余弦相似度（两个等长数值向量） */
export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
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

/** 对文本做嵌入前预处理：去掉 Markdown 语法，保留正文 */
export function preprocessText(raw: string, maxChars: number): string {
  let t = raw
    // 去掉代码块
    .replace(/```[\s\S]*?```/g, " ")
    // 去掉行内代码
    .replace(/`[^`]*`/g, " ")
    // 去掉图片
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // 去掉链接，保留链接文字
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // 去掉 wiki 链接的别名部分
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    // 去掉标题符号、引用、列表符号、分隔线、表格符号
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.、]\s+/gm, "")
    .replace(/^---+\s*$/gm, " ")
    .replace(/\|/g, " ")
    // 去掉 HTML 标签
    .replace(/<[^>]+>/g, " ")
    // 合并空白
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > maxChars) {
    t = t.slice(0, maxChars);
  }
  return t;
}

/** 延迟执行（毫秒） */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 简易防抖 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
}

/** 判断路径是否位于排除文件夹内；隐藏目录（.trash/.obsidian 等以 . 开头的段）永不参与索引 */
export function isExcludedPath(path: string, excludedFolders: string[]): boolean {
  for (const folder of excludedFolders) {
    if (folder && (path === folder || path.startsWith(folder + "/"))) {
      return true;
    }
  }
  // 回收站（.trash）、配置目录（.obsidian）等隐藏目录中的 md 不参与索引
  return path.split("/").some((seg) => seg.startsWith("."));
}
