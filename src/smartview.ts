/**
 * Smart View：在笔记中嵌入相似笔记列表的代码块
 *
 * ```smart-connections
 * minSimilarity: 0.4
 * maxResults: 10
 * maxCharacters: 500
 * ```
 */

import { MarkdownRenderChild, TFile } from "obsidian";
import type SmartConnectionsZh from "./main";
import { preprocessText, debounce } from "./utils";

interface SmartViewParams {
  minSimilarity: number;
  maxResults: number;
  maxCharacters: number;
}

function parseParams(source: string): SmartViewParams {
  const p: SmartViewParams = { minSimilarity: 0.4, maxResults: 10, maxCharacters: 500 };
  for (const line of source.split("\n")) {
    const m = line.match(/^\s*([a-zA-Z]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (key === "minSimilarity") {
      const n = parseFloat(val);
      if (!isNaN(n)) p.minSimilarity = Math.max(0, Math.min(1, n));
    } else if (key === "maxResults") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) p.maxResults = Math.max(1, Math.min(100, n));
    } else if (key === "maxCharacters") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) p.maxCharacters = Math.max(0, n);
    }
  }
  return p;
}

class SmartViewRenderer extends MarkdownRenderChild {
  constructor(
    private plugin: SmartConnectionsZh,
    container: HTMLElement,
    private params: SmartViewParams
  ) {
    super(container);
  }

  onload(): void {
    this.registerEvent(
      this.plugin.app.workspace.on("active-leaf-change", () => this.renderDebounced())
    );
    this.registerEvent(
      this.plugin.app.workspace.on("shiyue-related-notes:index-updated" as any, () =>
        this.renderDebounced()
      )
    );
    this.renderDebounced();
  }

  private renderDebounced = debounce(() => void this.render(), 300);

  private async render(): Promise<void> {
    const el = this.containerEl;
    if (!el.isConnected) return;
    el.empty();
    el.addClass("scz-smartview");

    const active = this.plugin.app.workspace.getActiveFile();
    if (!active) {
      el.createDiv({ cls: "scz-empty", text: "打开一篇笔记后，这里会显示语义相近的笔记。" });
      return;
    }
    if (this.plugin.index.docCount === 0) {
      el.createDiv({ cls: "scz-empty", text: "语义索引尚未建立，请先重建索引。" });
      return;
    }
    const self = this.plugin.index.getEntry(active.path);
    if (!self) {
      el.createDiv({ cls: "scz-empty", text: "当前笔记尚未被索引。" });
      return;
    }

    const results = await this.plugin.index.similarToQuery(
      self.embedding,
      this.params.maxResults,
      this.params.minSimilarity,
      new Set([active.path])
    );

    if (results.length === 0) {
      el.createDiv({
        cls: "scz-empty",
        text: `没有找到相似度 ≥ ${this.params.minSimilarity} 的相关笔记。`,
      });
      return;
    }

    for (const r of results) {
      const row = el.createDiv({ cls: "scz-smartview-item" });
      const a = row.createEl("a", {
        cls: "scz-smartview-link",
        text: r.path.replace(/\.md$/i, "").split("/").pop() ?? r.path,
        href: "#",
      });
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const file = this.plugin.app.vault.getAbstractFileByPath(r.path);
        if (file instanceof TFile) {
          void this.plugin.app.workspace.getLeaf(false).openFile(file);
        }
      });
      row.createSpan({
        cls: "scz-score",
        text: `${Math.round(r.score * 100)}%`,
      });
      if (this.params.maxCharacters > 0) {
        const snip = row.createDiv({ cls: "scz-snippet", text: "…" });
        void this.loadSnippet(r.path, snip);
      }
    }
  }

  private async loadSnippet(path: string, el: HTMLElement): Promise<void> {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;
      const raw = await this.plugin.app.vault.cachedRead(file);
      const text = preprocessText(raw, this.params.maxCharacters);
      if (el.isConnected) el.setText(text || "（空笔记）");
    } catch {
      /* 忽略 */
    }
  }
}

export function registerSmartView(plugin: SmartConnectionsZh): void {
  plugin.registerMarkdownCodeBlockProcessor("smart-connections", (source, el, ctx) => {
    const params = parseParams(source);
    ctx.addChild(new SmartViewRenderer(plugin, el, params));
  });
}
