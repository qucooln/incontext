# 各渠道首发文案（上线当天用）

---

## Product Hunt
**Name:** InContext
**Tagline:** Explain any selection — grounded in the whole page, not the snippet
**Description:**
Most "explain selection" tools only send the highlighted text to the AI, so the answer is out of context. InContext extracts the whole article first and explains what your selection means *in this specific article* — author's intent, implied meaning, what a term refers to here.

- Whole‑page grounding (not just the snippet)
- Multi‑turn follow‑ups, any output language
- Optional cited web search ([n] sources, bilingual disambiguated queries)
- 15+ models, bring your own key (DeepSeek, GLM, Claude, OpenAI, Gemini…)
- No backend — keys & data stay in your browser

Open source (MIT). Would love your feedback! 🙏

**First comment (maker):** Built this because I kept highlighting jargon in long articles and wanting "what does this mean *here*", not a dictionary definition. The whole‑article grounding + cited web search turned out to be the magic. AMA about the architecture (MV3, BYOK, hybrid search).

---

## Reddit — r/chrome_extensions, r/SideProject, r/LocalLLaMA(BYOK 角度)
**Title:** I built a Chrome extension that explains highlighted text using the *whole article* as context (open source, BYOK, 15+ models)

**Body:**
Selection translators send only the snippet to the model, so explanations lose context. I made **InContext**: it extracts the full article with Readability and grounds the explanation in it — so it tells you what the passage means *in this article*, not a generic definition.

Features: multi‑turn follow‑ups, any output language, optional **cited web search** (search engine fetches data, your model writes the answer with [n] sources, bilingual disambiguated queries so "ReAct" the LLM pattern doesn't return "React" the framework), 15+ providers incl. native Claude, all BYOK with keys stored locally.

No backend, MIT licensed: https://github.com/qucooln/incontext
Feedback very welcome — what would make you actually use this daily?

> 注意 Reddit 反硬广，用第一人称分享 + 真诚求反馈，别像广告；先混脸熟、回复评论。

---

## 掘金 / 少数派 / 即刻（中文）
**标题**：我做了个 Chrome 插件：划词不再是孤立翻译，而是"结合整篇文章"解释这段话

**正文要点**：
- 痛点：现有划词工具只把选中片段发给 AI，解释脱离上下文。
- 我的做法：先用 Readability 抽全文当背景，让模型解释"这段在**这篇**里到底什么意思"——作者意图、隐含信息、术语真实所指。
- 加料：多轮追问、多语输出、**联网并标注来源**（搜索引擎取数+你的模型作答+[n] 上标；检索词结合上下文、中英双语、自动消歧）。
- 工程上：MV3 + 纯 vanilla JS 无构建；15+ 模型自带 key（DeepSeek/GLM/Kimi/通义/豆包/Claude 原生…）；key 只存本地、无后端。
- 开源 MIT：https://github.com/qucooln/incontext
- 配 1 张 demo GIF + 架构图。

---

## Hacker News（Show HN）
**Title:** Show HN: InContext – explain highlighted text grounded in the whole article (MV3, BYOK)
**URL:** https://github.com/qucooln/incontext
**Text:** Selection translators only see the snippet. This extracts the full article (Readability) and grounds the explanation in it; optional hybrid web search cites sources. No backend, bring your own key, 15+ providers. Happy to discuss the design.

---

## awesome-lists（提 PR 求收录，长期 GEO 价值高）
目标仓库：`awesome-chrome-extensions`、`awesome-ai-tools`、`awesome-llm-apps` 等。
PR 描述一行：**InContext** — Explain selected text grounded in the whole page; multi‑turn, multilingual, cited web search, BYOK, 15+ LLMs. (MIT)
