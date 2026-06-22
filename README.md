# InContext

> **Explain any selection — grounded in the whole page, not just the snippet.**
> 划选网页中的任意一段，基于大模型对**整篇文章**的理解给出解释，并可就这段**多轮追问**。

普通划词翻译只把你选中的那一小段丢给模型，解释脱离语境。**InContext 不一样**：它先用 Readability 抽取当前页的整篇正文，把全文作为上下文喂给模型，让它解释"这段在**这篇文章里**到底什么意思"——作者意图、隐含信息、专有名词指代，全都结合上下文。

---

## ✨ 特性

- **基于全文的解释**：抽取整页正文作为 grounding，而非孤立翻译选中段。
- **多轮追问**：侧栏对话，就这一段继续问，历史带上下文。
- **多语种输出**：解释语言可任意指定（中文 / English / 日本語 …），对话中也能即时切。
- **BYOK · OpenAI 兼容**：用你自己的 API Key，支持 DeepSeek / GLM / OpenAI / 任意 OpenAI 兼容服务。Key 仅存本地浏览器。
- **流式输出**：边生成边显示。
- **三种触发**：划词浮按钮 / 右键菜单 / 快捷键 `Ctrl+Shift+E`。

## 🚀 安装（开发者模式加载）

1. 下载/克隆本仓库到本地。
2. 打开 Chrome，地址栏输入 `chrome://extensions`。
3. 右上角打开 **开发者模式**。
4. 点 **加载已解压的扩展程序**，选择本项目文件夹（含 `manifest.json` 的那层）。
5. 完成。建议把图标固定到工具栏。

## ⚙️ 配置

点扩展图标 → 侧栏右上角 ⚙ 设置（或在 `chrome://extensions` 里点"扩展程序选项"）：

- **模型服务商**：选 DeepSeek / GLM / OpenAI / 自定义。
- **Base URL / 模型**：选预设后自动填，可手改。
- **API Key**：填你自己的 key。
- **解释输出语言**：默认中文。
- 想先看交互不接模型？勾上 **Mock**。

## 📖 用法

在任意网页选中一段文字 → 点浮出的「解释」按钮（或右键菜单 / 快捷键）→ 侧栏给出结合全文的解释 → 在下方输入框继续追问。

## 🧱 架构

```
Content Script  监听划词 → 浮按钮 → Readability 抽全文 + 选区前后文 → 发给 background
      │
Background      存选区数据(session) → 打开 Side Panel → 通知刷新
      │
Side Panel      组装 prompt(全文+选区) → 调模型(流式) → 多轮对话 UI
```

核心 prompt 把整篇文章注入 system，让模型"结合全文语境"解释选中段——见 `src/prompt.js`。

## 📂 目录

```
manifest.json          MV3 清单
src/content.js/.css     划词检测 + 浮按钮 + 全文抽取
src/background.js       消息中枢 / 侧栏 / 右键 / 快捷键
src/sidepanel.*         对话界面
src/options.*           BYOK 设置页
src/prompt.js           ★ 全文 grounding 核心 prompt
src/llm.js              OpenAI 兼容流式客户端（含 mock）
src/markdown.js         轻量 markdown 渲染
vendor/Readability.js   Mozilla Readability（MIT）
```

## 🗺️ Roadmap

- [ ] 超长网页：摘要缓存 / RAG 切块检索（当前 MVP 为截断）
- [ ] PDF 页面支持
- [ ] 解释结果一键复制 / 收藏
- [ ] 划词即时小窗（不开侧栏的轻量模式）

## 📄 License

MIT
