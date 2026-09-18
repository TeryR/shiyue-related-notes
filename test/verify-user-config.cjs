/**
 * 用户配置端到端验证：按修复后的地址容错逻辑，重放「测试对话连接」「测试重排序」两个请求
 * 使用的配置直接读取用户 data.json（与插件运行时一致）；不打印任何 Key
 */
const fs = require("fs");

const DATA = "T:/Obsidian个人知识库/.obsidian/plugins/smart-connections/data.json";

function strip(base, suffixes) {
  let b = (base || "").replace(/\/+$/, "");
  for (const s of suffixes) {
    if (b.toLowerCase().endsWith(s.toLowerCase())) b = b.slice(0, -s.length).replace(/\/+$/, "");
  }
  return b;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));

  /* 1. 对话模型 */
  const chatBase = strip(data.chatOpenaiBaseUrl || data.openaiBaseUrl, ["/chat/completions"]);
  const chatKey = data.chatOpenaiApiKey || data.openaiApiKey;
  console.log("【对话】实际请求地址:", chatBase + "/chat/completions");
  console.log("【对话】模型:", data.chatModel);
  const r1 = await fetch(chatBase + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chatKey}` },
    body: JSON.stringify({ model: data.chatModel, messages: [{ role: "user", content: "请只回复四个字：连接成功" }], stream: false, max_tokens: 20 }),
  });
  const j1 = await r1.json().catch(() => ({}));
  console.log("【对话】HTTP", r1.status, "| 返回:", (j1.choices?.[0]?.message?.content || JSON.stringify(j1).slice(0, 120)).slice(0, 80));

  /* 2. 重排序 */
  const rrBase = strip(data.rerankBaseUrl, ["/rerank"]);
  console.log("\n【重排序】实际请求地址:", rrBase + "/rerank");
  console.log("【重排序】模型:", data.rerankModel);
  const r2 = await fetch(rrBase + "/rerank", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.rerankApiKey}` },
    body: JSON.stringify({ model: data.rerankModel, query: "手冲咖啡 参数", documents: ["手冲咖啡的粉水比与水温", "深蹲的力量训练要点"], top_n: 5 }),
  });
  const j2 = await r2.json().catch(() => ({}));
  if (j2.results) {
    console.log("【重排序】HTTP", r2.status, "| 打分:", JSON.stringify(j2.results.map((x) => ({ i: x.index, s: x.relevance_score }))));
  } else {
    console.log("【重排序】HTTP", r2.status, "|", JSON.stringify(j2).slice(0, 150));
  }

  const ok1 = r1.status === 200;
  const ok2 = r2.status === 200 && Array.isArray(j2.results);
  console.log(`\n结论：对话 ${ok1 ? "✅" : "❌"} / 重排序 ${ok2 ? "✅" : "❌"}`);
  process.exit(ok1 && ok2 ? 0 : 1);
}

main().catch((e) => {
  console.error("验证异常:", e.message || e);
  process.exit(1);
});
