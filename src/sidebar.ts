/**
 * 侧边栏：智能关联推荐面板
 */

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type SmartConnectionsZh from "./main";
import type { IndexProgress } from "./main";
import { ConfirmModal } from "./main";
import { preprocessText, debounce } from "./utils";
import type { SimResult } from "./indexer";

export const VIEW_TYPE_SIDEBAR = "shiyue-related-notes-sidebar";

export class SCZSidebarView extends ItemView {
  private plugin: SmartConnectionsZh;
  private container!: HTMLElement;
  private listEl!: HTMLElement;
  private headerEl!: HTMLElement;
  private progressEl!: HTMLElement;
  private progressFillEl!: HTMLElement;
  private progressTextEl!: HTMLElement;
  private stopBtnEl!: HTMLElement;
  /** 调优反馈：更相关(+)/不相关(-) 的笔记路径 */
  private tuneUp = new Map<string, number[]>();
  private tuneDown = new Map<string, number[]>();
  private renderDebounced = debounce(() => this.render(), 250);

  constructor(leaf: WorkspaceLeaf, plugin: SmartConnectionsZh) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_SIDEBAR;
  }

  getDisplayText(): string {
    return "智能关联";
  }

  getIcon(): string {
    return "sparkles";
  }

  async onOpen(): Promise<void> {
    this.container = this.contentEl.createDiv({ cls: "scz-panel" });
    this.headerEl = this.container.createDiv({ cls: "scz-panel-header" });
    this.progressEl = this.container.createDiv({ cls: "scz-progress" });
    this.progressEl.hide();
    this.listEl = this.container.createDiv({ cls: "scz-list" });
    this.registerEvent(
      this.app.workspace.on("shiyue-related-notes:index-updated" as any, () =>
        this.renderDebounced()
      )
    );
    this.registerEvent(
      (this.app.workspace as any).on("shiyue-related-notes:index-progress", (p: IndexProgress) =>
        this.updateProgress(p)
      )
    );
    this.registerEvent(
      (this.app.workspace as any).on("shiyue-related-notes:tune-cleared", () => {
        this.tuneUp.clear();
        this.tuneDown.clear();
        this.render();
      })
    );
    // 恢复持久化的调优（重启不丢）；被删除/未索引的笔记自动忽略并从设置中修剪
    const validUp = this.plugin.settings.tuneUpPaths.filter((p) => this.plugin.index.getEntry(p));
    const validDown = this.plugin.settings.tuneDownPaths.filter((p) => this.plugin.index.getEntry(p));
    if (
      validUp.length !== this.plugin.settings.tuneUpPaths.length ||
      validDown.length !== this.plugin.settings.tuneDownPaths.length
    ) {
      void this.plugin.saveTune(validUp, validDown);
    }
    for (const p of validUp) {
      const e = this.plugin.index.getEntry(p);
      if (e) this.tuneUp.set(p, e.embedding);
    }
    for (const p of validDown) {
      const e = this.plugin.index.getEntry(p);
      if (e) this.tuneDown.set(p, e.embedding);
    }
    this.updateProgress(this.plugin.getIndexProgress());
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  onActiveFileChanged(): void {
    this.renderDebounced();
  }

  /** 面板顶部索引进度条 */
  private updateProgress(p: IndexProgress): void {
    if (!this.progressEl || !this.progressEl.isConnected) return;
    if (!p.running || p.total === 0) {
      this.progressEl.hide();
      return;
    }
    this.progressEl.show();
    const pct = Math.min(100, Math.round((p.done / p.total) * 100));
    if (!this.progressFillEl) {
      const bar = this.progressEl.createDiv({ cls: "scz-progress-bar" });
      this.progressFillEl = bar.createDiv({ cls: "scz-progress-fill" });
      this.progressTextEl = this.progressEl.createDiv({ cls: "scz-progress-text" });
    }
    this.progressFillEl.style.width = `${pct}%`;
    const label = p.mode === "full" ? "正在重建全部索引" : "正在增量索引";
    this.progressTextEl.setText(
      `${label} ${Math.min(p.done + 1, p.total)}/${p.total}（${pct}%）${p.current ? ` · ${p.current}` : ""}`
    );
    // 进度条旁的停止按钮（仅运行时显示）
    if (!this.stopBtnEl || !this.stopBtnEl.isConnected) {
      this.stopBtnEl = this.progressEl.createEl("button", {
        cls: "scz-btn scz-stop-btn",
        text: "停止",
        attr: { "aria-label": "停止索引（已完成部分保留）" },
      });
      this.stopBtnEl.addEventListener("click", () => this.plugin.stopIndex());
    }
  }

  private tuneVector(): number[] | null {
    const ups = [...this.tuneUp.values()];
    const downs = [...this.tuneDown.values()];
    if (ups.length === 0 && downs.length === 0) return null;
    const dim = ups[0]?.length ?? downs[0]?.length ?? 0;
    if (!dim) return null;
    const v = new Array(dim).fill(0);
    for (const u of ups) for (let i = 0; i < dim; i++) v[i] += u[i];
    for (const d of downs) for (let i = 0; i < dim; i++) v[i] -= d[i];
    return v;
  }

  /** 调优持久化到设置（重启恢复） */
  private persistTune(): void {
    void this.plugin.saveTune([...this.tuneUp.keys()], [...this.tuneDown.keys()]);
  }

  private render(): void {
    if (!this.container || !this.container.isConnected) return;
    this.listEl.empty();

    /* 索引出错横幅（错误详情 + 修复入口） */
    const fatal = this.plugin.getFatalError();
    if (fatal) {
      const banner = this.listEl.createDiv({ cls: "scz-error-banner" });
      banner.createDiv({ cls: "scz-error-text", text: `索引出错：${fatal}` });
      const btn = banner.createEl("button", { cls: "scz-btn", text: "去设置修复" });
      btn.addEventListener("click", () => {
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById("shiyue-related-notes");
      });
    }

    const active = this.app.workspace.getActiveFile();
    const sig = this.plugin.settings.embeddingProvider === "ollama"
      ? `${this.plugin.settings.ollamaModel}`
      : `${this.plugin.settings.embeddingModel}`;

    /* 头部 */
    this.headerEl.empty();
    const title = this.headerEl.createDiv({ cls: "scz-panel-title", text: "智能关联" });
    title.setAttribute("aria-label", `嵌入模型：${sig}；推荐数量：${this.plugin.settings.maxResults}；最低相似度：${this.plugin.settings.minSimilarity}`);
    if (this.tuneUp.size + this.tuneDown.size > 0) {
      const badge = this.headerEl.createSpan({
        cls: "scz-badge scz-badge-clickable",
        text: `已调优 ${this.tuneUp.size + this.tuneDown.size}`,
        attr: { "aria-label": "点击清除调优（不影响索引）" },
      });
      badge.addEventListener("click", () => {
        this.tuneUp.clear();
        this.tuneDown.clear();
        this.persistTune();
        this.render();
      });
    }
    const refreshBtn = this.headerEl.createEl("button", {
      cls: "clickable-icon",
      text: "⟳",
      attr: { "aria-label": "刷新推荐列表（不会触发索引）" },
    });
    refreshBtn.addEventListener("click", () => {
      this.render();
    });
    refreshBtn.style.fontSize = "14px";

    /* 未打开笔记 */
    if (!active) {
      this.listEl.createDiv({
        cls: "scz-empty",
        text: "打开一篇笔记后，这里会显示与它语义相近的笔记。",
      });
      return;
    }

    /* 索引为空 */
    if (this.plugin.index.docCount === 0) {
      this.listEl.createDiv({
        cls: "scz-empty",
        text: "语义索引尚未建立。请在设置 → 索引管理中点击「立即重建索引」，或先配置好模型后等待自动索引。",
      });
      return;
    }

    /* 当前笔记未被索引 */
    const self = this.plugin.index.getEntry(active.path);
    if (!self) {
      this.listEl.createDiv({
        cls: "scz-empty",
        text: "当前笔记还未被索引（可能位于排除文件夹）。切换模型后需要重建索引。",
      });
      return;
    }

    /* 计算相似度（含调优向量） */
    const adjust = this.tuneVector();
    const q = adjust ? self.embedding.map((x, i) => x + adjust[i]) : self.embedding;
    const results = this.plugin.index.similarToQuery(
      q,
      this.plugin.settings.maxResults,
      this.plugin.settings.minSimilarity,
      new Set([active.path])
    );
    void results.then((list) => this.renderResults(list, active.path));
  }

  private async renderResults(results: SimResult[], activePath: string): Promise<void> {
    if (!this.listEl.isConnected) return;
    this.listEl.empty();

    if (results.length === 0) {
      this.listEl.createDiv({
        cls: "scz-empty",
        text: "没有找到相似度达标的相关笔记。可以降低「最低相似度」，或检查索引是否完成。",
      });
      return;
    }

    for (const r of results) {
      const item = this.listEl.createDiv({ cls: "scz-item" });
      const line = item.createDiv({ cls: "scz-item-line" });
      const name = line.createDiv({
        cls: "scz-item-title",
        text: r.path.replace(/\.md$/i, "").split("/").pop() ?? r.path,
      });
      line.createSpan({
        cls: "scz-score",
        text: `${Math.round(r.score * 100)}%`,
      });

      /* 相关原因标签：先显示规则标签，AI 智能标签（可选）异步替换 */
      let tagRow: HTMLElement | null = null;
      const ruleTags = this.plugin.index.commonTerms(activePath, r.path, 3);
      if (ruleTags.length > 0) {
        tagRow = item.createDiv({ cls: "scz-tags" });
        tagRow.createSpan({ cls: "scz-tags-label", text: "相关:" });
        for (const t of ruleTags) {
          tagRow.createSpan({ cls: "scz-tag", text: t });
        }
      }
      if (this.plugin.settings.aiTagsEnabled && tagRow) {
        void this.maybeAiTags(activePath, r.path, item, () => tagRow);
      }

      /* 调优按钮（带确认弹窗，防误触） */
      const tuneBtns = item.createDiv({ cls: "scz-tune" });
      const up = tuneBtns.createEl("button", {
        cls: "scz-tune-btn",
        text: "＋",
        attr: { "aria-label": "这类笔记更相关（调优）" },
      });
      up.addEventListener("click", (e) => {
        e.stopPropagation();
        const emb = this.plugin.index.getEntry(r.path)?.embedding;
        if (!emb) return;
        new ConfirmModal(
          this.app,
          "标记为更相关",
          `将「${r.path.replace(/\.md$/i, "")}」标记为更相关，之后的推荐会向它倾斜（已保存，可随时清除）。确定？`,
          () => {
            this.tuneUp.set(r.path, emb);
            this.tuneDown.delete(r.path);
            this.persistTune();
            this.render();
          }
        ).open();
      });
      const down = tuneBtns.createEl("button", {
        cls: "scz-tune-btn",
        text: "－",
        attr: { "aria-label": "这类笔记不相关（调优）" },
      });
      down.addEventListener("click", (e) => {
        e.stopPropagation();
        const emb = this.plugin.index.getEntry(r.path)?.embedding;
        if (!emb) return;
        new ConfirmModal(
          this.app,
          "标记为不相关",
          `将「${r.path.replace(/\.md$/i, "")}」标记为不相关，之后的推荐会避开它（已保存，可随时清除）。确定？`,
          () => {
            this.tuneDown.set(r.path, emb);
            this.tuneUp.delete(r.path);
            this.persistTune();
            this.render();
          }
        ).open();
      });

      /* 点击打开 */
      item.addEventListener("click", () => {
        const file = this.app.vault.getAbstractFileByPath(r.path);
        if (file instanceof TFile) {
          void this.app.workspace.getLeaf(false).openFile(file);
        }
      });

      /* 摘要（异步读取） */
      const snippet = item.createDiv({ cls: "scz-snippet", text: "…" });
      void this.loadSnippet(r.path, snippet);
    }
  }

  /** AI 智能标签：异步生成并替换规则标签；失败静默保留规则标签 */
  private async maybeAiTags(
    pathA: string,
    pathB: string,
    item: HTMLElement,
    getRow: () => HTMLElement | null
  ): Promise<void> {
    try {
      const fa = this.app.vault.getAbstractFileByPath(pathA);
      const fb = this.app.vault.getAbstractFileByPath(pathB);
      if (!(fa instanceof TFile) || !(fb instanceof TFile)) return;
      const [tA, tB] = await Promise.all([
        this.app.vault.cachedRead(fa),
        this.app.vault.cachedRead(fb),
      ]);
      if (!item.isConnected) return;
      const tags = await this.plugin.getAiTag(
        pathA,
        pathB,
        tA.slice(0, 1200),
        tB.slice(0, 1200)
      );
      if (!tags || tags.length === 0 || !item.isConnected) return;
      const row = getRow();
      if (!row || !row.isConnected) return;
      row.empty();
      row.createSpan({ cls: "scz-tags-label", text: "相关(AI):" });
      for (const t of tags) {
        row.createSpan({ cls: "scz-tag scz-tag-ai", text: t });
      }
    } catch {
      /* 静默回落规则标签 */
    }
  }

  private async loadSnippet(path: string, el: HTMLElement): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;
      const raw = await this.app.vault.cachedRead(file);
      const text = preprocessText(raw, 200);
      if (el.isConnected) {
        el.setText(text || "（空笔记）");
      }
    } catch {
      /* 忽略读取失败 */
    }
  }
}
