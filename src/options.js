import { PROVIDERS, getSettings, saveSettings, DEFAULT_SETTINGS } from "./config.js";

const el = (id) => document.getElementById(id);

// 填充服务商下拉
for (const [key, p] of Object.entries(PROVIDERS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = p.label;
  el("provider").appendChild(opt);
}

function applyProviderPreset(key) {
  const p = PROVIDERS[key];
  if (!p) return;
  if (key !== "custom") {
    el("baseURL").value = p.baseURL;
    el("model").value = p.defaultModel;
  }
}

el("provider").addEventListener("change", (e) => applyProviderPreset(e.target.value));

async function load() {
  const s = await getSettings();
  el("provider").value = s.provider;
  el("baseURL").value = s.baseURL;
  el("model").value = s.model;
  el("apiKey").value = s.apiKey;
  el("targetLang").value = s.targetLang;
  el("maxArticleChars").value = s.maxArticleChars;
  el("useMock").checked = s.useMock;
  el("searchEnabled").checked = s.searchEnabled;
  el("searchModel").value = s.searchModel;
  el("searchApiKey").value = s.searchApiKey;
}

el("save").addEventListener("click", async () => {
  await saveSettings({
    provider: el("provider").value,
    baseURL: el("baseURL").value.trim() || DEFAULT_SETTINGS.baseURL,
    model: el("model").value.trim() || DEFAULT_SETTINGS.model,
    apiKey: el("apiKey").value.trim(),
    targetLang: el("targetLang").value.trim() || "中文",
    maxArticleChars: parseInt(el("maxArticleChars").value, 10) || DEFAULT_SETTINGS.maxArticleChars,
    useMock: el("useMock").checked,
    searchEnabled: el("searchEnabled").checked,
    searchModel: el("searchModel").value.trim() || DEFAULT_SETTINGS.searchModel,
    searchApiKey: el("searchApiKey").value.trim(),
  });
  el("status").textContent = "已保存 ✓";
  setTimeout(() => (el("status").textContent = ""), 2000);
});

load();
