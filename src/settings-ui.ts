/**
 * 中文设置面板 v2.2
 * - 嵌入（向量化）模型与对话模型各自独立配置提供商（Ollama 本地 / OpenAI 兼容 / Anthropic 兼容）
 * - OpenAI 兼容连接参数按归属显示：嵌入区/对话区各自的地址与 Key
 * - 每个可调参数带 ⓘ 帮助图标；设置保存 800ms 防抖（避免逐字符输入触发重建）
 * - 更新日志入口（关于区）
 */

import { App, Modal, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
import type SmartConnectionsZh from "./main";
import type { IndexProgress } from "./main";
import { ConfirmModal, ChangelogModal } from "./main";
import type { SCZSettings } from "./settings";
import { chatStream } from "./embedder";

/** 在设置行名称后加帮助图标：点击弹出参数说明（作用 / 影响 / 建议） */
function addHelp(setting: Setting, title: string, detail: string): void {
  const icon = setting.nameEl.createSpan({
    cls: "scz-help-icon",
    text: "ⓘ",
    attr: { "aria-label": title },
  });
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    new Notice(`${title}\n\n${detail}`, 8000);
  });
}

export class SCZSettingsTab extends PluginSettingTab {
  plugin: SmartConnectionsZh;
  private progressEl: HTMLElement | null = null;
  private progressFillEl: HTMLElement | null = null;
  private progressTextEl: HTMLElement | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(app: App, plugin: SmartConnectionsZh) {
    super(app, plugin);
    this.plugin = plugin;
    // 设置页打开期间实时接收索引进度（注册在插件上，随插件生命周期清理）
    this.plugin.registerEvent(
      (this.app.workspace as any).on("shiyue-related-notes:index-progress", (p: IndexProgress) =>
        this.refreshProgress(p)
      )
    );
  }

  /** 设置保存防抖：文本输入逐字符 onChange 只在停顿 800ms 后真正保存一次，避免中间态触发索引重建 */
  private requestSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.plugin.saveSettings();
    }, 800);
  }

  hide(): void {
    // 离开设置页时冲刷未保存的修改
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      void this.plugin.saveSettings();
    }
    super.hide();
  }

  /** 冲刷防抖中的保存（用于触发页面重绘、测试连接等需要最新配置的场景） */
  private async flushSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      await this.plugin.saveSettings();
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = () => this.plugin.settings;
    const save = () => this.requestSave();

    /* ==================== 嵌入模型（向量化） ==================== */
    new Setting(containerEl).setName("嵌入模型（向量化）").setHeading();

    const embedProviderSetting = new Setting(containerEl)
      .setName("嵌入模型提供商")
      .setDesc("负责把笔记转成语义向量；本地免费离线，云端效果稳定")
      .addDropdown((d) =>
        d
          .addOption("ollama", "Ollama 本地（离线，免费）")
          .addOption("openai", "OpenAI 兼容接口（云端）")
          .setValue(s().embeddingProvider)
          .onChange(async (v) => {
            s().embeddingProvider = v as SCZSettings["embeddingProvider"];
            await this.flushSave();
            this.display();
          })
      );
    addHelp(
      embedProviderSetting,
      "嵌入模型提供商",
      "作用：决定笔记怎么被转成向量，是所有语义推荐的基础。\n\n选择建议：\n· Ollama 本地：免费、离线、隐私最好，中文推荐 bge-m3，效果已验证。\n· OpenAI 兼容：需要 API Key，text-embedding-3-small 便宜且中文不错；也可以填硅基流动等免费/低价服务（见下方教程按钮）。\n\n切换提供商或模型后，插件会自动重建全部索引（旧向量与新模型不兼容）。"
    );

    if (s().embeddingProvider === "openai") {
      const embModelSetting = new Setting(containerEl)
        .setName("嵌入模型")
        .setDesc("OpenAI 兼容接口使用的嵌入模型名")
        .addText((t) =>
          t
            .setPlaceholder("text-embedding-3-small")
            .setValue(s().embeddingModel)
            .onChange(async (v) => {
              s().embeddingModel = v.trim() || "text-embedding-3-small";
              save();
            })
        );
      addHelp(
        embModelSetting,
        "嵌入模型",
        "作用：计算笔记语义向量的模型。\n\n选型建议：\n· text-embedding-3-small：OpenAI 官方默认，便宜、中文效果好，1536 维。\n· BAAI/bge-m3：配合硅基流动等平台使用，免费额度内可用，1024 维，中文效果最佳。\n\n注意：输入是防抖保存的（停顿约 1 秒才生效），改完等一下再测试连接。切换模型会自动重建索引。"
      );
    } else {
      const ollamaUrlSetting = new Setting(containerEl)
        .setName("Ollama 服务地址")
        .setDesc("Ollama 默认监听本机 11434 端口")
        .addText((t) =>
          t
            .setPlaceholder("http://127.0.0.1:11434")
            .setValue(s().ollamaBaseUrl)
            .onChange(async (v) => {
              s().ollamaBaseUrl = v.trim().replace(/\/+$/, "") || "http://127.0.0.1:11434";
              save();
            })
        );
      addHelp(
        ollamaUrlSetting,
        "Ollama 服务地址",
        "作用：连接本地 Ollama 服务的地址。\n\n默认 http://127.0.0.1:11434 不用改。如果 Ollama 装在别的机器/端口，改成对应的 http://IP:端口。\n\nOllama 没启动时，索引会停止并提示「网络请求失败」，先启动 Ollama 再点「继续索引」。"
      );

      const ollamaModelSetting = new Setting(containerEl)
        .setName("嵌入模型")
        .setDesc("推荐 bge-m3（中文效果最佳）。首次使用需运行：ollama pull bge-m3")
        .addText((t) =>
          t
            .setPlaceholder("bge-m3")
            .setValue(s().ollamaModel)
            .onChange(async (v) => {
              s().ollamaModel = v.trim() || "bge-m3";
              await save();
            })
        );
      addHelp(
        ollamaModelSetting,
        "嵌入模型",
        "作用：本地计算笔记向量的模型。\n\n选型建议：\n· bge-m3：推荐，中文效果最佳，1024 维，上下文 8192。\n· 其他模型：nomic-embed-text（小、英文好）、mxbai-embed-large 等，中文效果普遍不如 bge-m3。\n\n未安装时运行 ollama pull bge-m3；切换模型会自动重建索引。"
      );
    }

    /* ==================== 连接参数（嵌入用，OpenAI 兼容） ==================== */
    if (s().embeddingProvider === "openai") {
      new Setting(containerEl).setName("OpenAI 兼容连接（嵌入使用；对话有独立配置）").setHeading();

      const baseSetting = new Setting(containerEl)
        .setName("API 地址")
        .setDesc("OpenAI 兼容接口地址，如 https://api.openai.com/v1 或国内中转")
        .addText((t) =>
          t
            .setPlaceholder("https://api.openai.com/v1")
            .setValue(s().openaiBaseUrl)
            .onChange(async (v) => {
              s().openaiBaseUrl = v.trim().replace(/\/+$/, "");
              save();
            })
        );
      addHelp(
        baseSetting,
        "API 地址",
        "作用：OpenAI 兼容请求发往的接口地址。\n\n只要是 OpenAI 兼容的接口都能用：OpenAI 官方、Azure OpenAI、硅基流动（https://api.siliconflow.cn/v1）、国内中转服务等。\n\n注意：地址要带 /v1（硅基流动同样以 /v1 结尾）；填错会报「模型不存在或接口地址有误」。"
      );

      const keySetting = new Setting(containerEl)
        .setName("API Key")
        .setDesc("仅保存在本机插件数据中，不上传任何服务器；输入框默认掩码")
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("sk-…").setValue(s().openaiApiKey).onChange(async (v) => {
            s().openaiApiKey = v.trim();
            save();
          });
        });
      addHelp(
        keySetting,
        "API Key",
        "作用：访问云端接口的凭证。\n\n安全说明：\n· 只保存在本机插件目录 data.json（Obsidian 标准做法）。\n· 千万不要把整个笔记库分享给别人，Key 会一起泄露。\n· 输入框默认掩码显示。\n\nKey 无效或过期时索引会停止，状态栏变红提示，修复后点「继续索引」即可。"
      );
    }

    /* 嵌入测试按钮（紧跟嵌入区） */
    if (s().embeddingProvider === "openai") {
      new Setting(containerEl)
        .addButton((b) =>
          b
            .setButtonText("测试嵌入连接")
            .setCta()
            .onClick(async () => {
              // 先冲刷防抖中的保存，确保测试用的是最新配置
              if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
                await this.plugin.saveSettings();
              }
              b.setButtonText("测试中…").setDisabled(true);
              const r = this.plugin.provider.test();
              b.setButtonText("测试嵌入连接").setDisabled(false);
              void r.then((res) =>
                new Notice(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`, 8000)
              );
            })
        )
        .addButton((b) =>
          b.setButtonText("免费云端方案（硅基流动 bge-m3）").onClick(() => {
            new SiliconFlowTutorialModal(this.app).open();
          })
        )
        .addButton((b) =>
          b.setButtonText("打开模型教程").onClick(() => {
            new Notice(
              "安装本地模型：\n1. 安装 Ollama（ollama.com）并启动\n2. 运行：ollama pull bge-m3\n3. 本设置页选「Ollama 本地」→ 测试连接",
              10000
            );
          })
        );
    } else {
      new Setting(containerEl)
        .addButton((b) =>
          b
            .setButtonText("测试嵌入连接")
            .setCta()
            .onClick(async () => {
              b.setButtonText("测试中…").setDisabled(true);
              const r = await this.plugin.provider.test();
              b.setButtonText("测试嵌入连接").setDisabled(false);
              new Notice(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`, 8000);
            })
        )
        .addButton((b) =>
          b.setButtonText("打开模型教程").onClick(() => {
            new Notice(
              "安装本地模型：\n1. 安装 Ollama（ollama.com）并启动\n2. 运行：ollama pull bge-m3\n3. 本设置页选「Ollama 本地」→ 测试连接",
              10000
            );
          })
        );
    }

    /* ==================== 对话模型 ==================== */
    new Setting(containerEl).setName("对话模型（智能对话 / 改写 / 生成笔记）").setHeading();

    const chatProviderSetting = new Setting(containerEl)
      .setName("对话模型提供商")
      .setDesc("用于智能对话、改写选中文本、生成笔记；与嵌入模型相互独立，改这里不会触发重建索引")
      .addDropdown((d) =>
        d
          .addOption("ollama", "Ollama 本地（离线，免费）")
          .addOption("openai", "OpenAI 兼容接口（云端）")
          .addOption("anthropic", "Anthropic 兼容接口（云端）")
          .setValue(s().chatProvider)
          .onChange(async (v) => {
            s().chatProvider = v as SCZSettings["chatProvider"];
            await this.flushSave();
            this.display();
          })
      );
    addHelp(
      chatProviderSetting,
      "对话模型提供商",
      "作用：决定「智能对话 / 改写 / 生成笔记」用哪个模型生成文字。\n\n与嵌入模型相互独立，可以嵌入用本地、对话用云端，反之亦然；修改对话配置不会触发索引重建。\n\n· Ollama 本地：免费离线，推荐 qwen2.5:7b（ollama pull qwen2.5:7b）。\n· OpenAI 兼容：gpt-4o-mini 性价比高；API 地址与 Key 在上方「OpenAI 兼容连接」区共用。\n· Anthropic 兼容：Claude 系列（注意：Anthropic 没有嵌入接口，嵌入模型仍需选 Ollama 或 OpenAI）。"
    );

    if (s().chatProvider === "ollama") {
      const ollamaChatSetting = new Setting(containerEl)
        .setName("对话模型")
        .setDesc("首次使用需运行：ollama pull qwen2.5:7b（轻量可选 qwen2.5:1.5b）")
        .addText((t) =>
          t
            .setPlaceholder("qwen2.5:7b")
            .setValue(s().ollamaChatModel)
            .onChange(async (v) => {
              s().ollamaChatModel = v.trim() || "qwen2.5:7b";
              save();
            })
        );
      addHelp(
        ollamaChatSetting,
        "对话模型",
        "作用：本地生成回答的模型。\n\n· qwen2.5:7b：推荐，中文好、速度快。\n· 电脑配置有限可用 qwen2.5:1.5b（更小更快）。\n· 配置高可换 qwen2.5:14b 或更大模型。\n\n对话内容超长会报错，可调小「对话引用笔记数」或缩短输入。"
      );
    } else if (s().chatProvider === "openai") {
      const chatUrlSetting = new Setting(containerEl)
        .setName("对话 API 地址")
        .setDesc("对话专用的 OpenAI 兼容地址；留空则自动沿用嵌入区的 API 地址")
        .addText((t) =>
          t
            .setPlaceholder("默认同嵌入接口")
            .setValue(s().chatOpenaiBaseUrl)
            .onChange(async (v) => {
              s().chatOpenaiBaseUrl = v.trim().replace(/\/+$/, "");
              save();
            })
        );
      addHelp(
        chatUrlSetting,
        "对话 API 地址",
        "作用：对话请求发往的接口地址，与嵌入接口相互独立。\n\n留空 = 自动沿用嵌入区的 API 地址。需要对话和嵌入用不同服务商时（如嵌入用本地、对话用云端），在这里单独填写。"
      );

      const chatKeySetting = new Setting(containerEl)
        .setName("对话 API Key")
        .setDesc("对话专用 Key；留空则自动沿用嵌入区的 Key")
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("留空则同嵌入 Key").setValue(s().chatOpenaiApiKey).onChange(async (v) => {
            s().chatOpenaiApiKey = v.trim();
            save();
          });
        });
      addHelp(
        chatKeySetting,
        "对话 API Key",
        "作用：访问对话接口的凭证，与嵌入 Key 相互独立。\n\n留空 = 自动沿用嵌入区的 Key。适合嵌入和对话用不同服务商的情况。"
      );

      const openaiChatSetting = new Setting(containerEl)
        .setName("对话模型")
        .setDesc("如 gpt-4o-mini、deepseek-chat 等")
        .addText((t) =>
          t
            .setPlaceholder("gpt-4o-mini")
            .setValue(s().chatModel)
            .onChange(async (v) => {
              s().chatModel = v.trim() || "gpt-4o-mini";
              save();
            })
        );
      addHelp(
        openaiChatSetting,
        "对话模型",
        "作用：云端生成回答的模型。\n\n· gpt-4o-mini：OpenAI 官方，便宜够用。\n· deepseek-chat：DeepSeek 官方/硅基流动等平台，中文好、便宜。\n\n注意：模型名必须与所用平台一致。"
      );
    } else {
      const anthropicUrlSetting = new Setting(containerEl)
        .setName("Anthropic API 地址")
        .setDesc("Anthropic 官方或兼容中转地址")
        .addText((t) =>
          t
            .setPlaceholder("https://api.anthropic.com")
            .setValue(s().anthropicBaseUrl)
            .onChange(async (v) => {
              s().anthropicBaseUrl = v.trim().replace(/\/+$/, "") || "https://api.anthropic.com";
              await save();
            })
        );
      addHelp(
        anthropicUrlSetting,
        "Anthropic API 地址",
        "作用：Anthropic 兼容对话接口的地址。\n\n官方为 https://api.anthropic.com（内部自动拼 /v1/messages）。支持任何 Anthropic 兼容的中转服务。"
      );

      const anthropicKeySetting = new Setting(containerEl)
        .setName("Anthropic API Key")
        .setDesc("以 sk-ant- 开头；仅保存在本机")
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("sk-ant-…").setValue(s().anthropicApiKey).onChange(async (v) => {
            s().anthropicApiKey = v.trim();
            await save();
          });
        });
      addHelp(
        anthropicKeySetting,
        "Anthropic API Key",
        "作用：访问 Claude 对话接口的凭证，通常以 sk-ant- 开头。\n\n安全说明与 OpenAI Key 相同：只存本机 data.json，分享笔记库前先删除。"
      );

      const anthropicModelSetting = new Setting(containerEl)
        .setName("对话模型")
        .setDesc("如 claude-3-5-haiku-latest（快）或 claude-3-5-sonnet-latest（强）")
        .addText((t) =>
          t
            .setPlaceholder("claude-3-5-haiku-latest")
            .setValue(s().anthropicModel)
            .onChange(async (v) => {
              s().anthropicModel = v.trim() || "claude-3-5-haiku-latest";
              await save();
            })
        );
      addHelp(
        anthropicModelSetting,
        "对话模型",
        "作用：Claude 系列生成回答的模型。\n\n· claude-3-5-haiku-latest：快、便宜，日常够用。\n· claude-3-5-sonnet-latest：更强，贵一些。\n\n注意：Anthropic 没有嵌入接口，嵌入模型请在上面的「嵌入模型」区选择。"
      );
    }

    if (s().chatProvider !== "ollama") {
      new Setting(containerEl)
        .addButton((b) =>
          b
            .setButtonText("测试对话连接")
            .onClick(async () => {
              b.setButtonText("测试中…").setDisabled(true);
              // 先冲刷防抖中的保存，确保测试用的是最新配置
              if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
                await this.plugin.saveSettings();
              }
              const cs = s();
              const missing =
                cs.chatProvider === "openai"
                  ? !(cs.chatOpenaiApiKey || cs.openaiApiKey)
                  : cs.chatProvider === "anthropic"
                  ? !cs.anthropicApiKey
                  : false;
              if (missing) {
                new Notice("尚未配置对话模型 API Key");
                b.setButtonText("测试对话连接").setDisabled(false);
                return;
              }
              try {
                let out = "";
                await chatStream(
                  cs,
                  [{ role: "user", content: "你好，请只回复四个字：连接成功" }],
                  (d) => (out += d),
                  new AbortController().signal
                );
                new Notice(`✅ 对话连接成功：${out.slice(0, 80)}`, 8000);
              } catch (e) {
                new Notice(`❌ 对话连接失败：${e instanceof Error ? e.message : String(e)}`, 8000);
              }
              b.setButtonText("测试对话连接").setDisabled(false);
            })
        )
        .addButton((b) =>
          b.setButtonText("打开模型教程").onClick(() => {
            new Notice(
              "云端对话模型：\n· OpenAI 兼容：填上方 API 地址与 Key，对话模型如 gpt-4o-mini\n· Anthropic 兼容：填 sk-ant- 开头的 Key，模型如 claude-3-5-haiku-latest\n\n本地对话模型：\n· ollama pull qwen2.5:7b 后，提供商切「Ollama 本地」",
              12000
            );
          })
        );
    }

    /* ==================== 重排序精排（可选） ==================== */
    new Setting(containerEl).setName("重排序精排（可选，进阶）").setHeading();

    const rrEnabledSetting = new Setting(containerEl)
      .setName("启用重排序精排")
      .setDesc("搜索时先用混合检索粗排 50 条，再交给重排序模型精排，头部结果更准；未启用或失败时自动用混合检索排序兑底")
      .addToggle((t) =>
        t.setValue(s().rerankEnabled).onChange(async (v) => {
          s().rerankEnabled = v;
          save();
          this.display();
        })
      );
    addHelp(
      rrEnabledSetting,
      "启用重排序精排",
      "作用：两阶段检索——先混合检索粗排出 50 条候选，再把查询与这 50 条一起交给重排序模型打分，按精排分重新排序。\n\n效果：头部结果（前 5）精确度提升最明显的一步。\n\n端点要求（二选一）：\n· Ollama 新版（支持 /api/rerank，如拉了 bge-reranker-v2-m3）\n· OpenAI 兼容 /rerank 端点：硅基流动（BAAI/bge-reranker-v2-m3）、Jina、Cohere 等均支持\n\n注意：本机 Ollama 0.33.x 实测不支持 /api/rerank；未配置或调用失败时自动回落混合检索排序，不影响使用。"
    );

    if (s().rerankEnabled) {
      const rrProviderSetting = new Setting(containerEl)
        .setName("重排序端点类型")
        .setDesc("OpenAI 兼容 = 硅基流动/Jina/Cohere 风格的 /rerank 接口")
        .addDropdown((d) =>
          d
            .addOption("openai-compat", "OpenAI 兼容 /rerank（云端）")
            .addOption("ollama", "Ollama /api/rerank（需新版）")
            .setValue(s().rerankProvider)
            .onChange(async (v) => {
              s().rerankProvider = v as SCZSettings["rerankProvider"];
              save();
              this.display();
            })
        );
      addHelp(
        rrProviderSetting,
        "重排序端点类型",
        "作用：重排序请求发往的接口类型。\n\n· OpenAI 兼容：POST {地址}/rerank，Bearer 认证——硅基流动、Jina、Cohere 等均为此风格。\n· Ollama：POST {地址}/api/rerank——需 Ollama 新版本。"
      );

      if (s().rerankProvider === "openai-compat") {
        const rrKeySetting = new Setting(containerEl)
          .setName("重排序 API Key")
          .setDesc("与嵌入同平台（如硅基流动）时可沿用同一个 Key")
          .addText((t) => {
            t.inputEl.type = "password";
            t.setPlaceholder("sk-…").setValue(s().rerankApiKey).onChange(async (v) => {
              s().rerankApiKey = v.trim();
              save();
            });
          });
        addHelp(
          rrKeySetting,
          "重排序 API Key",
          "作用：访问重排序端点的凭证。与嵌入同平台（如都在硅基流动）时可填同一个 Key。"
        );
      }

      const rrUrlSetting = new Setting(containerEl)
        .setName("重排序端点地址")
        .setDesc(s().rerankProvider === "openai-compat" ? "如 https://api.siliconflow.cn/v1" : "默认同 Ollama 服务地址")
        .addText((t) =>
          t
            .setPlaceholder(
              s().rerankProvider === "openai-compat" ? "https://api.siliconflow.cn/v1" : "http://127.0.0.1:11434"
            )
            .setValue(s().rerankBaseUrl)
            .onChange(async (v) => {
              s().rerankBaseUrl = v.trim().replace(/\/+$/, "");
              save();
            })
        );
      addHelp(
        rrUrlSetting,
        "重排序端点地址",
        "作用：重排序请求发往的地址。留空时 Ollama 类型自动沿用上方 Ollama 服务地址。"
      );

      const rrModelSetting = new Setting(containerEl)
        .setName("重排序模型")
        .setDesc(
          s().rerankProvider === "openai-compat"
            ? "如 BAAI/bge-reranker-v2-m3（硅基流动）"
            : "如 bge-reranker-v2-m3（需 ollama pull）"
        )
        .addText((t) =>
          t
            .setPlaceholder("BAAI/bge-reranker-v2-m3")
            .setValue(s().rerankModel)
            .onChange(async (v) => {
              s().rerankModel = v.trim() || "BAAI/bge-reranker-v2-m3";
              save();
            })
        );
      addHelp(
        rrModelSetting,
        "重排序模型",
        "作用：给候选项重新打分的模型（交叉编码器）。\n\n推荐：BAAI/bge-reranker-v2-m3（中文效果好，多语言）。"
      );

      new Setting(containerEl)
        .addButton((b) =>
          b
            .setButtonText("测试重排序")
            .onClick(async () => {
              b.setButtonText("测试中…").setDisabled(true);
              try {
                const cfg = {
                  provider: s().rerankProvider,
                  baseUrl: s().rerankBaseUrl || (s().rerankProvider === "ollama" ? s().ollamaBaseUrl : ""),
                  apiKey: s().rerankApiKey,
                  model: s().rerankModel,
                  topK: 5,
                  timeoutSec: s().requestTimeoutSec,
                };
                const rr = await import("./rerank").then((m) => m.rerank(cfg, "手冲咖啡", ["手冲咖啡的参数", "深蹲训练要点"]));
                new Notice(`✅ 重排序连接成功，返回 ${rr.length} 条打分`, 8000);
              } catch (e) {
                new Notice(`❌ ${e instanceof Error ? e.message : String(e)}`, 10000);
              }
              b.setButtonText("测试重排序").setDisabled(false);
            })
        );
    }

    /* ==================== 推荐与索引 ==================== */
    new Setting(containerEl).setName("推荐与索引").setHeading();

    const maxResSetting = new Setting(containerEl)
      .setName("推荐数量")
      .setDesc("侧边栏与 Smart View 默认展示的相关笔记条数（1–100）")
      .addSlider((sl) =>
        sl
          .setLimits(1, 100, 1)
          .setValue(s().maxResults)
          .setDynamicTooltip()
          .onChange(async (v) => {
            s().maxResults = v;
            save();
          })
      );
    addHelp(
      maxResSetting,
      "推荐数量",
      "作用：侧边栏和 Smart View 一次显示多少条相关笔记。\n\n影响：\n· 调大 → 看更多候选，但质量靠后的会被拉进来（结合最低相似度过滤）。\n· 调小 → 更精简。\n\n建议：默认 5 即可；想多探索调到 8-10。"
    );

    const minSimSetting = new Setting(containerEl)
      .setName("最低相似度")
      .setDesc("相似度低于此值的笔记不会出现在推荐里（0–1）")
      .addSlider((sl) =>
        sl
          .setLimits(0, 100, 5)
          .setValue(Math.round(s().minSimilarity * 100))
          .setDynamicTooltip()
          .onChange(async (v) => {
            s().minSimilarity = v / 100;
            save();
          })
      );
    addHelp(
      minSimSetting,
      "最低相似度",
      "作用：推荐结果的过滤门槛——余弦相似度低于该值的笔记直接不显示。\n\n影响（实测数据，bge-m3）：\n· 0.2–0.4：命中率持平（79%），推荐更多但不掺水。\n· 0.5：开始漏掉弱相关但正确的结果。\n· 0.6：明显过严，部分笔记直接无结果。\n\n建议：默认 0.4 是甜点；推荐太少就调低到 0.3，太多再往上微调，别超过 0.5。"
    );

    const autoIndexSetting = new Setting(containerEl)
      .setName("自动索引")
      .setDesc("笔记新增、修改、删除后自动增量更新语义索引")
      .addToggle((t) =>
        t.setValue(s().autoIndex).onChange(async (v) => {
          s().autoIndex = v;
          save();
        })
      );
    addHelp(
      autoIndexSetting,
      "自动索引",
      "作用：监听笔记库变化，自动把新建/修改的笔记加入索引队列。\n\n影响：\n· 开启：改完笔记约 1.5 秒后自动更新，推荐始终跟手。\n· 关闭：需要手动点「继续索引」才会更新，一般不建议关。\n\n关闭状态下，手动「继续索引」仍然可用。"
    );

    new Setting(containerEl)
      .setName("排除的文件夹")
      .setDesc("这些文件夹内的笔记不参与索引与推荐（如 附件、模板、日记、.trash）");
    this.renderExcludedFolders(containerEl);

    /* ==================== 高级 ==================== */
    new Setting(containerEl).setName("高级").setHeading();

    const chunkSizeSetting = new Setting(containerEl)
      .setName("单块大小")
      .setDesc("长笔记切块的目标字符数（默认 800）；块是语义计算的基本单位")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s().embedMaxChars)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (n > 0) {
            s().embedMaxChars = n;
            save();
          }
        });
      });
    addHelp(
      chunkSizeSetting,
      "单块大小",
      "作用：长笔记会被切成若干「语义块」，每块独立计算向量，这是 v2 混合检索的基础。\n\n影响：\n· 调小 → 块更细、检索更精准，但块数增多（索引体积和耗时略升）。\n· 调大 → 块更粗、每块信息更多，但局部语义容易被稀释。\n\n建议：默认 800 是 RAG 实践的常用值；追求极致精准可调 500，追求效率可调 1200。\n\n注意：修改后需要「重建全部索引」才会对已有笔记生效。"
    );

    const noteMaxSetting = new Setting(containerEl)
      .setName("整篇笔记参与上限")
      .setDesc("超过此字符数的笔记截断处理（默认 16000，约 20 个块），控制极端长文的索引成本")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s().noteMaxChars)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (n > 0) {
            s().noteMaxChars = n;
            save();
          }
        });
      });
    addHelp(
      noteMaxSetting,
      "整篇笔记参与上限",
      "作用：单篇笔记参与语义计算的总字符上限，超出部分截断（分块阶段执行）。\n\n影响：\n· 调大 → 超长笔记的尾部内容也能被检索到，但索引耗时和体积上升。\n· 调小 → 省时间，但超长笔记的尾部信息丢失。\n\n建议：默认 16000（约 20 块）；库中笔记普遍超长可调到 32000。\n\n注意：修改后需要「重建全部索引」才会对已有笔记生效。"
    );

    const batchSetting = new Setting(containerEl)
      .setName("单批请求条数")
      .setDesc("嵌入接口每批发送的文本条数，一般无需修改")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s().batchSize)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (n > 0) {
            s().batchSize = n;
            save();
          }
        });
      });
    addHelp(
      batchSetting,
      "单批请求条数",
      "作用：每次嵌入请求打包多少块一起发送。\n\n影响：\n· 调大 → 请求次数少、总耗时略降，但单次请求更长。\n· 调小 → 更稳，适合接口有单批限制的情况。\n\n建议：默认 32，一般不用动。"
    );

    const timeoutSetting = new Setting(containerEl)
      .setName("请求超时（秒）")
      .setDesc("单个接口请求的超时时间，网络不稳定时可调大")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s().requestTimeoutSec)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (n > 0) {
            s().requestTimeoutSec = n;
            await save();
          }
        });
      });
    addHelp(
      timeoutSetting,
      "请求超时（秒）",
      "作用：单个接口请求等多久算失败。\n\n影响：\n· 调大 → 大模型/慢网络更不容易误判超时，但失败后等待更久。\n· 调小 → 快速失败重试，适合本地模型。\n\n建议：Ollama 本地 60 够用；云端大模型可调到 90-120。"
    );

    const retrySetting = new Setting(containerEl)
      .setName("嵌入请求重试次数")
      .setDesc("网络波动、限流、服务端错误时的自动重试次数（1–5）")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s().retryAttempts)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (n >= 1 && n <= 5) {
            s().retryAttempts = n;
            await save();
          }
        });
      });
    addHelp(
      retrySetting,
      "嵌入请求重试次数",
      "作用：遇到瞬时错误（网络波动、429 限流、5xx 服务端错误）时自动重试几次。\n\n错误按类型分流：\n· 瞬时类 → 退避重试（本参数控制次数）。\n· 内容超长 → 自动降级截断后重试，不需要你干预。\n· 配置类（Key 无效/模型缺失）→ 不盲目重试，直接提示修复。\n\n建议：默认 3；网络很差可调到 4-5。"
    );

    const chatCtxSetting = new Setting(containerEl)
      .setName("对话引用笔记数")
      .setDesc("智能对话时最多参考几篇与问题相关的笔记")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s().chatMaxContextNotes)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (n > 0) {
            s().chatMaxContextNotes = n;
            await save();
          }
        });
      });
    addHelp(
      chatCtxSetting,
      "对话引用笔记数",
      "作用：智能对话时，从库里检索几篇相关笔记作为回答依据。\n\n影响：\n· 调大 → 回答依据更充分，但上下文变长，容易触发「内容超出上下文长度」。\n· 调小 → 更省上下文，回答依据变少。\n\n建议：默认 5；报上下文超长时改 2-3。"
    );

    /* ==================== 索引管理 ==================== */
    new Setting(containerEl).setName("索引管理").setHeading();
    this.renderIndexProgress(containerEl);
    this.renderIndexStats(containerEl);

    const resumeSetting = new Setting(containerEl)
      .setName("继续索引（增量补齐）")
      .setDesc("只嵌入未索引或内容已修改的笔记，已索引的直接跳过——日常补跑、索引中断后接着跑都用这个")
      .addButton((b) =>
        b.setButtonText("继续索引").onClick(() => {
          this.plugin.resumeIndex();
        })
      );
    addHelp(
      resumeSetting,
      "继续索引（增量补齐）",
      "作用：把「还没索引的 + 内容改过的」笔记补进索引，已索引的直接跳过（v2 是块级跳过，改一小段只重算变化的那几个块）。\n\n什么时候用：\n· 索引中断/出错后接着跑。\n· 大量导入新笔记后。\n· 日常发现某篇新笔记没进推荐。\n· 嵌入模型变更后：用新模型重建（会先弹确认）。\n\n速度快，不会重算已完成的笔记。"
    );

    new Setting(containerEl)
      .setName("停止索引")
      .setDesc("停止当前正在进行的索引任务；已完成的部分全部保留，随时可用「继续索引」接着跑")
      .addButton((b) =>
        b.setButtonText("停止索引").onClick(() => {
          this.plugin.stopIndex();
        })
      );

    const rebuildSetting = new Setting(containerEl)
      .setName("重建全部索引（清空重算）")
      .setDesc("清空全部向量后重新计算，耗时较长——仅换模型、索引损坏或结果明显不对时使用")
      .addButton((b) =>
        b
          .setButtonText("重建全部索引")
          .setCta()
          .onClick(() => {
            new ConfirmModal(
              this.app,
              "重建全部索引",
              "将清空现有索引并重新嵌入全部笔记（耗时较长），确定继续吗？",
              () => void this.plugin.rebuildIndex()
            ).open();
          })
      );
    addHelp(
      rebuildSetting,
      "重建全部索引（清空重算）",
      "作用：清空全部向量缓存，从头重新嵌入所有笔记。\n\n什么时候用（只有两种情况）：\n· 换了嵌入模型或接口（切换时插件会自动重建，无需手动）。\n· 索引损坏或推荐结果明显不对。\n\n注意：耗时与全库大小成正比，误点会白等，所以有确认弹窗。日常用「继续索引」就够了。"
    );

    new Setting(containerEl).addButton((b) =>
      b.setButtonText("清空索引").onClick(() => {
        new ConfirmModal(
          this.app,
          "清空索引",
          "将删除全部已缓存的嵌入向量（笔记本身不受影响），确定吗？",
          () => void this.plugin.clearIndex()
        ).open();
      })
    );

    const tuneSetting = new Setting(containerEl)
      .setName("调优状态")
      .setDesc("侧边栏推荐中用 ＋/－ 调整的偏好，已持久化保存，重启不丢")
      .addText((t) =>
        t
          .setValue(`${s().tuneUpPaths.length + s().tuneDownPaths.length} 条`)
          .setDisabled(true)
      )
      .addButton((b) =>
        b.setButtonText("清除调优").onClick(async () => {
          await this.plugin.clearTune();
          new Notice("已清除调优");
          this.display();
        })
      );
    addHelp(
      tuneSetting,
      "调优状态",
      "作用：显示当前有多少条调优偏好（侧边栏推荐里点 ＋/－ 产生）。\n\n调优只是微调推荐排序（改查询方向），不影响索引与向量缓存；重启后依然生效。点「清除调优」一键全部还原。"
    );

    const aiTagSetting = new Setting(containerEl)
      .setName("智能标签（AI，可选增强）")
      .setDesc("用对话模型为每对相关笔记生成更准确的共同主题词（如「手冲咖啡 · 粉水比」），替代规则标签")
      .addToggle((t) =>
        t.setValue(s().aiTagsEnabled).onChange(async (v) => {
          s().aiTagsEnabled = v;
          save();
        })
      );
    addHelp(
      aiTagSetting,
      "智能标签（AI，可选增强）",
      "作用：侧边栏每条推荐下方的「相关:」标签，默认由本地规则计算（即时、免费）；开启本开关后，改由你配置的对话模型生成更准确的共同主题词（如「手冲咖啡 · 粉水比」），并缓存到本机，同一笔记对只生成一次。\n\n说明：\n· 需要在上方「对话模型」配置好模型（本地 Ollama 或云端）。\n· 生成在后台异步进行，先显示规则标签，生成完自动替换。\n· 失败/超时/未配置对话模型 → 自动回落规则标签，绝不影响推荐展示。\n· 关闭开关 = 只用规则标签。"
    );

    new Setting(containerEl).setName("关于").setHeading();
    new Setting(containerEl)
      .setName("查看更新日志")
      .setDesc("各版本的新增 / 变更 / 修复记录")
      .addButton((b) =>
        b.setButtonText("查看").onClick(() => {
          new ChangelogModal(this.plugin).open();
        })
      );
    containerEl.createDiv({
      cls: "setting-item-description",
      text: "智能关联（Smart Connections 中文版）v1.4.1 —— 分块 + 混合检索（BM25 + 向量 + RRF）+ 可选重排序。语义索引与全部数据仅保存在本机。",
    });
  }

  /** 索引进度条（实时） */
  private renderIndexProgress(containerEl: HTMLElement): void {
    this.progressEl = containerEl.createDiv({ cls: "scz-progress scz-progress-settings" });
    const bar = this.progressEl.createDiv({ cls: "scz-progress-bar" });
    this.progressFillEl = bar.createDiv({ cls: "scz-progress-fill" });
    this.progressTextEl = this.progressEl.createDiv({ cls: "scz-progress-text" });
    this.refreshProgress(this.plugin.getIndexProgress());
  }

  private refreshProgress(p: IndexProgress): void {
    if (!this.progressEl || !this.progressEl.isConnected || !this.progressFillEl || !this.progressTextEl) return;
    if (!p.running || p.total === 0) {
      this.progressEl.hide();
      return;
    }
    this.progressEl.show();
    const pct = Math.min(100, Math.round((p.done / p.total) * 100));
    this.progressFillEl.style.width = `${pct}%`;
    const label = p.mode === "full" ? "正在重建全部索引" : "正在增量索引";
    this.progressTextEl.setText(
      `${label} ${Math.min(p.done + 1, p.total)}/${p.total}（${pct}%）${p.current ? ` · ${p.current}` : ""}`
    );
  }

  private renderExcludedFolders(containerEl: HTMLElement): void {
    const wrap = containerEl.createDiv({ cls: "scz-excluded" });
    const refresh = () => {
      wrap.empty();
      const folders = this.plugin.app.vault
        .getAllLoadedFiles()
        .filter((f): f is TFolder => f instanceof TFolder)
        .map((f) => f.path)
        .sort();

      if (this.plugin.settings.excludedFolders.length > 0) {
        for (const folder of this.plugin.settings.excludedFolders) {
          const row = wrap.createDiv({ cls: "scz-excluded-row" });
          row.createSpan({ text: folder, cls: "scz-excluded-name" });
          row.createEl("button", { text: "移除", cls: "scz-excluded-remove" }).addEventListener(
            "click",
            async () => {
              this.plugin.settings.excludedFolders = this.plugin.settings.excludedFolders.filter(
                (x) => x !== folder
              );
              await this.plugin.saveSettings();
              this.plugin.pruneExcluded();
              refresh();
            }
          );
        }
      } else {
        wrap.createDiv({
          cls: "setting-item-description",
          text: "尚未排除任何文件夹（.trash、.obsidian 等隐藏目录始终自动排除）",
        });
      }

      const picker = wrap.createDiv({ cls: "scz-excluded-picker" });
      const select = picker.createEl("select");
      const available = folders.filter(
        (f) =>
          f !== "/" &&
          !f.startsWith(".") &&
          !this.plugin.settings.excludedFolders.includes(f)
      );
      for (const f of available) {
        select.createEl("option", { value: f, text: f });
      }
      const btn = picker.createEl("button", { text: "添加排除", cls: "scz-btn" });
      btn.addEventListener("click", async () => {
        const v = select.value;
        if (v && !this.plugin.settings.excludedFolders.includes(v)) {
          this.plugin.settings.excludedFolders.push(v);
          await this.plugin.saveSettings();
          this.plugin.pruneExcluded();
          refresh();
        }
      });
    };
    refresh();
  }

  private renderIndexStats(containerEl: HTMLElement): void {
    const s = this.plugin.index.stats();
    const total = this.plugin.app.vault
      .getMarkdownFiles()
      .filter((f) => !this.plugin.isExcluded(f.path)).length;

    new Setting(containerEl)
      .setName("已索引")
      .setDesc("已生成聚合向量的笔记数 / 可索引笔记总数")
      .addText((t) => t.setValue(`${s.docs} / ${total}`).setDisabled(true));

    new Setting(containerEl)
      .setName("语义块数")
      .setDesc("分块后的块总数（每块独立向量，v2 混合检索粒度）")
      .addText((t) => t.setValue(`${s.chunks} 块`).setDisabled(true));

    new Setting(containerEl)
      .setName("嵌入模型")
      .setDesc("当前签名，与设置一致时无需重建")
      .addText((t) => t.setValue(s.signature).setDisabled(true));

    new Setting(containerEl)
      .setName("最后更新时间")
      .addText((t) =>
        t.setValue(new Date(s.updated).toLocaleString("zh-CN")).setDisabled(true)
      );
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
    const step = (n: string, html: string) => {
      const row = steps.createDiv({ cls: "scz-tutorial-step" });
      row.createSpan({ cls: "scz-tutorial-n", text: n });
      row.createDiv({ cls: "scz-tutorial-text" }).innerHTML = html;
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
