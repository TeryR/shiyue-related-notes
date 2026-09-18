/**
 * 插件主入口：事件接线、后台索引队列、命令、状态栏、持久化
 * v2：结构感知分块 + 块级增量 + 混合检索（BM25 + 向量 + RRF）
 */

import {
  Plugin,
  TFile,
  Notice,
  Modal,
  Setting,
  WorkspaceLeaf,
  App,
  MarkdownRenderer,
  Component,
} from "obsidian";
import {
  SCZSettings,
  DEFAULT_SETTINGS,
  embeddingSignature,
  migrateSettings,
} from "./settings";
import { SemanticIndex, IndexDataV2, FORMAT_VERSION } from "./indexer";
import {
  createEmbeddingProvider,
  EmbeddingProvider,
  classifyEmbedError,
} from "./embedder";
import { hashString, preprocessText, debounce, isExcludedPath, sleep } from "./utils";
import { chunkText } from "./chunker";
import { generateAiTags } from "./aitags";
import { rerank as rerankApi, RerankConfig, RerankHit } from "./rerank";
import type { HybridResult } from "./indexer";
import { SCZSettingsTab } from "./settings-ui";
import { SCZSidebarView, VIEW_TYPE_SIDEBAR } from "./sidebar";
import { SCZSearchModal } from "./search";
import { registerSmartView } from "./smartview";
import { SCZChatModal, SCZRewriteModal, SCZNotesModal } from "./chat";

export const INDEX_FILE = "embeddings.json";

/** 索引队列模式：auto=自动增量 / full=全量重建 / resume=手动继续（增量补齐） */
export type IndexQueueMode = "auto" | "full" | "resume";

/** 索引进度快照类型（侧边栏 / 设置页共用） */
export interface IndexProgress {
  running: boolean;
  done: number;
  total: number;
  current?: string;
  mode: IndexQueueMode;
}

export default class SmartConnectionsZh extends Plugin {
  settings!: SCZSettings;
  index!: SemanticIndex;
  provider!: EmbeddingProvider;

  private queue: TFile[] = [];
  private queueRunning = false;
  private indexTotal = 0;
  private indexDone = 0;
  private indexFailed = 0;
  private fatalError: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private statusBarEl!: HTMLElement;
  private sidebarView: SCZSidebarView | null = null;
  private notifyComplete = false;
  private queueMode: IndexQueueMode = "auto";
  private embeddedThisRun = 0;
  private retriedThisRun = 0;
  private lastActivePath: string | null = null;
  private pendingReview: TFile[] = [];
  private reviewTimer: ReturnType<typeof setTimeout> | null = null;

  /* ==================== 生命周期 ==================== */

  async onload(): Promise<void> {
    this.settings = migrateSettings(await this.loadData());

    this.index = await this.loadIndex();
    this.provider = createEmbeddingProvider(this.settings);

    this.registerView(
      VIEW_TYPE_SIDEBAR,
      (leaf) => (this.sidebarView = new SCZSidebarView(leaf, this))
    );

    this.addRibbonIcon("sparkles", "智能关联", () => void this.openSidebar());

    this.registerCommands();
    this.addSettingTab(new SCZSettingsTab(this.app, this));
    this.initStatusBar();
    registerSmartView(this);
    this.registerVaultEvents();
    this.registerWorkspaceEvents();

    // 启动静默扫描：无变化时无感知，有需要时自动补索引
    void this.queueScan(false, "auto");
  }

  onunload(): void {
    void this.saveIndexNow();
  }

  /* ==================== 设置 ==================== */

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.provider = createEmbeddingProvider(this.settings);
    // 模型/接口变更：不再自动清空重建。
    // 旧索引继续可用（同旧模型的向量彼此自洽，推荐不中断）；
    // 用户手动「继续索引」时检测到签名不匹配，会提示后重建。
    if (this.index.meta.signature === embeddingSignature(this.settings)) {
      this.staleNoticeShown = false; // 切回匹配的模型后，重置提示标志
    } else if (!this.staleNoticeShown) {
      this.staleNoticeShown = true;
      new Notice(
        "智能关联：嵌入模型已变更。旧索引暂保留可用；点「继续索引」将用新模型重建（会清空旧向量）。",
        10000
      );
    }
  }

  /** 排除文件夹变更后：把位于排除路径下的已有条目从索引移除（否则搜索仍会命中） */
  pruneExcluded(): void {
    let removed = 0;
    for (const p of this.index.paths) {
      if (this.isExcluded(p)) {
        this.index.remove(p);
        removed++;
      }
    }
    if (removed > 0) {
      this.scheduleSaveIndex();
      this.notifyIndexChanged();
      new Notice(`智能关联：已从索引移除排除范围内的 ${removed} 篇笔记`);
    }
  }

  private staleNoticeShown = false;

  /* ==================== 索引持久化 ==================== */

  private indexPath(): string {
    return `${this.manifest.dir}/${INDEX_FILE}`;
  }

  private async loadIndex(): Promise<SemanticIndex> {
    const sig = embeddingSignature(this.settings);
    const adapter = this.app.vault.adapter;
    try {
      if (adapter && (await adapter.exists(this.indexPath()))) {
        const raw = await adapter.read(this.indexPath());
        const json = JSON.parse(raw) as IndexDataV2 | null;
        if (json && json.meta) {
          if (json.meta.formatVersion === FORMAT_VERSION) {
            if (json.meta.signature === sig) {
              return SemanticIndex.fromJSON(sig, json);
            }
            new Notice("嵌入模型或接口已变更，正在重建语义索引…");
          } else {
            new Notice("智能关联：索引格式已升级（分块 + 混合检索），正在自动重建…");
          }
        }
        return SemanticIndex.fromJSON(sig, null);
      }
    } catch {
      // 文件损坏等 → 重建
    }
    return SemanticIndex.fromJSON(sig, null);
  }

  async saveIndexNow(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const adapter = this.app.vault.adapter;
    if (!adapter) return;
    try {
      await adapter.write(this.indexPath(), JSON.stringify(this.index.toJSON()));
    } catch (e) {
      console.error("智能关联：索引保存失败", e);
    }
  }

  scheduleSaveIndex(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.saveIndexNow();
    }, 2000);
  }

  /* ==================== 事件 ==================== */

  private registerVaultEvents(): void {
    // 增量：新建文件立即入队
    this.registerEvent(
      this.app.vault.on("create", (f) => {
        if (f instanceof TFile && f.extension === "md") this.enqueueFiles([f]);
      })
    );
    // 增量：修改文件合并入队（1.5 秒窗口，给编辑器写盘留时间，连续编辑只触发一次）
    let pending: TFile[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      const files = pending;
      pending = [];
      if (files.length > 0) this.enqueueFiles(files);
    };
    this.registerEvent(
      this.app.vault.on("modify", (f) => {
        if (!(f instanceof TFile) || f.extension !== "md") return;
        pending.push(f);
        if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            flush();
          }, 1000);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (f) => {
        if (f instanceof TFile && f.extension === "md") {
          this.index.remove(f.path);
          this.scheduleSaveIndex();
          this.notifyIndexChanged();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => {
        if (f instanceof TFile && f.extension === "md") {
          this.index.remove(oldPath);
          this.scheduleSaveIndex();
          // 统一入队，避免与队列并发嵌入
          this.enqueueFiles([f]);
          this.notifyIndexChanged();
        }
      })
    );
  }

  private registerWorkspaceEvents(): void {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.sidebarView?.onActiveFileChanged();
        // 切走即复核：离开某篇笔记时该笔记必已写盘，此时单文件哈希确认一次。
        // 兕底「修改事件与写盘竞态」的漏网场景；无变化则零成本，纯事件驱动、无定时轮询。
        const prev = this.lastActivePath;
        const cur = this.app.workspace.getActiveFile();
        this.lastActivePath = cur?.path ?? null;
        if (prev && prev !== (cur?.path ?? null)) {
          const pf = this.app.vault.getAbstractFileByPath(prev);
          if (pf instanceof TFile && pf.extension === "md" && !this.isExcluded(prev)) {
            this.pendingReview.push(pf);
            if (!this.reviewTimer) {
              this.reviewTimer = setTimeout(() => {
                this.reviewTimer = null;
                const files = this.pendingReview;
                this.pendingReview = [];
                void this.reviewFiles(files);
              }, 1500);
            }
          }
        }
      })
    );
  }

  /** 切走笔记的复核：只入队内容真正变化的文件（其余零成本） */
  private async reviewFiles(files: TFile[]): Promise<void> {
    for (const f of files) {
      if (this.isExcluded(f.path) || this.queue.some((q) => q.path === f.path)) continue;
      try {
        const raw = await this.app.vault.read(f);
        const docText = preprocessText(raw, this.settings.noteMaxChars);
        if (!docText) continue;
        if (!this.index.isUpToDate(f.path, hashString(docText))) {
          this.enqueueFiles([f]);
        }
      } catch {
        /* 忽略 */
      }
    }
  }

  /** 通知侧边栏 / Smart View 刷新（通过 workspace 事件总线） */
  notifyIndexChanged(): void {
    (this.app.workspace as any).trigger("shiyue-related-notes:index-updated");
  }

  /* ==================== 后台索引队列 ==================== */

  isExcluded(path: string): boolean {
    return isExcludedPath(path, this.settings.excludedFolders);
  }

  /** 增量入队：只处理指定的变化文件（去重 + 排除 + 自动索引开关） */
  private enqueueFiles(files: TFile[]): void {
    if (!this.settings.autoIndex) return;
    const seen = new Set(this.queue.map((f) => f.path));
    let added = 0;
    for (const f of files) {
      if (f.extension !== "md" || this.isExcluded(f.path) || seen.has(f.path)) continue;
      this.queue.push(f);
      seen.add(f.path);
      added++;
    }
    if (added === 0) return;
    if (!this.queueRunning) {
      this.indexTotal = this.queue.length;
      this.indexDone = 0;
      this.indexFailed = 0;
      this.retriedThisRun = 0;
      this.fatalError = null;
      this.queueMode = "auto";
      void this.runQueue();
    }
    this.updateStatus();
  }

  queueAll(notify = false, mode: IndexQueueMode = "auto"): void {
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => !this.isExcluded(f.path));
    const seen = new Set(this.queue.map((f) => f.path));
    for (const f of files) {
      if (!seen.has(f.path)) {
        this.queue.push(f);
        seen.add(f.path);
      }
    }
    this.indexTotal = files.length;
    this.indexDone = 0;
    this.indexFailed = 0;
    this.fatalError = null;
    this.queueMode = mode;
    this.embeddedThisRun = 0;
    this.retriedThisRun = 0;
    this.notifyComplete = notify;
    if (notify && files.length > 0) {
      if (mode === "full") {
        new Notice(`智能关联：开始重建全部索引，共 ${files.length} 篇…`);
      } else {
        new Notice(`智能关联：开始索引 ${files.length} 篇笔记…（点击 ✨ 图标可查看进度）`);
      }
    }
    void this.runQueue();
  }

  /**
   * 扫描式增量：静默遍历全库做哈希比对，只入队真正需要嵌入的笔记。
   * 用于启动自动补跑与手动「继续索引」——正常情况（无变化）不显示任何进度。
   */
  private async queueScan(notify: boolean, mode: "auto" | "resume"): Promise<void> {
    this.stopped = false; // 新扫描开始，清除旧的停止标记
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => !this.isExcluded(f.path));
    const maxChars = this.settings.noteMaxChars;
    const need: TFile[] = [];
    for (const f of files) {
      try {
        const raw = await this.app.vault.read(f);
        const text = preprocessText(raw, maxChars);
        if (text && !this.index.isUpToDate(f.path, hashString(text))) {
          need.push(f);
        }
      } catch {
        need.push(f); // 读取失败视为待重试
      }
    }
    if (need.length === 0) {
      if (notify && mode === "resume") {
        new Notice("智能关联：索引已是最新，无需补齐");
      }
      this.updateStatus();
      return;
    }
    if (this.stopped) {
      // 用户在扫描期间点了停止：不入队
      if (notify) new Notice("智能关联：索引已停止，未开始新的嵌入");
      return;
    }
    if (notify) {
      new Notice(
        mode === "resume"
          ? `智能关联：发现 ${need.length} 篇笔记需要索引，开始补齐…`
          : `智能关联：发现 ${need.length} 篇新笔记，开始索引…`
      );
    }
    this.enqueueFiles(need);
  }

  private async runQueue(): Promise<void> {
    if (this.queueRunning) return;
    this.queueRunning = true;
    this.stopped = false; // 新任务开始，清除停止标记
    while (this.queue.length) {
      const f = this.queue.shift()!;
      if (this.isExcluded(f.path)) continue;
      const r = await this.indexFileSafe(f);
      this.indexDone++;
      if (r === "ok") {
        this.embeddedThisRun++;
        // 有成功 → 说明配置已恢复，清除错误状态（状态栏红色/侧边栏横幅）
        if (this.fatalError) this.fatalError = null;
      } else if (r === "fail") this.indexFailed++;
      this.updateStatus();
      // 运行期间有新文件入队时，延长任务总量（进度平滑）
      if (this.indexDone >= this.indexTotal && this.queue.length > 0) {
        this.indexTotal = this.indexDone + this.queue.length;
      }
      if (this.fatalError) {
        // 错误状态保留在状态栏（红色），全量扫描时弹通知提醒
        if (this.notifyComplete) {
          new Notice(`智能关联：索引已停止 —— ${this.fatalError}`);
        }
        break;
      }
    }
    this.queueRunning = false;
    this.updateStatus();
    if (this.stopped) {
      this.stopped = false;
      new Notice(`智能关联：索引已停止，本次完成 ${this.embeddedThisRun} 篇。点「继续索引」接着跑。`);
    } else if (this.notifyComplete) {
      if (this.indexFailed > 0 && !this.fatalError) {
        new Notice(`智能关联：索引完成，本次嵌入 ${this.embeddedThisRun} 篇，重试 ${this.retriedThisRun} 次，${this.indexFailed} 篇失败（可点「继续索引」重试）`);
      } else if (this.indexTotal > 0) {
        const retryInfo = this.retriedThisRun > 0 ? `，自动重试 ${this.retriedThisRun} 次` : "";
        new Notice(`智能关联：索引完成，本次嵌入 ${this.embeddedThisRun} 篇${retryInfo}，库内共 ${this.index.docCount} 篇 / ${this.index.chunkCount} 块`);
      }
      this.notifyComplete = false;
    }
    this.notifyIndexChanged();
  }

  async indexFileSafe(f: TFile): Promise<"ok" | "skip" | "fail"> {
    let lastMsg = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return (await this.indexFile(f)) ? "ok" : "skip";
      } catch (e) {
        lastMsg = e instanceof Error ? e.message : String(e);
        const kind = classifyEmbedError(lastMsg);
        if (kind === "fatal") {
          // 配置类错误（Key 无效 / 模型缺失）：重试无意义，停止队列并提示修复
          this.fatalError = lastMsg;
          return "fail";
        }
        // 超长类已在 indexFile 内部自动降级截断；瞬时类退避重试，其他类型补 1 次
        const canRetry =
          kind === "retryable" ? attempt < 2 : kind === "other" ? attempt < 1 : false;
        if (canRetry) {
          this.retriedThisRun++;
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        return "fail";
      }
    }
    return "fail";
  }

  async indexFile(f: TFile): Promise<boolean> {
    if (f.extension !== "md") return false;
    // 用 vault.read 强制读最新内容：cachedRead 在编辑器写盘与 modify 事件之间存在竞态，
    // 可能读到旧缓存导致「内容没变 → 跳过」的假象（用户实测：新建后继续编辑不再索引）
    const raw = await this.app.vault.read(f);
    const docText = preprocessText(raw, this.settings.noteMaxChars);
    if (!docText) return false;
    const docHash = hashString(docText);
    if (this.index.isUpToDate(f.path, docHash)) return false;

    // 结构感知分块（保留段落边界）→ 块级哈希比对 → 只嵌入变化的块
    const rawChunks = chunkText(raw, this.settings.embedMaxChars, 100);
    const prepared: { idx: number; text: string; hash: string; reuse?: number[] }[] = [];
    const toEmbed: { idx: number; text: string }[] = [];
    for (const c of rawChunks) {
      const cText = preprocessText(c.text, this.settings.embedMaxChars + 200);
      if (!cText) continue;
      const h = hashString(cText);
      const old = this.index.getChunk(f.path, c.index);
      if (old && old.hash === h) {
        // 内容未变：复用旧向量（块级增量，效率红利）
        prepared.push({ idx: c.index, text: old.text, hash: h, reuse: old.embedding });
      } else {
        prepared.push({ idx: c.index, text: cText, hash: h });
        toEmbed.push({ idx: c.index, text: cText });
      }
    }
    let vecs: number[][] = [];
    if (toEmbed.length > 0) {
      try {
        vecs = await this.provider.embed(toEmbed.map((t) => t.text));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/context length|input length|too long|exceeds|maximum length/i.test(msg)) {
          // 块级超长保护：截短重试
          vecs = await this.provider.embed(toEmbed.map((t) => preprocessText(t.text, 2000)));
        } else {
          throw e;
        }
      }
    }
    let vi = 0;
    const finalChunks = prepared.map((p) => ({
      idx: p.idx,
      text: p.text,
      hash: p.hash,
      embedding: p.reuse ?? vecs[vi++],
    }));
    this.index.upsertNote(f.path, docHash, finalChunks);
    this.scheduleSaveIndex();
    this.notifyIndexChanged();
    return true;
  }

  /** 手动继续：增量补齐（签名不匹配时先提示重建，确认后清空重算） */
  resumeIndex(): void {
    const currentSig = embeddingSignature(this.settings);
    if (this.index.meta.signature !== currentSig) {
      new ConfirmModal(
        this.app,
        "嵌入模型已变更，需要重建索引",
        "当前索引是用之前的模型计算的，与新模型不匹配。\n将继续索引将清空旧索引并用新模型重新嵌入全部笔记（耗时较长）。\n\n确定继续吗？",
        () => {
          this.index = SemanticIndex.fromJSON(currentSig, null);
          void this.saveIndexNow();
          this.queueAll(true, "full");
        }
      ).open();
      return;
    }
    void this.queueScan(true, "resume");
  }

  /** 停止索引：清空剩余队列，已完成的部分保留（可随时「继续索引」接着跑） */
  stopIndex(): void {
    if (!this.queueRunning && this.queue.length === 0) {
      new Notice("智能关联：当前没有正在进行的索引任务");
      return;
    }
    const remaining = this.queue.length;
    this.queue = [];
    this.stopped = true;
    // 重置进度状态：停止后不再显示「正在索引」（否则 done<total 会让进度条永久残留）
    this.indexTotal = this.indexDone;
    new Notice(
      remaining > 0
        ? `智能关联：已停止索引（跳过剩余 ${remaining} 篇）。已完成的部分已保留，点「继续索引」接着跑。`
        : "智能关联：已停止索引。已完成的部分已保留。"
    );
    this.updateStatus();
  }

  private stopped = false;

  /** 手动重建（清空后全量） */
  async rebuildIndex(): Promise<void> {
    this.index = SemanticIndex.fromJSON(embeddingSignature(this.settings), null);
    await this.saveIndexNow();
    this.queueAll(true, "full");
    this.updateStatus();
  }

  /** 清空索引（仅删缓存，不动笔记） */
  async clearIndex(): Promise<void> {
    this.index = SemanticIndex.fromJSON(embeddingSignature(this.settings), null);
    this.indexTotal = 0;
    this.indexDone = 0;
    await this.saveIndexNow();
    this.updateStatus();
    this.notifyIndexChanged();
  }

  /* ==================== 状态栏 ==================== */

  private initStatusBar(): void {
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("scz-status");
    this.statusBarEl.style.cursor = "pointer";
    this.statusBarEl.addEventListener("click", () => {
      // 索引出错时点击 → 弹出错误详情；正常时 → 打开侧边栏
      if (this.fatalError) {
        new IndexErrorModal(this, this.fatalError).open();
      } else {
        void this.openSidebar();
      }
    });
    this.updateStatus();
  }

  updateStatus(): void {
    const running = this.queueRunning || this.indexDone < this.indexTotal;
    if (this.fatalError) {
      this.statusBarEl.setText(`智能关联：索引出错（点击查看）`);
      this.statusBarEl.addClass("scz-status-error");
      this.notifyProgress();
      return;
    }
    this.statusBarEl.removeClass("scz-status-error");
    if (running && this.indexTotal > 0) {
      const label = this.queueMode === "full" ? "重建索引" : "增量索引";
      this.statusBarEl.setText(
        `智能关联：正在${label} ${Math.min(this.indexDone + 1, this.indexTotal)}/${this.indexTotal}…`
      );
    } else {
      this.statusBarEl.setText(`智能关联：已索引 ${this.index.docCount} 篇`);
    }
    this.notifyProgress();
  }

  /** 广播进度事件（侧边栏 / 设置页监听） */
  private notifyProgress(): void {
    (this.app.workspace as any).trigger(
      "shiyue-related-notes:index-progress",
      this.getIndexProgress()
    );
  }

  /** 索引进度快照（供侧边栏 / 设置页 / 状态栏展示） */
  getIndexProgress(): IndexProgress {
    const running = this.queueRunning || this.indexDone < this.indexTotal;
    return {
      running,
      done: this.indexDone,
      total: this.indexTotal,
      current: this.queue[0]?.name,
      mode: this.queueMode,
    };
  }

  /** 当前索引致命错误（状态栏 / 侧边栏展示用） */
  getFatalError(): string | null {
    return this.fatalError;
  }

  /* ==================== 调优持久化 ==================== */

  /** 保存调优路径（不走 saveSettings，避免触发模型签名检查） */
  async saveTune(up: string[], down: string[]): Promise<void> {
    this.settings.tuneUpPaths = up;
    this.settings.tuneDownPaths = down;
    await this.saveData(this.settings);
  }

  /** 清除全部调优并通知侧边栏 */
  async clearTune(): Promise<void> {
    this.settings.tuneUpPaths = [];
    this.settings.tuneDownPaths = [];
    await this.saveData(this.settings);
    (this.app.workspace as any).trigger("shiyue-related-notes:tune-cleared");
  }

  /* ==================== 智能标签（可选，LLM 生成） ==================== */

  private aiTagInflight = new Map<string, Promise<string[] | null>>();

  private rerankNoticeShown = false;

  /**
   * 统一检索入口（搜索 UI / MCP 共用）：
   * 混合检索（向量+BM25+RRF）→ 可选重排序精排（未启用或失败时回落 RRF 排序）
   */
  async hybridSearchForUI(
    queryText: string,
    queryVector: number[],
    k: number
  ): Promise<HybridResult[]> {
    const s = this.settings;
    const useRerank = s.rerankEnabled && !!s.rerankBaseUrl && !!s.rerankModel;
    if (!useRerank) {
      return this.index.hybridSearch(queryVector, queryText, k, 0);
    }
    const candidates = this.index.hybridSearch(
      queryVector,
      queryText,
      Math.max(k, s.rerankTopK),
      0
    );
    if (candidates.length < 2) return candidates.slice(0, k);
    try {
      const cfg: RerankConfig = {
        provider: s.rerankProvider,
        baseUrl: s.rerankBaseUrl || s.ollamaBaseUrl,
        apiKey: s.rerankApiKey,
        model: s.rerankModel,
        topK: s.rerankTopK,
        timeoutSec: s.requestTimeoutSec,
      };
      const docs = candidates.map((c) => c.chunkHits[0]?.text ?? "");
      const hits: RerankHit[] = await rerankApi(cfg, queryText, docs);
      const seen = new Set<number>();
      const reranked: HybridResult[] = [];
      for (const h of hits) {
        if (seen.has(h.index)) continue;
        seen.add(h.index);
        const cand = candidates[h.index];
        if (!cand) continue;
        reranked.push({ ...cand, score: h.score });
      }
      return reranked.slice(0, k);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!this.rerankNoticeShown) {
        this.rerankNoticeShown = true;
        new Notice(`智能关联：重排序失败，已回落混合检索排序（${msg}）`, 8000);
      }
      return candidates.slice(0, k);
    }
  }

  /**
   * AI 智能标签：带缓存 + 持久化 + 并发去重。
   * 失败/超时/未配置返回 null，调用方回落规则标签，绝不阻塞推荐展示。
   */
  async getAiTag(
    pathA: string,
    pathB: string,
    textA: string,
    textB: string
  ): Promise<string[] | null> {
    if (!this.settings.aiTagsEnabled) return null;
    const key = `${pathA}|${pathB}`;
    const cached = this.settings.aiTagsCache[key];
    if (cached && cached.length > 0) return cached;
    const inflight = this.aiTagInflight.get(key);
    if (inflight) return inflight;
    const p = generateAiTags(this.settings, textA, textB, [])
      .then(async (tags) => {
        this.aiTagInflight.delete(key);
        if (tags) {
          // 控制缓存体积：超 600 条清空重来（标签可再生，重新生成即可）
          if (Object.keys(this.settings.aiTagsCache).length > 600) {
            this.settings.aiTagsCache = {};
          }
          this.settings.aiTagsCache[key] = tags;
          await this.saveData(this.settings);
        }
        return tags;
      })
      .catch(() => {
        this.aiTagInflight.delete(key);
        return null;
      });
    this.aiTagInflight.set(key, p);
    return p;
  }

  /* ==================== 侧边栏 ==================== */

  async openSidebar(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR)[0];
    let leaf = existing;
    if (!leaf) {
      const nl = workspace.getRightLeaf(false);
      if (!nl) return;
      leaf = nl;
      await leaf.setViewState({ type: VIEW_TYPE_SIDEBAR, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  /* ==================== 命令 ==================== */

  private registerCommands(): void {
    this.addCommand({
      id: "open-sidebar",
      name: "打开智能关联面板",
      callback: () => void this.openSidebar(),
    });
    this.addCommand({
      id: "open-search",
      name: "语义搜索",
      callback: () => new SCZSearchModal(this).open(),
    });
    this.addCommand({
      id: "open-chat",
      name: "智能对话（基于笔记）",
      callback: () => new SCZChatModal(this).open(),
    });
    this.addCommand({
      id: "rewrite-selection",
      name: "改写选中文本",
      callback: () => new SCZRewriteModal(this).open(),
    });
    this.addCommand({
      id: "create-note-from-selection",
      name: "从选中内容生成笔记",
      callback: () => new SCZNotesModal(this).open(),
    });
    this.addCommand({
      id: "rebuild-index",
      name: "重建全部语义索引（清空重算）",
      callback: () => {
        new ConfirmModal(this.app, "重建全部索引", "将清空现有索引并重新嵌入全部笔记，确定继续吗？", () =>
          void this.rebuildIndex()
        ).open();
      },
    });
    this.addCommand({
      id: "resume-index",
      name: "继续索引（增量补齐）",
      callback: () => this.resumeIndex(),
    });
    this.addCommand({
      id: "stop-index",
      name: "停止索引（已完成部分保留）",
      callback: () => this.stopIndex(),
    });
    this.addCommand({
      id: "index-status",
      name: "查看索引状态",
      callback: () => new IndexStatusModal(this).open(),
    });
  }
}

/* ==================== 硅基流动免费嵌入教程弹窗 ==================== */

export class SiliconFlowTutorialModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName("免费云端嵌入方案：硅基流动 BAAI/bge-m3").setHeading();
    contentEl.createDiv({
      cls: "scz-confirm-desc",
      text:
        "硅基流动（SiliconFlow）是国内的大模型 API 平台，提供 OpenAI 兼容接口；BAAI/bge-m3 嵌入模型在免费额度内可直接使用（限速内免费）。" +
        "适合不想装本地 Ollama、但想要高质量中文嵌入的用户。",
    });
    const steps = contentEl.createDiv({ cls: "scz-tutorial" });
    const step = (n: string, text: string) => {
      const row = steps.createDiv({ cls: "scz-tutorial-step" });
      row.createSpan({ cls: "scz-tutorial-n", text: n });
      row.createDiv({ cls: "scz-tutorial-text" }).innerHTML = text;
    };
    step(
      "1",
      '注册/登录 <b>siliconflow.cn</b>（硅基流动官网），新用户注册即送额度；bge-m3 嵌入模型在免费层可直接调用。'
    );
    step(
      "2",
      '进入「API 密钥」页面，新建一个 API 密钥并复制（形如 sk-xxx）。'
    );
    step(
      "3",
      '回到本插件设置：嵌入模型提供商选「OpenAI 兼容接口」。'
    );
    step(
      "4",
      'API 地址填 <code>https://api.siliconflow.cn/v1</code>；API Key 粘贴刚才的密钥。'
    );
    step(
      "5",
      '嵌入模型填 <code>BAAI/bge-m3</code>（注意大小写和斜杠都要一致）。'
    );
    step(
      "6",
      '点「测试嵌入连接」，看到「连接成功」即可完成。之后插件会自动重建索引。'
    );
    contentEl.createDiv({
      cls: "scz-confirm-desc",
      text: "隐私说明：此方案下笔记文本会发送给硅基流动接口用于计算向量；介意的话请用 Ollama 本地方案（完全离线）。",
    });
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("我已了解，关闭").setCta().onClick(() => this.close())
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/* ==================== 更新日志弹窗 ==================== */

export class ChangelogModal extends Modal {
  constructor(private plugin: SmartConnectionsZh) {
    super(plugin.app);
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("scz-changelog-modal");
    new Setting(contentEl).setName("更新日志").setHeading();
    const box = contentEl.createDiv({ cls: "scz-changelog" });
    const comp = new Component();
    try {
      const path = `${this.plugin.manifest.dir}/CHANGELOG.md`;
      const adapter = this.app.vault.adapter;
      let md: string | null = null;
      if (adapter && (await adapter.exists(path))) {
        md = await adapter.read(path);
      }
      if (md === null) {
        box.setText("暂无法读取 CHANGELOG.md，最新版本要点请见插件目录内的 README。\n\n1.4.0 要点：重排序精排（可选）、设置帮助图标、嵌入/对话独立选型、模型变更不再自动重建、索引可随时停止。");
      } else {
        await MarkdownRenderer.render(this.app, md, box, "", comp);
      }
    } catch (e) {
      box.setText("更新日志读取失败：" + (e instanceof Error ? e.message : String(e)));
    }
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("关闭").setCta().onClick(() => this.close())
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/* ==================== 索引状态弹窗 ==================== */

export class IndexStatusModal extends Modal {
  constructor(private plugin: SmartConnectionsZh) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("scz-status-modal");
    const s = this.plugin.index.stats();
    const files = this.plugin.app.vault
      .getMarkdownFiles()
      .filter((f) => !this.plugin.isExcluded(f.path));
    const total = files.length;

    new Setting(contentEl).setName("索引状态").setHeading();
    new Setting(contentEl).setName("笔记总数").setDesc("库中可索引的 Markdown 笔记（已排除你设置的文件夹）").addText((t) =>
      t.setValue(String(total)).setDisabled(true)
    );
    new Setting(contentEl).setName("已索引").setDesc("已生成聚合向量的笔记数").addText((t) =>
      t.setValue(`${s.docs}`).setDisabled(true)
    );
    new Setting(contentEl).setName("语义块数").setDesc("分块后的块总数（v2 混合检索粒度）").addText((t) =>
      t.setValue(`${s.chunks} 块`).setDisabled(true)
    );
    new Setting(contentEl).setName("嵌入模型").setDesc("当前使用的模型，切换后会自动重建索引").addText((t) =>
      t.setValue(this.plugin.settings.embeddingProvider === "ollama" ? `${this.plugin.settings.ollamaModel}（Ollama 本地）` : `${this.plugin.settings.embeddingModel}（OpenAI 兼容）`).setDisabled(true)
    );
    new Setting(contentEl).setName("最后更新").addText((t) =>
      t
        .setValue(new Date(s.updated).toLocaleString("zh-CN"))
        .setDisabled(true)
    );
    new Setting(contentEl)
      .setName("继续索引（增量补齐）")
      .setDesc("只嵌入未索引或内容已修改的笔记，已索引的直接跳过，速度快")
      .addButton((b) =>
        b.setButtonText("继续索引").onClick(() => {
          this.plugin.resumeIndex();
          this.close();
        })
      );
    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("重建全部索引")
        .setCta()
        .onClick(() => {
          new ConfirmModal(
            this.plugin.app,
            "重建全部索引",
            "将清空现有索引并重新嵌入全部笔记，确定继续吗？",
            () => {
              void this.plugin.rebuildIndex();
              this.close();
            }
          ).open();
        })
    );
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("清空索引").onClick(() => {
        new ConfirmModal(
          this.plugin.app,
          "清空索引",
          "将删除全部已缓存的嵌入向量（笔记本身不受影响），确定吗？",
          () => {
            void this.plugin.clearIndex();
            this.close();
          }
        ).open();
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/* ==================== 索引错误详情弹窗 ==================== */

export class IndexErrorModal extends Modal {
  constructor(
    private plugin: SmartConnectionsZh,
    private errMsg: string
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName("索引出错").setHeading();
    contentEl.createDiv({ cls: "scz-confirm-desc", text: `原因：${this.errMsg}` });
    contentEl.createDiv({
      cls: "scz-confirm-desc",
      text: "修复配置后，点击「继续索引」即可接着跑完，已索引的笔记不会丢失。",
    });
    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("继续索引（增量补齐）")
        .onClick(() => {
          this.close();
          this.plugin.resumeIndex();
        })
    );
    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("重建全部索引")
        .setCta()
        .onClick(() => {
          this.close();
          void this.plugin.rebuildIndex();
        })
    );
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("打开设置").onClick(() => {
        this.close();
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById("shiyue-related-notes");
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** 通用确认弹窗 */
export class ConfirmModal extends Modal {
  constructor(
    app: import("obsidian").App,
    private title: string,
    private desc: string,
    private onConfirm: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName(this.title).setHeading();
    contentEl.createDiv({ text: this.desc, cls: "scz-confirm-desc" });
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("取消").onClick(() => this.close())
    );
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("确定").setCta().onClick(() => {
        this.close();
        this.onConfirm();
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
