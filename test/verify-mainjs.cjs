// main.js 内容核验（避免终端编码问题；esbuild 默认 charset=ascii，中文会以 \uXXXX 转义存在）
const fs = require("fs");
const s = fs.readFileSync("main.js", "utf8");
const esc = (zh) =>
  zh
    .split("")
    .map((c) => (c.charCodeAt(0) > 127 ? "\\u" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") : c))
    .join("");
const has = (zh) => s.includes(zh) || s.includes(esc(zh));
const checks = [
  ["中文界面文案（智能关联）", has("智能关联")],
  ["中文命令（语义搜索）", has("语义搜索")],
  ["中文设置（嵌入/对话提供商）", has("嵌入模型提供商") && has("对话模型提供商")],
  ["中文错误提示（API Key 无效）", has("API Key 无效")],
  ["中文空态（尚未建立索引）", has("语义索引尚未建立")],
  ["侧边栏视图注册", s.includes("shiyue-related-notes-sidebar")],
  ["Smart View 代码块注册", s.includes("smart-connections")],
  ["Ollama 支持", s.includes("api/embed") && s.includes("ollamaBaseUrl")],
  ["OpenAI 兼容支持", s.includes("chat/completions") && s.includes("embeddings")],
  ["API Key 掩码（password）", s.includes("password")],
  ["增量事件（create/modify/delete/rename）", s.includes('"create"') && s.includes('"modify"') && s.includes('"delete"') && s.includes('"rename"')],
  ["索引持久化（embeddings.json）", s.includes("embeddings.json")],
  ["调优反馈（更相关）", has("更相关")],
  ["侧边栏进度条（增量/重建标签）", has("正在增量索引") && has("正在重建全部索引")],
  ["进度事件广播（index-progress）", s.includes("shiyue-related-notes:index-progress")],
  ["开始索引通知", has("开始索引")],
  ["索引完成通知", has("索引完成")],
  ["进度快照接口（getIndexProgress）", s.includes("getIndexProgress")],
  ["调优持久化（tuneUpPaths）", s.includes("tuneUpPaths") && s.includes("tuneDownPaths")],
  ["错误详情弹窗（索引出错）", has("索引出错") && s.includes("IndexErrorModal")],
  ["状态栏点击分流（fatalError）", s.includes("getFatalError")],
  ["继续索引命令（resume-index）", s.includes("resume-index")],
  ["增量补齐文案", has("增量补齐")],
  ["索引模式标签（重建/增量）", has("增量索引") && has("重建索引")],
  ["超长嵌入降级重试（错误识别正则）", s.includes("too long") && s.includes("exceeds")],
  ["对话超长中文提示", has("超出对话模型上下文长度")],
  ["错误分类重试（classifyEmbedError）", s.includes("retryable") && s.includes("optimizable")],
  ["重试次数设置（retryAttempts）", s.includes("retryAttempts")],
  ["调优确认弹窗（标记为更相关）", has("标记为更相关") && has("确定？")],
  ["嵌入/对话提供商分离", s.includes("embeddingProvider") && s.includes("chatProvider")],
  ["Anthropic 对话支持", s.includes("anthropicBaseUrl") && s.includes("x-api-key")],
  ["设置帮助图标（ⓘ）", s.includes("scz-help-icon") && has("作用：")],
  ["增量精准入队（enqueueFiles）", s.includes("enqueueFiles")],
  ["分块器（chunkText/块级增量）", s.includes("noteMaxChars") && s.includes("getChunk")],
  ["混合检索（hybridSearch）", s.includes("hybridSearch") && s.includes("RRF")],
  ["BM25 关键词检索", s.includes("BM25Index") || s.includes("bm25")],
  ["块级索引（chunks）", s.includes("chunkCount") && s.includes("upsertNote")],
  ["索引格式 v2 自动升级", has("索引格式已升级")],
  ["单块大小设置", has("单块大小")],
];
let ok = 0;
for (const [name, pass] of checks) {
  console.log((pass ? "PASS" : "FAIL") + " - " + name);
  if (pass) ok++;
}
console.log(`\n${ok}/${checks.length} 项通过`);
process.exit(ok === checks.length ? 0 : 1);
