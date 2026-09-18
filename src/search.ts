/**
 * 语义搜索弹窗（v2：混合检索 = 向量 + BM25 + RRF，展示命中块摘要）
 */

import { Modal, TFile } from "obsidian";
import type SmartConnectionsZh from "./main";
import { preprocessText } from "./utils";

export class SCZSearchModal extends Modal {
  private plugin: SmartConnectionsZh;
  private inputEl!: HTMLInputElement;
  private resultEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor(plugin: SmartConnectionsZh) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("scz-search-modal");

    const head = contentEl.createDiv({ cls: "scz-search-head" });
    head.createSpan({ cls: "scz-search-label", text: "语义搜索" });
    this.inputEl = head.createEl("input", {
      cls: "scz-search-input",
      attr: { placeholder: "用自然语言描述你想找的内容，例如：关于减脂期蛋白质摄入的笔记…" },
    });
    this.statusEl = contentEl.createDiv({ cls: "scz-search-status" });
    this.resultEl = contentEl.createDiv({ cls: "scz-search-results" });

    this.inputEl.addEventListener("input", () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.doSearch(), 350);
    });
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const first = this.resultEl.querySelector(".scz-search-item");
        (first as HTMLElement | null)?.click();
      }
    });

    this.statusEl.setText("输入关键词后自动检索（向量 + 关键词混合）");
    setTimeout(() => this.inputEl.focus(), 50);
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.timer) clearTimeout(this.timer);
  }

  private async doSearch(): Promise<void> {
    const query = this.inputEl.value.trim();
    const mySeq = ++this.seq;
    if (!query) {
      this.statusEl.setText("输入关键词后自动检索（向量 + 关键词混合）");
      this.resultEl.empty();
      return;
    }
    this.statusEl.setText("正在检索…");
    try {
      const q = preprocessText(query, 500);
      const vecs = await this.plugin.provider.embed([q]);
      const results = await this.plugin.hybridSearchForUI(query, vecs[0], 50);
      if (mySeq !== this.seq) return; // 已有更新的输入
      this.resultEl.empty();
      if (results.length === 0) {
        this.statusEl.setText("没有找到相关笔记。可尝试换一种说法，或确认索引已建立。");
        return;
      }
      this.statusEl.setText(`共找到 ${results.length} 条相关笔记（混合检索：向量 + 关键词）`);
      for (const r of results) {
        const item = this.resultEl.createDiv({ cls: "scz-search-item" });
        const line = item.createDiv({ cls: "scz-search-line" });
        line.createDiv({
          cls: "scz-search-title",
          text: r.path.replace(/\.md$/i, ""),
        });
        line.createSpan({
          cls: "scz-score",
          text: `${Math.round(r.score * 100)}%`,
        });
        item.createDiv({ cls: "scz-search-path", text: r.path });
        // 命中块摘要（混合检索的精准片段）
        const hit = r.chunkHits[0];
        const snip = item.createDiv({
          cls: "scz-snippet",
          text: hit ? hit.text.slice(0, 160) : "…",
        });
        if (hit && hit.cosine > 0) {
          snip.setAttribute("aria-label", `语义相似度 ${Math.round(hit.cosine * 100)}%`);
        }
        item.addEventListener("click", () => {
          const file = this.app.vault.getAbstractFileByPath(r.path);
          if (file instanceof TFile) {
            void this.app.workspace.getLeaf(false).openFile(file);
            this.close();
          }
        });
      }
    } catch (e) {
      if (mySeq !== this.seq) return;
      const msg = e instanceof Error ? e.message : String(e);
      this.resultEl.empty();
      this.statusEl.setText(`检索失败：${msg}（可在设置中检查模型配置）`);
    }
  }
}
