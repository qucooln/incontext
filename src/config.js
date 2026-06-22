// Shared configuration: provider presets, defaults, settings persistence.

// 模型预设。默认模型均可在设置里手改；除 Anthropic 外都走 OpenAI 兼容协议。
export const PROVIDERS = {
  deepseek: { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", defaultModel: "deepseek-v4-pro" },
  glm: { label: "GLM (智谱)", baseURL: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4.6" },
  moonshot: { label: "Moonshot 月之暗面 (Kimi)", baseURL: "https://api.moonshot.cn/v1", defaultModel: "kimi-k2-0905-preview" },
  qwen: { label: "通义千问 Qwen (阿里)", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-max" },
  doubao: { label: "豆包 / 火山方舟 (字节)", baseURL: "https://ark.cn-beijing.volces.com/api/v3", defaultModel: "doubao-seed-1.6-250615" },
  siliconflow: { label: "硅基流动 SiliconFlow (聚合)", baseURL: "https://api.siliconflow.cn/v1", defaultModel: "deepseek-ai/DeepSeek-V3" },
  yi: { label: "零一万物 Yi", baseURL: "https://api.lingyiwanwu.com/v1", defaultModel: "yi-lightning" },
  baichuan: { label: "百川 Baichuan", baseURL: "https://api.baichuan-ai.com/v1", defaultModel: "Baichuan4" },
  openai: { label: "OpenAI", baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4.1" },
  gemini: { label: "Google Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-flash" },
  anthropic: { label: "Anthropic Claude (原生直连)", baseURL: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-6" },
  grok: { label: "xAI Grok", baseURL: "https://api.x.ai/v1", defaultModel: "grok-4-0709" },
  groq: { label: "Groq (极速推理)", baseURL: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  mistral: { label: "Mistral", baseURL: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest" },
  openrouter: { label: "OpenRouter (聚合，含 Claude/GPT)", baseURL: "https://openrouter.ai/api/v1", defaultModel: "anthropic/claude-sonnet-4" },
  ollama: { label: "Ollama (本地)", baseURL: "http://127.0.0.1:11434/v1", defaultModel: "llama3.1" },
  custom: { label: "自定义 (OpenAI 兼容)", baseURL: "", defaultModel: "" },
};

export const DEFAULT_SETTINGS = {
  provider: "deepseek",
  baseURL: PROVIDERS.deepseek.baseURL,
  model: "deepseek-v4-pro",
  apiKey: "",
  targetLang: "中文",
  // 全文注入上限（字符数）。超出则截断，MVP 简单策略。
  maxArticleChars: 24000,
  // 开发用：无 key 时走 mock，便于联调交互/grounding 逻辑。
  useMock: false,

  // 联网搜索（路线1：借智谱 GLM 原生 web_search）。
  // 侧栏「联网」开时，该次解释/追问改走 GLM 并启用联网搜索。
  searchEnabled: false, // 「联网」开关默认状态
  searchProvider: "serper", // serper | serpapi | tavily（均为 Google/Web 搜索）
  serperApiKey: "", // serper.dev 的 key
  serpapiApiKey: "", // serpapi.com 的 key（与 serper 不是一家）
  tavilyApiKey: "", // tavily.com 的 key
};

export async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
