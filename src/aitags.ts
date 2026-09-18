/**
 * 智能标签（可选增强）：用对话模型为「笔记对」生成共同主题词
 * - 失败/超时/未配置 → 回落到规则标签（调用方处理），绝不阻塞推荐展示
 * - 结果由调用方持久化（data.json），重启不丢
 */

import type { SCZSettings } from "./settings";
import { chatStream } from "./embedder";

const TAG_TIMEOUT_MS = 60000;

/** 解析模型输出 → 标签数组（过滤超长/空值/噪声词，最多 3 个） */
export function parseAiTags(raw: string): string[] {
  if (!raw) return [];
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[""''「」『』\[\]{}【】]/g, " ")
    .trim();
  const NOISE = /主题|标签|共同|相关|词组|以下|如下|输出/;
  const parts = cleaned
    .split(/[、，,;；\n·|\/]+/)
    .map((s) =>
      s
        .replace(/^(主题词|标签|共同主题|共同主题词)[:：]\s*/, "")
        .replace(/^[*\d.、\s]+/, "")
        .replace(/\*+/g, "")
        .trim()
    )
    .filter((s) => s.length >= 2 && s.length <= 12 && !NOISE.test(s));
  const out: string[] = [];
  for (const p of parts) {
    if (out.some((x) => x.includes(p) || p.includes(x))) continue;
    out.push(p);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * 用对话模型为两篇笔记生成共同主题词。
 * @returns 标签数组；失败/超时返回 null（调用方回落规则标签）
 */
export async function generateAiTags(
  settings: SCZSettings,
  textA: string,
  textB: string,
  ruleTags: string[]
): Promise<string[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TAG_TIMEOUT_MS);
  try {
    const prompt =
      "下面是两篇笔记的内容。请找出它们的共同主题，输出 2-3 个简短的中文主题词（每个 2-6 个字），" +
      "用顿号（、）分隔，不要输出任何解释、序号或标点以外的内容。\n\n" +
      `【笔记一】\n${textA.slice(0, 800)}\n\n【笔记二】\n${textB.slice(0, 800)}`;
    let out = "";
    await chatStream(
      settings,
      [{ role: "user", content: prompt }],
      (d) => (out += d),
      ctrl.signal
    );
    const tags = parseAiTags(out);
    return tags.length > 0 ? tags : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
