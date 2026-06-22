# InContext — Explain any selection, grounded in the whole page

> **Select any sentence on a web page and get an explanation based on your LLM's understanding of the _entire article_ — not just the snippet.** Then ask follow‑up questions, in any language, with optional live web search and cited sources.
>
> 划选网页中的任意一段，基于大模型对**整篇文章**的理解给出解释，并可**多轮追问**、**多语种输出**、**联网补充并标注来源**。

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#why-incontext-is-different">Why it's different</a> ·
  <a href="#features">Features</a> ·
  <a href="#faq">FAQ</a> ·
  <a href="https://qucooln.github.io/incontext/">Website</a>
</p>

![MIT License](https://img.shields.io/badge/license-MIT-blue) ![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-brightgreen) ![BYOK](https://img.shields.io/badge/BYOK-OpenAI%20compatible-orange)

<!-- DEMO: 这里放一张 demo.gif（划词→点解释→侧栏结合全文出解释）。录制后命名 docs/demo.gif 并改这里的路径 -->
<p align="center"><img src="docs/demo.gif" alt="InContext demo — explain selected text grounded in the whole page" width="720"></p>

---

## Why InContext is different

Most "explain / translate selection" extensions send **only the highlighted snippet** to the model, so the explanation is out of context. **InContext extracts the whole article first** (via Mozilla Readability) and feeds it to the model as grounding, so it explains what the selection means **in this specific article** — the author's intent, implied meaning, what a term refers to here.

| | Selection translators | Full‑page summarizers | **InContext** |
|---|---|---|---|
| Explains the selected passage | ✅ | ❌ | ✅ |
| Uses the **whole article** as context | ❌ | ✅ | ✅ |
| **Explains the selection _using_ the whole article** | ❌ | ❌ | ✅ |
| Multi‑turn follow‑up on that passage | partial | ❌ | ✅ |
| Live web search with cited sources | ❌ | ❌ | ✅ |
| Bring your own key, 15+ providers | varies | varies | ✅ |

> **One line:** *Not "translate this sentence" — "tell me what this sentence actually means in this article."*

## Features

- **Whole‑page grounding** — the entire article is the context, not the isolated snippet.
- **Three‑step explanations** — term definition → meaning in context → example when helpful.
- **Multi‑turn chat** — keep asking about the same passage.
- **Any output language** — Chinese / English / 日本語 / …
- **Web search (hybrid)** — optionally pull live facts: a search engine fetches data, your main model writes the answer and **cites sources with [n] superscripts**. Context‑aware query generation (bilingual, disambiguates homonyms like *ReAct* vs *React*).
- **15+ model providers, BYOK** — DeepSeek, GLM, Kimi, Qwen, Doubao, OpenAI, Gemini, Claude (native), Grok, Mistral, Groq, OpenRouter, SiliconFlow… Keys stored locally, never sent to any third party. Each provider's key is saved separately.
- **Per‑tab** — each tab keeps its own conversation; switching tabs never overwrites or interrupts a running explanation.

## Install

### From source (developer mode)
1. Download / clone this repo.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked**, pick the project folder (the one with `manifest.json`).
4. Pin the icon. Open the side panel → ⚙ → choose a provider and paste your API key.

### Chrome Web Store
_Coming soon — link will appear here._

## Usage

Select text on any page → click the floating **解释 / Explain** button (or right‑click menu / `Ctrl+Shift+E`) → the side panel explains it using the whole article → ask follow‑ups below. Toggle **🔍 联网 / Web** for live, cited answers.

## Architecture

```
Content script   detect selection → floating button → Readability extracts full article → send to background
       │
Background       store selection per‑tab → open Side Panel → notify
       │
Side Panel       (optional) generate search query → web search → build prompt(full article + selection + sources)
                 → stream from your model → multi‑turn UI with [n] citations
```

Core grounding prompt: `src/prompt.js`. Web search: `src/search.js`. Providers / Anthropic adapter: `src/llm.js` & `src/config.js`. No build step — plain MV3 + vanilla JS.

## FAQ

**Is my data private?** Yes. It's BYOK — your API key and conversations stay in your browser's local storage. The page text goes only to the model endpoint _you_ configured.

**Which models can I use?** Any OpenAI‑compatible endpoint plus native Anthropic Claude — 15+ presets, or add a custom one.

**Does it work on PDFs / local files?** Local `file://` pages need "Allow access to file URLs" enabled for the extension; some Chrome internal pages can't be accessed at all.

**How is this different from 沉浸式翻译 / Glarity / Monica?** Those translate the snippet or summarize the page. InContext explains the *selected passage* using the *whole article* as context — and cites web sources when asked.

## Contributing

Issues and PRs welcome. No build step — edit and reload the unpacked extension.

## License

MIT
