/**
 * 中文化扫描：找出 UI 源码中可能遗漏的英文可见文案
 * 技术标识符（命令 id、class、API 字段）会被过滤
 */
const fs = require("fs");
const path = require("path");

const UI_FILES = [
  "src/main.ts",
  "src/settings-ui.ts",
  "src/sidebar.ts",
  "src/search.ts",
  "src/smartview.ts",
  "src/chat.ts",
];

const knownTechnical = new Set([
  "id", "name", "type", "text", "cls", "value", "placeholder", "aria-label", "role",
  "method", "content", "model", "messages", "input", "signal", "body", "embedding",
  "path", "hash", "updated", "key", "title", "href", "rows", "src", "alt",
  "buttonText", "setName", "setDesc", "setPlaceholder", "addOption", "setButtonText",
  "onChange", "onClick", "addText", "addSlider", "addDropdown", "addToggle", "addButton",
  "setValue", "setDisabled", "setCta", "setLimits", "setDynamicTooltip", "setHeading",
  "addClass", "removeClass", "setText", "createDiv", "createSpan", "createEl", "empty",
  "isConnected", "addEventListener", "getActiveFile", "getAbstractFileByPath",
  "getMarkdownFiles", "getAllLoadedFiles", "cachedRead", "openFile", "getLeaf",
  "workspace", "vault", "app", "editor", "settings", "plugin", "containerEl",
  "contentEl", "headerEl", "listEl", "statusBarEl", "inputEl", "resultEl", "msgEl",
  "sendBtn", "stopBtn", "contextBadge", "abortCtrl", "mdComp", "open", "close",
  "onOpen", "onClose", "onload", "onunload", "display", "render", "refresh",
  "similarTo", "similarToQuery", "isUpToDate", "upsert", "remove", "getEntry",
  "embed", "test", "registerEvent", "registerView", "addCommand", "addRibbonIcon",
  "addSettingTab", "addStatusBarItem", "registerMarkdownCodeBlockProcessor",
  "setViewState", "revealLeaf", "getRightLeaf", "getLeavesOfType", "getViewType",
  "getDisplayText", "getIcon", "trigger", "setValue", "focus", "scrollIntoView",
  "index", "data", "ok", "dims", "notes", "meta", "signature", "formatVersion",
  "excludedFolders", "provider", "openaiBaseUrl", "openaiApiKey", "embeddingModel",
  "chatModel", "ollamaBaseUrl", "ollamaModel", "ollamaChatModel", "maxResults",
  "minSimilarity", "autoIndex", "embedMaxChars", "batchSize", "requestTimeoutSec",
  "chatMaxContextNotes", "callback", "source", "ctx", "leaf", "view", "file",
  "error", "success", "message", "role", "status", "total", "updated", "version",
]);

const userVisible = [];

for (const f of UI_FILES) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const re = /["'`]([^"'`]*[A-Za-z]{3,}[^"'`]*)["'`]/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const s = m[1].trim();
      if (!s) continue;
      // 过滤：纯技术标识符 / 代码片段 / URL / 含中文的长句（可能中英混排，仅提示）
      const isTech = knownTechnical.has(s) ||
        /^(scz-|smart-connections|obsidian|https?:|\/\/|\.|#|src\/|test\/|docs\/|release\/|node |npm |ollama |npx |\$\{|function|return|await|import|export|const |let |new |typeof|instanceof)/.test(s);
      if (isTech) return;
      // 只报告「整句英文」（无中文字符，且不是明显标识符）
      const hasChinese = /[\u4e00-\u9fff]/.test(s);
      if (!hasChinese) {
        userVisible.push(`${f}:${idx + 1}: ${s}`);
      }
    }
  });
}

console.log("可能漏译的英文文案（需人工确认）：");
if (userVisible.length === 0) {
  console.log("（无）");
} else {
  userVisible.forEach((x) => console.log("  " + x));
}
