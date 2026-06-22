// Shared configuration: provider presets, defaults, settings persistence.

export const PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
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
  model: PROVIDERS.deepseek.defaultModel,
  apiKey: "",
  targetLang: "中文",
  // 全文注入上限（字符数）。超出则截断，MVP 简单策略。
  maxArticleChars: 24000,
  // 开发用：无 key 时走 mock，便于联调交互/grounding 逻辑。
  useMock: false,
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
