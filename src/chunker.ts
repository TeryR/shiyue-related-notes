/**
 * 结构感知分块器（纯逻辑，可单测）
 * - 按段落边界（空行）与 Markdown 标题组织语义单元
 * - 超长单元按句边界（。！？!?；;）切分
 * - 相邻块保留 overlap 重叠，避免边界语义断裂
 */

export interface Chunk {
  index: number;
  text: string;
}

/**
 * 把笔记文本切成语义块。
 * @param text 预处理后的笔记文本（无 Markdown 符号）
 * @param maxChars 单块目标字符数（默认 800）
 * @param overlap 相邻块重叠字符数（默认 100）
 */
export function chunkText(text: string, maxChars = 800, overlap = 100): Chunk[] {
  // 保留换行与段落边界（只压行内空白与多余空行）
  const clean = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];
  if (clean.length <= maxChars) {
    return [{ index: 0, text: clean }];
  }

  // 1. 段落切分（空行边界）
  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // 2. 贪心合并段落为块；超长段落按句边界切
  const chunks: string[] = [];
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
          // 单句仍超长：硬切
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

  // 3. 相邻块重叠：在块开头拼接上一块末尾 overlap 字符
  if (overlap > 0 && chunks.length > 1) {
    for (let i = chunks.length - 1; i > 0; i--) {
      const tail = chunks[i - 1].slice(-overlap);
      chunks[i] = tail + "\n" + chunks[i];
    }
  }

  return chunks.map((text2, index) => ({ index, text: text2 }));
}
