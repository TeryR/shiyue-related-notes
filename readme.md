# 智能关联（shiyue-related-notes）

**这是 Smart Connections 的中文版** Obsidian 插件。原版（[brianpetro/obsidian-smart-connections](https://github.com/brianpetro/obsidian-smart-connections)）功能很强，但界面是英文。本项目是功能复刻：**界面、设置、命令、提示、文档全部简体中文**，不是官方翻译，与原作者 Brian Petro 无关联。

一句话：让 Obsidian 读懂你笔记的意思——打开一篇笔记，自动找出库里语义最相近的其他笔记。

---

## ✅ 能做什么

- **侧边栏智能推荐**：打开任意笔记，右侧自动列出语义最相近的笔记（带相似度百分比和摘要），点 ＋/－ 即时调整"这类结果多点/少点"
- **语义搜索**：用自然语言搜，比如搜「关于减脂期蛋白质摄入的笔记」就能命中相关内容，不用记得关键词
- **混合检索**：向量 + 关键词（BM25 + RRF）两路一起查，人名、代码、型号这类精确词也能搜到
- **长笔记分块索引**：长文切成语义块逐块索引，修改只重嵌变化的块，不整篇重来
- **Smart View**：在笔记里写 ` ```smart-connections ` 代码块内嵌相似笔记列表，语法与原版兼容
- **智能对话**：基于你自己的笔记回答问题（拿相关笔记当上下文）
- **改写选中文本 / 从选中内容生成笔记**
- **增量索引**：笔记新增、修改、删除后台自动更新；状态栏实时显示「已索引 X 篇」
- **完全本地**：设置、索引、嵌入缓存全在本机，没有账号、没有云端依赖（除非你自己选云端模型）

## ❌ 不能做什么

- **没有 Smart Collections**（原版的实验性自动聚类），未实现
- **没有持久调优**：＋/－ 反馈只在当前会话生效，重启重置（原版 Smart Tune 需要上传反馈数据微调，本项目坚持本地优先，没做）
- **不能没有模型空跑**：语义功能必须接一个嵌入模型（本地 Ollama 或云端 API 二选一），什么都不配就是用不了
- **和英文原版数据不互通**：从原版换过来要重新索引一次（大库几分钟），旧索引数据带不过来
- **未上架 Obsidian 官方插件市场**，只能手动安装（见下）
- **移动端未做适配测试**：manifest 没有限制移动端，但本地 Ollama 手机上没法跑，云端接口理论上可用、没测过，别指望开箱即用

## 📋 需要什么

| 项目 | 要求 |
|------|------|
| Obsidian | 1.4.0 及以上 |
| 嵌入模型（必须） | 二选一：① 本地 [Ollama](https://ollama.com/)（免费离线，推荐 `bge-m3`，中文效果最好）② OpenAI 兼容接口（有免费方案，见下） |
| 对话模型（可选） | 只用推荐/搜索可以完全不配。要用智能对话/改写/生成，再配一个：Ollama `qwen2.5:7b`（免费离线）或 OpenAI 兼容接口或 Anthropic 接口 |
| 首次索引时间 | 大库（千篇级）几分钟，之后都是后台增量 |
| API Key（选云端才有） | 只存在本机插件数据文件里（`data.json`），不上传任何服务器 |

---

## 🚀 安装（手动）

1. 到 [Releases](../../releases) 下载最新版 `shiyue-related-notes-x.x.x.zip`
2. 解压，得到 `main.js`、`manifest.json`、`styles.css`
3. 放进你的笔记库：`.obsidian/plugins/shiyue-related-notes/`（文件夹名必须是这个）
4. Obsidian → 设置 → 第三方插件 → 关闭安全模式（如果开着）→ 启用「智能关联」

## ⚙️ 配置（第一次使用必看）

打开 设置 → 智能关联。嵌入模型和对话模型是两个独立配置区，各自可选本地或云端，每个参数旁有 ⓘ 说明。

### 方案 A：本地 Ollama（免费、离线、推荐）

```
ollama pull bge-m3        # 嵌入模型，负责语义匹配
ollama pull qwen2.5:7b    # 对话模型，不需要对话功能可以不拉
```

设置里把两个提供商都切到 **Ollama 本地（离线）**，默认地址 `http://127.0.0.1:11434` 不用改，分别点「测试嵌入连接」「测试对话连接」。

### 方案 B：OpenAI 兼容接口（在线）

填 API 地址、API Key、嵌入模型（默认 `text-embedding-3-small`）、对话模型（默认 `gpt-4o-mini`），点「测试嵌入连接」。

> 💡 **免费云端方案**：硅基流动（SiliconFlow）提供免费的 `BAAI/bge-m3` 嵌入模型（注册即用，限速内免费）。设置页点「免费云端方案（硅基流动 bge-m3）教程」看 6 步接入教程。

### 方案 C：Anthropic 接口（仅对话）

对话模型提供商选 **Anthropic 兼容接口**，填 API 地址（默认 `https://api.anthropic.com`）、Key（`sk-ant-` 开头）、模型（如 `claude-3-5-haiku-latest`）。注意：Anthropic 没有嵌入接口，嵌入模型仍需 Ollama 或 OpenAI。

配置完成后状态栏显示「智能关联：正在索引…」，跑完就能用。

## 📖 使用

- **侧边栏**：点左侧栏 ✨ 图标，或命令面板「打开智能关联面板」
- **语义搜索**：命令面板 →「语义搜索」
- **Smart View**：笔记里插入（三个参数都可选）：
  ````markdown
  ```smart-connections
  minSimilarity: 0.4
  maxResults: 10
  maxCharacters: 500
  ```
  ````
- **智能对话**：命令面板 →「智能对话（基于笔记）」
- **改写/生成**：选中文字 → 命令面板 →「改写选中文本」或「从选中内容生成笔记」

更多见 [使用指南](docs/使用指南.md)。

## 📦 与英文原版的对应关系

| 原版功能 | 中文版 | 状态 |
|---------|--------|------|
| Smart Connections 侧边栏 | 侧边栏智能推荐（含调优反馈） | ✅ 完整 |
| Smart Search | 语义搜索 | ✅ 完整 |
| Smart View | Smart View（语法兼容） | ✅ 完整 |
| Smart Chat | 智能对话（含保存对话） | ✅ 完整 |
| Smart Rewrite | 改写选中文本 | ✅ 完整 |
| Smart Notes | 从选中内容生成笔记 | ✅ 完整 |
| 索引状态/重建 | 索引状态/重建/清空 | ✅ 完整 |
| Smart Tune（持久调优） | 会话级 ＋/－ 调优 | ⚠️ 简化 |
| Smart Collections（实验性聚类） | — | ⬜ 未包含 |

逐项对照见 [功能对照表](docs/功能对照表.md)。

## 🧪 测试情况

用真实中文嵌入模型（bge-m3，本机 Ollama）在 1209 篇笔记的测试库上验证，全部断言通过：中文 top-5 推荐命中率、混合检索命中率、英文笔记不退化、全量索引后台完成、查询毫秒级。详见 [测试报告](docs/测试报告.md)。

## ❓ 常见问题

见 [常见问题](docs/常见问题.md)。

## 🛠 开发者

```bash
npm install                        # 安装依赖
npm run dev                        # 开发模式（监听编译）
npm run build                      # 生产构建 → main.js
npm run typecheck                  # 类型检查
node test/generate-vault.cjs       # 生成测试库
node test/run-tests.cjs            # 运行自动化测试（需本机 Ollama + bge-m3）
```

更新记录见 [changelog.md](changelog.md)。

## 🗂 数据与隐私

- 所有数据（设置、语义索引、嵌入缓存）只存在本机，不依赖外部服务器
- 语义索引文件：`.obsidian/plugins/shiyue-related-notes/embeddings.json`
- 删除插件前想保留索引：先备份上述文件，恢复时放回原位
- API Key 只在本机 `data.json`，**分享笔记库前先删掉它**

## 📄 许可证

MIT。本项目是 Smart Connections 的功能复刻（中文重写），与原作者 Brian Petro 无关联。
