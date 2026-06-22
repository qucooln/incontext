# InContext Privacy Policy

_Last updated: 2026-06-22_

InContext is a browser extension that explains selected text on web pages using a large language model that **you** configure with **your own API key** (BYOK — Bring Your Own Key).

## What data is processed

- **Selected text and the current page's article content.** When you trigger an explanation, the extension extracts the readable article text of the page you are on and the passage you selected, and sends them to the model endpoint **you configured** in order to generate the explanation.
- **Your follow‑up messages**, sent to the same endpoint to continue the conversation.
- **Search queries** (only if you enable the Web Search toggle), sent to the search provider **you configured** (e.g. Serper / SerpAPI / Tavily).

## What we store

- **Locally in your browser only:** your API keys, provider settings, language preference, and per‑tab conversation state. These are kept in the browser's `storage.local` / `storage.session` and are **never transmitted to us or any third party** other than the model/search endpoints you yourself configured.

## What we do NOT do

- We do **not** operate any server. The extension has no backend of ours.
- We do **not** collect, transmit, sell, or share your data, browsing history, or keys with the developer or any analytics/ad service.
- We do **not** send page content anywhere except the API endpoint you explicitly set up.

## Third‑party services

When you use the extension, requests go directly from your browser to:
- the **LLM provider** you chose (e.g. DeepSeek, OpenAI, Anthropic, Zhipu/GLM, etc.), and
- the **search provider** you chose (only if Web Search is enabled).

Your use of those services is governed by their respective privacy policies.

## Permissions

- `activeTab` / `scripting` / host permissions — to read the article text of the page you're actively using, so the explanation can be grounded in the full page.
- `storage` — to save your settings and conversations locally.
- `sidePanel` / `contextMenus` — for the UI.

## Contact

Questions: open an issue at https://github.com/qucooln/incontext/issues
