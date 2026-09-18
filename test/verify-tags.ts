/**
 * 快速验证：相关标签（commonTerms）——基于测试索引（test/vault 的 v2 embeddings.json）
 */
import * as fs from "fs";
import * as path from "path";
import { SemanticIndex } from "../src/indexer";
import { DEFAULT_SETTINGS, embeddingSignature, SCZSettings } from "../src/settings";

const VAULT = path.join(__dirname, "vault");
const INDEX = path.join(VAULT, ".obsidian", "plugins", "shiyue-related-notes", "embeddings.json");

function main(): void {
  const settings: SCZSettings = { ...DEFAULT_SETTINGS, embeddingProvider: "ollama", ollamaModel: "bge-m3" };
  const sig = embeddingSignature(settings);
  const json = JSON.parse(fs.readFileSync(INDEX, "utf8"));
  const index = SemanticIndex.fromJSON(sig, json);
  console.log(`索引：${index.docCount} 篇 / ${index.chunkCount} 块\n`);

  const cases: [string, string][] = [
    ["中文话题库/咖啡文化与手冲/手冲咖啡入门笔记.md", "中文话题库/咖啡文化与手冲/意式浓缩与奶咖.md"],
    ["中文话题库/咖啡文化与手冲/手冲咖啡入门笔记.md", "中文话题库/健康饮食与营养/减脂期的蛋白质摄入.md"],
    ["中文话题库/历史人物与王朝/唐太宗与贞观之治.md", "中文话题库/历史人物与王朝/明太祖朱元璋的治国策略.md"],
  ];
  let ok = 0;
  for (const [a, b] of cases) {
    const terms = index.commonTerms(a, b, 3);
    const aName = a.split("/").pop();
    const bName = b.split("/").pop();
    console.log(`${aName} ↔ ${bName}`);
    console.log(`  共同主题词：${terms.length ? terms.join(" · ") : "（无）"}`);
    // 同话题的两组应该能提取出主题词；跨话题（咖啡↔减脂）词应更少/更弱
    if (terms.length > 0) ok++;
  }
  console.log(`\n${ok}/${cases.length} 组提取到共同主题词`);
  process.exit(ok >= 2 ? 0 : 1);
}

main();
