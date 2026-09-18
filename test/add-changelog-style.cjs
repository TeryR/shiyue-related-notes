// 追加更新日志弹窗样式到 styles.css（一次性脚本）
const fs = require("fs");
const css = fs.readFileSync("styles.css", "utf8");
if (css.includes("scz-changelog")) {
  console.log("样式已存在，跳过");
  process.exit(0);
}
const add = `/* ---------- 更新日志弹窗 ---------- */

.scz-changelog-modal .modal-content {
  max-height: 72vh;
}

.scz-changelog {
  max-height: 58vh;
  overflow-y: auto;
  padding-right: 8px;
  font-size: var(--font-ui-small);
  line-height: 1.7;
}

.scz-changelog h1 {
  font-size: 20px;
  margin: 8px 0 12px;
}

.scz-changelog h2 {
  font-size: 16px;
  margin: 18px 0 8px;
  padding-top: 8px;
  border-top: 1px solid var(--background-modifier-border);
}

.scz-changelog h3 {
  font-size: 14px;
  margin: 10px 0 4px;
}

.scz-changelog ul {
  margin: 4px 0 10px 20px;
}

.scz-changelog li {
  margin: 3px 0;
}

.scz-changelog code {
  font-family: var(--font-monospace);
  font-size: 0.9em;
  background: var(--background-secondary);
  padding: 0 3px;
  border-radius: 3px;
}
`;
fs.writeFileSync("styles.css", css.trimEnd() + "\n\n" + add.trim() + "\n");
console.log("styles.css 已追加 changelog 样式");
