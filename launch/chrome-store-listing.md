# Chrome Web Store — Listing 文案（直接复制粘贴）

## Name（≤45 字符）
InContext — Explain selection, grounded in page

## Summary / 简短描述（≤132 字符）
Explain any selected text using your LLM's understanding of the WHOLE article — multi‑turn, multilingual, cited web search. BYOK.

## Category
Productivity

## Language
English（可另建中文 listing：见下方中文版）

## Detailed description（详细描述）
Most "explain" or "translate selection" extensions send only the highlighted snippet to the AI, so the explanation is out of context.

InContext is different: it first extracts the WHOLE article (via Mozilla Readability) and feeds it to the model as grounding. So it explains what your selection actually means IN THIS article — the author's intent, the implied meaning, and what each term refers to here.

★ Whole‑page grounding — the entire article is the context, not the isolated snippet.
★ Three‑step explanations — term definition → meaning in context → example when helpful.
★ Multi‑turn — keep asking follow‑up questions about the same passage.
★ Any language — explain in Chinese, English, Japanese, and more.
★ Cited web search (optional) — a search engine fetches live facts and your model writes the answer with [n] cited sources. Context‑aware, bilingual queries that disambiguate homonyms.
★ 15+ AI providers, Bring Your Own Key — DeepSeek, GLM, Kimi, Qwen, Doubao, OpenAI, Gemini, Anthropic Claude, Grok, Mistral, Groq, OpenRouter, SiliconFlow… Keys are stored locally in your browser and never sent to any third party.
★ Per‑tab conversations — each tab keeps its own thread; switching tabs never interrupts a running explanation.

Privacy: InContext has no backend. Your API keys and conversations stay in your browser. Page text is sent only to the model endpoint you configure yourself.

How to use: select text → click the floating Explain button (or right‑click / Ctrl+Shift+E) → read the grounded explanation in the side panel → ask follow‑ups. Toggle Web for cited, up‑to‑date answers.

Open source (MIT): https://github.com/qucooln/incontext

---

## 中文版 listing（如建中文 locale）
**名称**：InContext 划词释义 — 基于全文理解
**简短描述**：划选任意一段，基于大模型对【整篇文章】的理解来解释，可多轮追问、多语输出、联网并标注来源。BYOK 自带 key。
**详细描述**：
普通划词翻译/解释只把选中的一小段发给 AI，解释脱离语境。
InContext 不一样：先用 Readability 抽取【整篇文章】喂给模型做背景，所以它解释的是这段话【在这篇文章里】到底什么意思——作者意图、隐含信息、专有名词的真实所指。
★ 基于全文，而非孤立片段
★ 三步式解释：术语释义 → 全文语境 → 必要时举例
★ 多轮追问、多语种输出
★ 可选联网：搜索引擎取数、你的模型作答并标注 [n] 来源；检索词结合上下文、中英双语、自动消歧
★ 15+ 模型，自带 key：DeepSeek/GLM/Kimi/通义/豆包/OpenAI/Gemini/Claude/Grok… key 仅存本地，不传第三方
★ 按标签页独立对话，切换不打断
隐私：无后端，key 与对话只存在你浏览器，正文只发往你自己配置的模型接口。
开源(MIT)：https://github.com/qucooln/incontext

---

## 截图清单（需你在 Chrome 里截，1280×800 或 640×400，建议 1280×800，4–5 张）
1. **核心场景**：一篇文章里划选一句，侧栏给出"结合全文"的三步解释（最重要，放第一张）。
2. **联网 + 来源**：开启🔍联网，答案里有 [1][2] 上标 + 底部"来源（联网）"清单。
3. **多轮追问**：侧栏里连续问了 2-3 轮。
4. **设置页·模型**：展示 15+ 服务商下拉 + 测试连接按钮。
5. **设置页·搜索**：Serper/SerpAPI/Tavily 选择。
> 小图标 128×128 已在 icons/。商店还需要一张 440×280 的小宣传图（可选）和 1400×560 marquee（可选）。
