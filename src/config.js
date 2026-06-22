// Shared configuration: provider presets, defaults, settings persistence.

export const PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-v4-pro",
  },
  glm: {
    label: "GLM (智谱)",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
  },
  openai: {
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  custom: {
    label: "自定义 (OpenAI 兼容)",
    baseURL: "",
    defaultModel: "",
  },
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
  searchBaseURL: "https://open.bigmodel.cn/api/paas/v4",
  searchModel: "glm-5.2",
  searchApiKey: "", // 智谱 GLM key（联网用，BYOK）
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
