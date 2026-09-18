/**
 * 智能对话（Smart Chat） / 改写选中文本 / 从选中内容生成笔记
 */

import {
  Modal,
  MarkdownRenderer,
  Notice,
  MarkdownView,
  TFile,
  Component,
} from "obsidian";
import type SmartConnectionsZh from "./main";
import type { ChatMessage } from "./embedder";
import { chatStream } from "./embedder";
import { preprocessText } from "./utils";

/** 把常见的模型错误翻译成中文提示 */
function chatErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/context length|input length|too long|exceeds|maximum length/i.test(msg)) {
    return "（内容超出对话模型上下文长度）请尝试：缩短输入；或在设置 → 高级 中把「对话引用笔记数」调小（如改为 2）；或换上下文更长的模型。";
  }
  return `（出错了）${msg}`;
}

/* ==================== 智能对话 ==================== */

export class SCZChatModal extends Modal {
  private plugin: SmartConnectionsZh;
  private messages: ChatMessage[] = [];
  private msgEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private contextBadge!: HTMLElement;
  private abortCtrl: AbortController | null = null;
  private streaming = false;
  private mdComp = new Component();

  constructor(plugin: SmartConnectionsZh) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("scz-chat-modal");

    const header = contentEl.createDiv({ cls: "scz-chat-header" });
    header.createSpan({ cls: "scz-chat-title", text: "智能对话" });
    this.contextBadge = header.createSpan({ cls: "scz-badge", text: "" });
    const newBtn = header.createEl("button", { cls: "scz-btn", text: "新对话" });
    newBtn.addEventListener("click", () => {
      this.messages = [];
      this.msgEl.empty();
      this.addAssistantMsg("你好，我是「智能关联」的 AI 助手。我会参考你笔记里的相关内容来回答问题，请问你想了解什么？");
    });
    const saveBtn = header.createEl("button", { cls: "scz-btn", text: "保存对话" });
    saveBtn.addEventListener("click", () => void this.saveConversation());

    this.msgEl = contentEl.createDiv({ cls: "scz-chat-messages" });
    this.addAssistantMsg("你好，我是「智能关联」的 AI 助手。我会参考你笔记里的相关内容来回答问题，请问你想了解什么？");

    const inputRow = contentEl.createDiv({ cls: "scz-chat-input-row" });
    this.inputEl = inputRow.createEl("textarea", {
      cls: "scz-chat-input",
      attr: { placeholder: "输入问题，回车发送（Shift+回车换行）…", rows: "2" },
    });
    this.sendBtn = inputRow.createEl("button", { cls: "scz-btn scz-btn-primary", text: "发送" });
    this.stopBtn = inputRow.createEl("button", { cls: "scz-btn", text: "停止" });
    this.stopBtn.hide();

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.send();
      }
    });
    this.sendBtn.addEventListener("click", () => void this.send());
    this.stopBtn.addEventListener("click", () => this.abortCtrl?.abort());

    setTimeout(() => this.inputEl.focus(), 50);
  }

  onClose(): void {
    this.abortCtrl?.abort();
    this.mdComp.unload();
    this.contentEl.empty();
  }

  private addAssistantMsg(text: string): HTMLElement {
    const bubble = this.msgEl.createDiv({ cls: "scz-chat-msg scz-chat-assistant" });
    bubble.setText(text);
    return bubble;
  }

  private async send(): Promise<void> {
    const q = this.inputEl.value.trim();
    if (!q || this.streaming) return;
    const cs = this.plugin.settings;
    const missingKey =
      cs.chatProvider === "openai"
        ? !cs.openaiApiKey
        : cs.chatProvider === "anthropic"
        ? !cs.anthropicApiKey
        : false;
    if (missingKey) {
      new Notice("尚未配置对话模型 API Key，请到设置 → 模型与连接 中填写");
      return;
    }
    this.inputEl.value = "";
    this.messages.push({ role: "user", content: q });

    const userBubble = this.msgEl.createDiv({ cls: "scz-chat-msg scz-chat-user" });
    userBubble.setText(q);

    /* 用问题检索相关笔记作为上下文（总量预算，避免超出模型上下文） */
    let contextText = "";
    try {
      const vecs = await this.plugin.provider.embed([preprocessText(q, 500)]);
      const notes = await this.plugin.index.similarToQuery(
        vecs[0],
        this.plugin.settings.chatMaxContextNotes,
        0.3
      );
      if (notes.length > 0) {
        const parts: string[] = [];
        let budget = 3000; // 引用内容总预算（字符），防止超出模型上下文
        for (const n of notes) {
          if (budget <= 0) break;
          const f = this.app.vault.getAbstractFileByPath(n.path);
          if (!(f instanceof TFile)) continue;
          const raw = await this.app.vault.cachedRead(f);
          const text = preprocessText(raw, Math.min(800, budget));
          if (text) {
            parts.push(`【笔记：${n.path}】\n${text}`);
            budget -= text.length;
          }
        }
        contextText = parts.join("\n\n");
        this.contextBadge.setText(`参考了 ${notes.length} 篇笔记`);
      }
    } catch {
      /* 检索失败不阻塞对话 */
    }

    const sysMsg: ChatMessage = {
      role: "system",
      content:
        "你是 Obsidian 笔记库「智能关联」插件的 AI 助手。请始终用简体中文回答，回答要简洁、有条理。" +
        (contextText
          ? "\n\n以下是用户笔记库中与问题可能相关的笔记内容（未必都相关，请自行判断）：\n\n" + contextText
          : ""),
    };

    const bubble = this.msgEl.createDiv({ cls: "scz-chat-msg scz-chat-assistant" });
    bubble.setText("思考中…");
    this.streaming = true;
    this.sendBtn.hide();
    this.stopBtn.show();
    this.abortCtrl = new AbortController();

    let full = "";
    try {
      full = await chatStream(
        this.plugin.settings,
        [sysMsg, ...this.messages.slice(-6)], // 只保留最近 6 条历史，防止上下文膨胀
        (delta) => {
          full += delta;
          bubble.setText(full);
          bubble.scrollIntoView({ block: "nearest" });
        },
        this.abortCtrl.signal
      );
    } catch (e) {
      bubble.setText(chatErrorText(e));
    } finally {
      this.streaming = false;
      this.stopBtn.hide();
      this.sendBtn.show();
      this.abortCtrl = null;
    }

    if (full) {
      bubble.empty();
      await MarkdownRenderer.render(
        this.app,
        full,
        bubble,
        "",
        this.mdComp
      );
      this.messages.push({ role: "assistant", content: full });
    }
    this.inputEl.focus();
  }

  private async saveConversation(): Promise<void> {
    if (this.messages.length === 0) {
      new Notice("还没有可保存的对话");
      return;
    }
    const lines = this.messages.map((m) => `**${m.role === "user" ? "我" : "AI"}**：${m.content}`);
    const body = `# 智能对话 ${new Date().toLocaleString("zh-CN")}\n\n${lines.join("\n\n")}\n`;
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    let name = `智能对话-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}`;
    let path = `${name}.md`;
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${name}-${i++}.md`;
    }
    await this.app.vault.create(path, body);
    new Notice(`对话已保存：${path}`);
  }
}

/* ==================== 改写选中文本 ==================== */

export class SCZRewriteModal extends Modal {
  private plugin: SmartConnectionsZh;
  private selection = "";

  constructor(plugin: SmartConnectionsZh) {
    super(plugin.app);
    this.plugin = plugin;
    const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const sel = view?.editor.getSelection() ?? "";
    this.selection = sel.trim();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("scz-rewrite-modal");

    if (!this.selection) {
      contentEl.createDiv({
        cls: "scz-empty",
        text: "请先在编辑器中选中要改写的文本，再运行此命令。",
      });
      return;
    }

    contentEl.createDiv({ cls: "scz-chat-title", text: "改写选中文本" });
    const bubble = contentEl.createDiv({ cls: "scz-chat-msg scz-chat-assistant" });
    bubble.setText("正在改写…");

    const btns = contentEl.createDiv({ cls: "scz-chat-input-row" });
    const replaceBtn = btns.createEl("button", { cls: "scz-btn scz-btn-primary", text: "替换原文" });
    const copyBtn = btns.createEl("button", { cls: "scz-btn", text: "复制" });
    const closeBtn = btns.createEl("button", { cls: "scz-btn", text: "关闭" });

    replaceBtn.disabled = true;
    copyBtn.disabled = true;
    closeBtn.addEventListener("click", () => this.close());

    let full = "";
    const ctrl = new AbortController();
    void chatStream(
      this.plugin.settings,
      [
        {
          role: "system",
          content: "你是一位中文写作助手。请改写用户提供的文本：保持原意不变，使表达更清晰、流畅、自然，纠正错别字与不通顺的句子。只输出改写后的文本，不要任何解释。",
        },
        { role: "user", content: this.selection },
      ],
      (delta) => {
        full += delta;
        bubble.setText(full);
      },
      ctrl.signal
    )
      .catch((e) => {
        bubble.setText(chatErrorText(e));
      })
      .finally(() => {
        if (full) {
          replaceBtn.disabled = false;
          copyBtn.disabled = false;
        }
      });

    replaceBtn.addEventListener("click", () => {
      const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (view && full) {
        view.editor.replaceSelection(full);
        new Notice("已替换原文");
      }
      this.close();
    });
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(full);
      new Notice("已复制到剪贴板");
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/* ==================== 从选中内容生成笔记 ==================== */

export class SCZNotesModal extends Modal {
  private plugin: SmartConnectionsZh;
  private source = "";

  constructor(plugin: SmartConnectionsZh) {
    super(plugin.app);
    this.plugin = plugin;
    const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const sel = view?.editor.getSelection() ?? "";
    this.source = sel.trim();
    if (!this.source) {
      // 无选中时退回用整篇笔记
      const file = plugin.app.workspace.getActiveFile();
      if (file) {
        void plugin.app.vault.cachedRead(file).then((t) => {
          this.source = t.slice(0, 4000);
        });
      }
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("scz-notes-modal");

    if (!this.source) {
      contentEl.createDiv({
        cls: "scz-empty",
        text: "请先选中内容，或打开一篇笔记后再运行此命令。",
      });
      return;
    }

    contentEl.createDiv({ cls: "scz-chat-title", text: "生成笔记" });
    const bubble = contentEl.createDiv({ cls: "scz-chat-msg scz-chat-assistant" });
    bubble.setText("正在生成…");

    const btns = contentEl.createDiv({ cls: "scz-chat-input-row" });
    const saveBtn = btns.createEl("button", { cls: "scz-btn scz-btn-primary", text: "保存为笔记" });
    const copyBtn = btns.createEl("button", { cls: "scz-btn", text: "复制" });
    const closeBtn = btns.createEl("button", { cls: "scz-btn", text: "关闭" });

    saveBtn.disabled = true;
    copyBtn.disabled = true;
    closeBtn.addEventListener("click", () => this.close());

    let full = "";
    const ctrl = new AbortController();
    void chatStream(
      this.plugin.settings,
      [
        {
          role: "system",
          content:
            "你是一位中文笔记整理助手。请根据用户提供的内容，生成一篇结构清晰的中文 Markdown 笔记：第一行用一级标题概括主题，正文分小节（用二级标题），提炼要点并适当补充解释。只输出 Markdown 笔记内容。",
        },
        { role: "user", content: this.source },
      ],
      (delta) => {
        full += delta;
        bubble.setText(full);
      },
      ctrl.signal
    )
      .catch((e) => {
        bubble.setText(chatErrorText(e));
      })
      .finally(() => {
        if (full) {
          saveBtn.disabled = false;
          copyBtn.disabled = false;
        }
      });

    saveBtn.addEventListener("click", async () => {
      const titleMatch = full.match(/^#\s+(.+)$/m);
      let title = (titleMatch?.[1] ?? "智能笔记").trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);
      if (!title) title = "智能笔记";
      let path = `${title}.md`;
      let i = 1;
      while (this.app.vault.getAbstractFileByPath(path)) {
        path = `${title}-${i++}.md`;
      }
      await this.app.vault.create(path, full);
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(false).openFile(file);
      }
      new Notice(`笔记已保存：${path}`);
      this.close();
    });
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(full);
      new Notice("已复制到剪贴板");
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
