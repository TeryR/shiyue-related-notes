// 验证 bge-m3 上下文超长行为：超长报错 → 截短可嵌入（降级重试的前提）
async function main() {
  const base = "http://127.0.0.1:11434";
  let long = "";
  for (let i = 0; i < 400; i++) {
    long += "健康饮食蛋白质热量膳食纤维维生素abcdefg0123456789!@#$%^&*() 运动健身训练肌肉拉伸深蹲有氧心率\n";
  }
  console.log("构造文本长度:", long.length, "字符");

  const r1 = await fetch(base + "/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", input: [long] }),
  });
  const body1 = await r1.text();
  console.log("完整长文  HTTP", r1.status, "|", body1.slice(0, 100));
  const overflowDetected = /context length|input length|too long|exceeds/i.test(body1);

  const short = long.slice(0, 2000);
  const r2 = await fetch(base + "/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", input: [short] }),
  });
  const j2 = await r2.json();
  console.log("截短 2000  HTTP", r2.status, "| 向量维度:", j2.embeddings?.[0]?.length ?? "失败");

  console.log("\n结论:", overflowDetected && r2.status === 200 && j2.embeddings?.[0]?.length === 1024
    ? "降级重试前提成立（超长报错 + 截短可嵌入）"
    : "前提不成立，需复查");
  process.exit(overflowDetected && r2.status === 200 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
