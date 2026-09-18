/**
 * 设置模型（纯数据，不依赖 Obsidian，便于测试）
 */

/** 嵌入（向量化）提供商 */
export type EmbeddingProviderType = "ollama" | "openai";
/** 对话提供商（Anthropic 无嵌入接口，所以嵌入与对话分开配置） */
export type ChatProviderType = "ollama" | "openai" | "anthropic";

export interface SCZSettings {
  /* ---- 嵌入（向量化）模型：本地 or 云端 ---- */
  embeddingProvider: EmbeddingProviderType;
  /* ---- 对话模型：本地 or 云端 ---- */
  chatProvider: ChatProviderType;
  /* ---- OpenAI 兼容接口（嵌入用） ---- */
  openaiBaseUrl: string;
  openaiApiKey: string;
  embeddingModel: string;
  chatModel: string;
  /* ---- 对话专用 OpenAI 兼容连接（与嵌入相互独立；留空则沿用嵌入的地址/Key） ---- */
  chatOpenaiBaseUrl: string;
  chatOpenaiApiKey: string;
  /* ---- Ollama 本地模型 ---- */
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaChatModel: string;
  /* ---- Anthropic 兼容接口（仅对话） ---- */
  anthropicBaseUrl: string;
  anthropicApiKey: string;
  anthropicModel: string;
  /* ---- 推荐与索引 ---- */
  maxResults: number;
  minSimilarity: number;
  excludedFolders: string[];
  autoIndex: boolean;
  /** 单块目标大小（字符，默认 800） */
  embedMaxChars: number;
  /** 整篇笔记参与语义的上限（字符，超出截断，默认 16000） */
  noteMaxChars: number;
  batchSize: number;
  requestTimeoutSec: number;
  chatMaxContextNotes: number;
  retryAttempts: number;
  /* ---- 调优（持久化，重启不丢） ---- */
  tuneUpPaths: string[];
  tuneDownPaths: string[];
  /* ---- 智能标签（LLM 生成「为什么相关」词组，可选） ---- */
  aiTagsEnabled: boolean;
  aiTagsCache: Record<string, string[]>;
  /* ---- 重排序精排（可选，需支持 rerank 的端点） ---- */
  rerankEnabled: boolean;
  rerankProvider: "ollama" | "openai-compat";
  rerankBaseUrl: string;
  rerankApiKey: string;
  rerankModel: string;
  rerankTopK: number;
}

export const DEFAULT_SETTINGS: SCZSettings = {
  embeddingProvider: "openai",
  chatProvider: "openai",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiApiKey: "",
  embeddingModel: "text-embedding-3-small",
  chatModel: "gpt-4o-mini",
  chatOpenaiBaseUrl: "",
  chatOpenaiApiKey: "",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "bge-m3",
  ollamaChatModel: "qwen2.5:7b",
  anthropicBaseUrl: "https://api.anthropic.com",
  anthropicApiKey: "",
  anthropicModel: "claude-3-5-haiku-latest",
  maxResults: 5,
  minSimilarity: 0.4,
  excludedFolders: [],
  autoIndex: true,
  embedMaxChars: 800,
  noteMaxChars: 16000,
  batchSize: 32,
  requestTimeoutSec: 60,
  chatMaxContextNotes: 5,
  retryAttempts: 3,
  tuneUpPaths: [],
  tuneDownPaths: [],
  aiTagsEnabled: true,
  aiTagsCache: {},
  rerankEnabled: false,
  rerankProvider: "openai-compat",
  rerankBaseUrl: "",
  rerankApiKey: "",
  rerankModel: "BAAI/bge-reranker-v2-m3",
  rerankTopK: 50,
};

/** 嵌入配置的指纹：模型/接口任一变化都意味着旧向量失效，需要重建索引 */
export function embeddingSignature(s: SCZSettings): string {
  if (s.embeddingProvider === "ollama") {
    return `ollama|${s.ollamaBaseUrl}|${s.ollamaModel}`;
  }
  return `openai|${s.openaiBaseUrl}|${s.embeddingModel}`;
}

/** 兼容旧版本设置：v1 的单一 provider 字段拆分为嵌入/对话两个提供商；v1 的 embedMaxChars（整篇截断）迁移为单块大小 + 整篇上限 */
export function migrateSettings(raw: unknown): SCZSettings {
  const s = { ...DEFAULT_SETTINGS, ...(raw as Partial<SCZSettings>) } as SCZSettings;
  const legacy = raw as Partial<SCZSettings> & { provider?: string };
  if (legacy.provider && !s.embeddingProvider) {
    s.embeddingProvider = legacy.provider === "ollama" ? "ollama" : "openai";
    s.chatProvider = legacy.provider === "ollama" ? "ollama" : "openai";
  }
  if (!s.embeddingProvider) s.embeddingProvider = "openai";
  if (!s.chatProvider) s.chatProvider = "openai";
  // v1.x：embedMaxChars 曾是整篇截断上限（4000+），v2 语义改为单块大小（800）
  if (legacy.embedMaxChars && legacy.embedMaxChars >= 1500) {
    s.noteMaxChars = legacy.embedMaxChars;
    s.embedMaxChars = 800;
  }
  if (!s.noteMaxChars) s.noteMaxChars = 16000;
  // 对话专用连接：老数据没有这两个字段时，继承一次嵌入的地址/Key（之后两边独立修改）
  const r2 = raw as Record<string, unknown>;
  if (r2.chatOpenaiBaseUrl === undefined) s.chatOpenaiBaseUrl = "";
  if (r2.chatOpenaiApiKey === undefined) s.chatOpenaiApiKey = s.openaiApiKey;
  return s;
}
